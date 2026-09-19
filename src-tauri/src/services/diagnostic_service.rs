use crate::database::{DeviceRepository, SettingsRepository};
use crate::error::AppError;
use crate::models::{
    Device, DeviceStatus, DiagnosticHistoryRecord, DiagnosticResult, HttpTestResult,
    NetworkOverview, PingResult, ServiceConfig, ServiceProbeResult, ServiceType, TcpTestResult,
};
use crate::network::{ping_target, test_http_endpoint, test_tcp_connection};
use chrono::Utc;
use sqlx::SqlitePool;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Semaphore;

pub struct DiagnosticService;

impl DiagnosticService {
    /// Executes a standalone ICMP ping test.
    pub async fn run_ping(target: &str, timeout_ms: u64) -> PingResult {
        ping_target(target, Duration::from_millis(timeout_ms)).await
    }

    /// Executes a standalone TCP port connection test.
    pub async fn run_tcp_test(host: &str, port: u16, timeout_ms: u64) -> TcpTestResult {
        test_tcp_connection(host, port, Duration::from_millis(timeout_ms)).await
    }

    /// Executes a standalone HTTP/HTTPS request test.
    pub async fn run_http_test(
        client: &reqwest::Client,
        url: &str,
        timeout_ms: u64,
    ) -> HttpTestResult {
        test_http_endpoint(client, url, Duration::from_millis(timeout_ms)).await
    }

    /// Tests a single configured L7 service (TCP or HTTP/HTTPS).
    async fn probe_service(
        client: &reqwest::Client,
        ip_address: &str,
        service: &ServiceConfig,
        timeout_duration: Duration,
    ) -> ServiceProbeResult {
        match service.service_type {
            ServiceType::Tcp => {
                let tcp_res = test_tcp_connection(ip_address, service.port, timeout_duration).await;
                ServiceProbeResult {
                    name: service.name.clone(),
                    service_type: "tcp".to_string(),
                    port: service.port,
                    success: tcp_res.success,
                    latency_ms: tcp_res.latency_ms,
                    status_code: None,
                    error: tcp_res.error,
                }
            }
            ServiceType::Http | ServiceType::Https => {
                // Construct target URL
                let url = if let Some(ref target) = service.target {
                    if target.starts_with("http://") || target.starts_with("https://") {
                        target.clone()
                    } else {
                        let scheme = if service.service_type == ServiceType::Https {
                            "https"
                        } else {
                            "http"
                        };
                        let path = if target.starts_with('/') {
                            target.clone()
                        } else {
                            format!("/{}", target)
                        };
                        format!("{}://{}:{}{}", scheme, ip_address, service.port, path)
                    }
                } else {
                    let scheme = if service.service_type == ServiceType::Https {
                        "https"
                    } else {
                        "http"
                    };
                    format!("{}://{}:{}", scheme, ip_address, service.port)
                };

                let http_res = test_http_endpoint(client, &url, timeout_duration).await;
                ServiceProbeResult {
                    name: service.name.clone(),
                    service_type: if service.service_type == ServiceType::Https {
                        "https".to_string()
                    } else {
                        "http".to_string()
                    },
                    port: service.port,
                    success: http_res.success,
                    latency_ms: http_res.latency_ms,
                    status_code: http_res.status_code,
                    error: http_res.error,
                }
            }
        }
    }

    /// Executes a comprehensive diagnostic for a specific device:
    /// 1. Layer 3 ICMP ping
    /// 2. Layer 7 Service probes (TCP / HTTP)
    /// 3. Status aggregation:
    ///    - L3 failed -> Offline
    ///    - L3 passed + all L7 passed -> Operational
    ///    - L3 passed + any L7 failed -> Degraded
    /// 4. Stores the real measurement in SQLite history.
    pub async fn run_device_diagnostic(
        pool: &SqlitePool,
        client: &reqwest::Client,
        device_id: i64,
    ) -> Result<DiagnosticResult, AppError> {
        let device = DeviceRepository::find_by_id(pool, device_id)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Device ID {} not found", device_id)))?;

        let settings = SettingsRepository::get(pool).await?;
        let timeout_duration = Duration::from_millis(settings.network_timeout_ms as u64);

        Self::execute_diagnostic_internal(pool, client, &device, timeout_duration).await
    }

