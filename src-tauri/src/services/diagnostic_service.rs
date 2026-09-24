use crate::database::{AlertRepository, DeviceRepository, SettingsRepository};
use crate::error::AppError;
use crate::models::{
    AlertSeverity, AlertType, Device, DeviceStatus, DiagnosticHistoryRecord, DiagnosticResult,
    HttpTestResult, L3Diagnostic, LatencyStats, NetworkOverview, PingResult, ServiceConfig,
    ServiceProbeResult, ServiceType, TcpTestResult,
};
use crate::network::{
    explain_l3_connectivity, ping_target, resolve_arp_async, test_http_endpoint,
    test_tcp_connection,
};
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

    /// Calculates actual latency statistics and detects degradation based solely on real historical data.
    pub fn compute_latency_stats(
        current_latency: Option<f64>,
        history: &[DiagnosticHistoryRecord],
    ) -> Option<LatencyStats> {
        let mut valid_latencies: Vec<f64> = history
            .iter()
            .filter_map(|h| h.l3_latency_ms)
            .filter(|&lat| lat > 0.0)
            .collect();

        if let Some(curr) = current_latency {
            valid_latencies.insert(0, curr);
        }

        if valid_latencies.is_empty() {
            return None;
        }

        let sample_count = valid_latencies.len();
        let sum: f64 = valid_latencies.iter().sum();
        let avg = sum / sample_count as f64;
        let min = valid_latencies.iter().copied().fold(f64::INFINITY, f64::min);
        let max = valid_latencies.iter().copied().fold(f64::NEG_INFINITY, f64::max);

        // Degradation detection: if we have at least 3 samples and current latency exceeds 2x average
        let mut is_degraded = false;
        let mut degradation_explanation = None;

        if sample_count >= 3 {
            if let Some(curr) = current_latency {
                if curr > (avg * 2.0).max(50.0) {
                    is_degraded = true;
                    degradation_explanation = Some(format!(
                        "Dégradation de latence détectée : {:.1} ms (moyenne nominale : {:.1} ms, pic : {:.1} ms)",
                        curr, avg, max
                    ));
                }
            }
        }

        Some(LatencyStats {
            current_ms: current_latency,
            avg_ms: Some((avg * 10.0).round() / 10.0),
            min_ms: Some((min * 10.0).round() / 10.0),
            max_ms: Some((max * 10.0).round() / 10.0),
            sample_count,
            is_degraded,
            degradation_explanation,
        })
    }

    /// Executes a comprehensive diagnostic for a specific device:
    /// 1. Layer 3 ICMP ping
    /// 2. If ICMP fails, attempt ARP resolution (Windows SendARP API)
    /// 3. Layer 7 Service probes (TCP / HTTP)
    /// 4. Overall status & explainability
    /// 5. Historical latency stats & degradation detection
    /// 6. Real alerts persistence (with deduplication)
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

    /// Internal helper performing full probe, ARP resolution, explanation, latency analysis and alerts.
    async fn execute_diagnostic_internal(
        pool: &SqlitePool,
        client: &reqwest::Client,
        device: &Device,
        timeout_duration: Duration,
    ) -> Result<DiagnosticResult, AppError> {
        // Step 1: L3 ICMP Ping
        let l3_result = ping_target(&device.ip_address, timeout_duration).await;

        // Step 2: Layer 3 Nuance — If ping fails, run ARP
        let arp_result = if !l3_result.success {
            Some(resolve_arp_async(&device.ip_address).await)
        } else {
            None
        };

        let (l3_status_code, l3_explanation) =
            explain_l3_connectivity(&l3_result, arp_result.as_ref());

        let l3_diagnostic = L3Diagnostic {
            ping: l3_result.clone(),
            arp: arp_result.clone(),
            status: l3_status_code,
            explanation: l3_explanation,
        };

        // Step 3: L7 Service Probes
        let services: Vec<ServiceConfig> =
            serde_json::from_str(&device.services_config).unwrap_or_default();

        let mut l7_results = Vec::with_capacity(services.len());
        for service in &services {
            let probe_res =
                Self::probe_service(client, &device.ip_address, service, timeout_duration).await;
            l7_results.push(probe_res);
        }

        // Step 4: Compute Overall Status and Factual Explanation
        let (overall_status, explanation, degradation_reason) = if !l3_result.success {
            if let Some(ref arp) = arp_result {
                if arp.resolved {
                    let mac = arp.mac_address.as_deref().unwrap_or("résolu");
                    (
                        DeviceStatus::Degraded,
                        format!(
                            "Équipement détecté au niveau liaison (ARP {}), mais les requêtes ICMP/Ping sont filtrées",
                            mac
                        ),
                        Some("Filtrage ICMP constaté (liaison réseau présente)".to_string()),
                    )
                } else {
                    (
                        DeviceStatus::Offline,
                        "Aucun équipement n'a pu être confirmé à cette adresse depuis le poste de supervision (échec Ping et non-réponse ARP)".to_string(),
                        Some("Inaccessible sur le réseau L3 et non résolu en ARP".to_string()),
                    )
                }
            } else {
                (
                    DeviceStatus::Offline,
                    "Équipement injoignable via protocole ICMP".to_string(),
                    Some("Délai de réponse dépassé".to_string()),
                )
            }
        } else {
            let failed_services: Vec<&ServiceProbeResult> =
                l7_results.iter().filter(|r| !r.success).collect();

            if !failed_services.is_empty() {
                let serv_names = failed_services
                    .iter()
                    .map(|s| format!("{}:{}", s.name, s.port))
                    .collect::<Vec<_>>()
                    .join(", ");
                (
                    DeviceStatus::Degraded,
                    format!(
                        "Équipement joignable au niveau réseau, mais service(s) applicatif(s) indisponible(s) : {}",
                        serv_names
                    ),
                    Some(format!("Échec service(s) L7 : {}", serv_names)),
                )
            } else {
                (
                    DeviceStatus::Operational,
                    "Équipement joignable et tous les services applicatifs configurés répondent nominalement".to_string(),
                    None,
                )
            }
        };

        let status_str = match overall_status {
            DeviceStatus::Operational => "operational",
            DeviceStatus::Degraded => "degraded",
            DeviceStatus::Offline => "offline",
        };

        // Step 5: History retrieval to calculate real latency statistics and latency spike
        let past_history = DeviceRepository::get_history(pool, device.id, 15).await.unwrap_or_default();
        let latency_stats = Self::compute_latency_stats(l3_result.latency_ms, &past_history);

        // Step 6: Persist real measurement in SQLite history
        let l7_summary_json = serde_json::to_string(&l7_results).unwrap_or_default();
        let _ = DeviceRepository::save_diagnostic(
            pool,
            device.id,
            status_str,
            l3_result.success,
            l3_result.latency_ms,
            l3_result.error.as_deref(),
            &l7_summary_json,
            Some(&explanation),
        )
        .await;

        // Step 7: Real Alert Management & Deduplication
        match overall_status {
            DeviceStatus::Offline => {
                let _ = AlertRepository::create_alert(
                    pool,
                    device.id,
                    AlertType::DeviceUnreachable,
                    AlertSeverity::Critical,
                    &format!(
                        "Équipement '{}' ({}) injoignable : {}",
                        device.name, device.ip_address, explanation
                    ),
                )
                .await;
            }
            DeviceStatus::Degraded => {
                let _ = AlertRepository::create_alert(
                    pool,
                    device.id,
                    AlertType::ServiceDegraded,
                    AlertSeverity::Warning,
                    &format!(
                        "Dégradation sur '{}' ({}) : {}",
                        device.name, device.ip_address, explanation
                    ),
                )
                .await;
            }
            DeviceStatus::Operational => {
                // If it recovered to Operational, resolve previous unreachable/degraded alerts
                let _ = AlertRepository::resolve_alerts_for_device(
                    pool,
                    device.id,
                    &[AlertType::DeviceUnreachable, AlertType::ServiceDegraded],
                )
                .await;
            }
        }

        // Check for latency spike alert
        if let Some(ref stats) = latency_stats {
            if stats.is_degraded {
                if let Some(ref deg_msg) = stats.degradation_explanation {
                    let _ = AlertRepository::create_alert(
                        pool,
                        device.id,
                        AlertType::LatencySpike,
                        AlertSeverity::Warning,
                        &format!("{} sur '{}' ({})", deg_msg, device.name, device.ip_address),
                    )
                    .await;
                }
            } else {
                let _ = AlertRepository::resolve_alerts_for_device(
                    pool,
                    device.id,
                    &[AlertType::LatencySpike],
                )
                .await;
            }
        }

        Ok(DiagnosticResult {
            device_id: device.id,
            device_name: device.name.clone(),
            ip_address: device.ip_address.clone(),
            l3_result,
            l3_diagnostic,
            l7_results,
            overall_status,
            explanation,
            degradation_reason,
            latency_stats,
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