    /// Internal helper that performs the actual network probes and status evaluation.
    async fn execute_diagnostic_internal(
        pool: &SqlitePool,
        client: &reqwest::Client,
        device: &Device,
        timeout_duration: Duration,
    ) -> Result<DiagnosticResult, AppError> {
        // Step 1: L3 ICMP Ping
        let l3_result = ping_target(&device.ip_address, timeout_duration).await;

        // Step 2: L7 Service Probes
        let services: Vec<ServiceConfig> =
            serde_json::from_str(&device.services_config).unwrap_or_default();

        let mut l7_results = Vec::with_capacity(services.len());
        for service in &services {
            let probe_res =
                Self::probe_service(client, &device.ip_address, service, timeout_duration).await;
            l7_results.push(probe_res);
        }

        // Step 3: Compute Overall Status
        let overall_status = if !l3_result.success {
            DeviceStatus::Offline
        } else {
            let any_l7_failed = l7_results.iter().any(|r| !r.success);
            if any_l7_failed {
                DeviceStatus::Degraded
            } else {
                DeviceStatus::Operational
            }
        };

        let status_str = match overall_status {
            DeviceStatus::Operational => "operational",
            DeviceStatus::Degraded => "degraded",
            DeviceStatus::Offline => "offline",
        };

        // Step 4: Persist real measurement in SQLite history
        let l7_summary_json = serde_json::to_string(&l7_results).unwrap_or_default();
        let _ = DeviceRepository::save_diagnostic(
            pool,
            device.id,
            status_str,
            l3_result.success,
            l3_result.latency_ms,
            l3_result.error.as_deref(),
            &l7_summary_json,
        )
        .await;

        Ok(DiagnosticResult {
            device_id: device.id,
            device_name: device.name.clone(),
            ip_address: device.ip_address.clone(),
            l3_result,
            l7_results,
            overall_status,
            executed_at: Utc::now(),
        })
    }

    /// Fetches all enabled devices and concurrently runs diagnostics bounded by a semaphore.
    /// Returns aggregated network health metrics for the dashboard.
    pub async fn get_network_overview(
        pool: &SqlitePool,
        client: &reqwest::Client,
    ) -> Result<NetworkOverview, AppError> {
        let all_devices = DeviceRepository::find_all(pool).await?;
        let enabled_devices: Vec<Device> =
            all_devices.into_iter().filter(|d| d.enabled == 1).collect();

        let settings = SettingsRepository::get(pool).await?;
        let max_concurrent = (settings.max_concurrent_tests as usize).max(1);
        let timeout_duration = Duration::from_millis(settings.network_timeout_ms as u64);

        let semaphore = Arc::new(Semaphore::new(max_concurrent));
        let mut tasks = Vec::with_capacity(enabled_devices.len());

        for device in enabled_devices {
            let sem_clone = Arc::clone(&semaphore);
            let pool_clone = pool.clone();
            let client_clone = client.clone();

            tasks.push(tokio::spawn(async move {
                let _permit = sem_clone.acquire().await.expect("Semaphore acquire error");
                Self::execute_diagnostic_internal(
                    &pool_clone,
                    &client_clone,
                    &device,
                    timeout_duration,
                )
                .await
            }));
        }

        let mut results = Vec::with_capacity(tasks.len());
        let mut online_devices = 0;
        let mut degraded_devices = 0;
        let mut offline_devices = 0;

        for task in tasks {
            if let Ok(Ok(diag)) = task.await {
                match diag.overall_status {
                    DeviceStatus::Operational => online_devices += 1,
                    DeviceStatus::Degraded => degraded_devices += 1,
                    DeviceStatus::Offline => offline_devices += 1,
                }
                results.push(diag);
            }
        }

        Ok(NetworkOverview {
            total_devices: results.len(),
            online_devices,
            degraded_devices,
            offline_devices,
            scanned_at: Utc::now(),
            results,
        })
    }

    /// Retrieves history records for a specific device.
    pub async fn get_device_history(
        pool: &SqlitePool,
        device_id: i64,
        limit: Option<i64>,
    ) -> Result<Vec<DiagnosticHistoryRecord>, AppError> {
        let limit = limit.unwrap_or(20).clamp(1, 100);
        DeviceRepository::get_history(pool, device_id, limit).await
    }
}
