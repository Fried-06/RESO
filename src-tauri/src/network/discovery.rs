use crate::models::{DiscoveredDevice, DiscoveryProgress, StartDiscoveryRequest};
use crate::network::arp::resolve_arp_async;
use crate::network::ping_target;
use std::net::Ipv4Addr;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{mpsc, Mutex, Semaphore};

/// Thread-safe controller for ongoing network discovery.
pub struct DiscoveryController {
    is_running: Arc<AtomicBool>,
    found_devices: Arc<Mutex<Vec<DiscoveredDevice>>>,
    progress: Arc<Mutex<DiscoveryProgress>>,
}

impl DiscoveryController {
    pub fn new() -> Self {
        Self {
            is_running: Arc::new(AtomicBool::new(false)),
            found_devices: Arc::new(Mutex::new(Vec::new())),
            progress: Arc::new(Mutex::new(DiscoveryProgress {
                subnet: "10.28.0.0/16".to_string(),
                is_running: false,
                total_targets: 0,
                scanned_targets: 0,
                found_count: 0,
                current_ip: None,
                error: None,
            })),
        }
    }

    /// Checks if a discovery scan is currently active.
    pub fn is_running(&self) -> bool {
        self.is_running.load(Ordering::SeqCst)
    }

    /// Stops any ongoing discovery scan cleanly.
    pub fn stop(&self) {
        self.is_running.store(false, Ordering::SeqCst);
    }

    /// Returns current progress and snapshot of found devices.
    pub async fn get_status(&self) -> (DiscoveryProgress, Vec<DiscoveredDevice>) {
        let prog = self.progress.lock().await.clone();
        let devices = self.found_devices.lock().await.clone();
        (prog, devices)
    }

    /// Generates IP targets for a subnet or range.
    /// Handles "10.28.0.0/16", "10.28.x.0/24", etc.
    /// In full /16, sweeps from 10.28.0.1 to 10.28.255.254.
    pub fn parse_subnet_targets(subnet_str: &str) -> Vec<Ipv4Addr> {
        let trimmed = subnet_str.trim();

        // Default or specific /16
        if trimmed == "10.28.0.0/16" || trimmed.is_empty() {
            let mut list = Vec::with_capacity(65534);
            for b3 in 0..=255u8 {
                for b4 in 1..=254u8 {
                    list.push(Ipv4Addr::new(10, 28, b3, b4));
                }
            }
            return list;
        }

        // Support /24 subnets e.g. 10.28.1.0/24
        if let Some((ip_part, mask_part)) = trimmed.split_once('/') {
            if mask_part.trim() == "24" {
                if let Ok(base_ip) = ip_part.trim().parse::<Ipv4Addr>() {
                    let octets = base_ip.octets();
                    let mut list = Vec::with_capacity(254);
                    for b4 in 1..=254u8 {
                        list.push(Ipv4Addr::new(octets[0], octets[1], octets[2], b4));
                    }
                    return list;
                }
            }
        }

        // Fallback: 10.28.0.0/16
        let mut list = Vec::with_capacity(65534);
        for b3 in 0..=255u8 {
            for b4 in 1..=254u8 {
                list.push(Ipv4Addr::new(10, 28, b3, b4));
            }
        }
        list
    }

    /// Starts a background discovery process bounded by concurrency limits.
    pub async fn start(
        &self,
        req: StartDiscoveryRequest,
        registered_devices: Vec<(i64, String, String)>, // (id, name, ip)
    ) -> Result<(), String> {
        if self.is_running.swap(true, Ordering::SeqCst) {
            return Err("Une découverte réseau est déjà en cours d'exécution".to_string());
        }

        let subnet = req.subnet.unwrap_or_else(|| "10.28.0.0/16".to_string());
        let targets = Self::parse_subnet_targets(&subnet);
        let total_targets = targets.len() as u32;

        let max_concurrency = req.max_concurrency.unwrap_or(64).clamp(1, 256);
        let timeout_ms = req.timeout_ms.unwrap_or(800).clamp(200, 5000);

        // Clear previous results
        {
            let mut found = self.found_devices.lock().await;
            found.clear();
        }
        {
            let mut prog = self.progress.lock().await;
            prog.subnet = subnet.clone();
            prog.is_running = true;
            prog.total_targets = total_targets;
            prog.scanned_targets = 0;
            prog.found_count = 0;
            prog.current_ip = None;
            prog.error = None;
        }

        let is_running_clone = Arc::clone(&self.is_running);
        let found_devices_clone = Arc::clone(&self.found_devices);
        let progress_clone = Arc::clone(&self.progress);

        tokio::spawn(async move {
            let semaphore = Arc::new(Semaphore::new(max_concurrency));
            let (tx, mut rx) = mpsc::channel::<Option<DiscoveredDevice>>(100);

            // Spawn consumer task
            let found_sink = Arc::clone(&found_devices_clone);
            let progress_sink = Arc::clone(&progress_clone);
            let is_running_consumer = Arc::clone(&is_running_clone);

            let consumer_handle = tokio::spawn(async move {
                let mut scanned = 0u32;
                let mut found_total = 0usize;

                while let Some(item) = rx.recv().await {
                    scanned += 1;
                    if let Some(dev) = item {
                        found_total += 1;
                        let mut list = found_sink.lock().await;
                        list.push(dev);
                    }

                    // Update progress every 10 scanned or on item found
                    if scanned % 20 == 0 || scanned == total_targets {
                        let mut prog = progress_sink.lock().await;
                        prog.scanned_targets = scanned;
                        prog.found_count = found_total;
                    }
                }

                let mut prog = progress_sink.lock().await;
                prog.is_running = false;
                prog.scanned_targets = scanned;
                prog.found_count = found_total;
                is_running_consumer.store(false, Ordering::SeqCst);
            });

            // Producer loop
            for ip in targets {
                if !is_running_clone.load(Ordering::SeqCst) {
                    break;
                }

                let sem_permit = match semaphore.clone().acquire_owned().await {
                    Ok(p) => p,
                    Err(_) => break,
                };

                let tx_clone = tx.clone();
                let ip_str = ip.to_string();
                let reg_devs = registered_devices.clone();

                tokio::spawn(async move {
                    let _permit = sem_permit;
                    let timeout = Duration::from_millis(timeout_ms);

                    // Step 1: Quick Ping
                    let ping_res = ping_target(&ip_str, timeout).await;

                    if ping_res.success {
                        // Equipment answered Ping!
                        let arp_res = resolve_arp_async(&ip_str).await;
                        let matching_reg = reg_devs.iter().find(|(_, _, reg_ip)| reg_ip == &ip_str);

                        let dev = DiscoveredDevice {
                            ip_address: ip_str,
                            hostname: None,
                            mac_address: arp_res.mac_address,
                            response_time_ms: ping_res.latency_ms,
                            is_registered: matching_reg.is_some(),
                            registered_device_id: matching_reg.map(|(id, _, _)| *id),
                            registered_device_name: matching_reg.map(|(_, name, _)| name.clone()),
                        };
                        let _ = tx_clone.send(Some(dev)).await;
                    } else {
                        // Optional ARP verification for local subnet
                        let arp_res = resolve_arp_async(&ip_str).await;
                        if arp_res.resolved {
                            let matching_reg = reg_devs.iter().find(|(_, _, reg_ip)| reg_ip == &ip_str);
                            let dev = DiscoveredDevice {
                                ip_address: ip_str,
                                hostname: None,
                                mac_address: arp_res.mac_address,
                                response_time_ms: None,
                                is_registered: matching_reg.is_some(),
                                registered_device_id: matching_reg.map(|(id, _, _)| *id),
                                registered_device_name: matching_reg.map(|(_, name, _)| name.clone()),
                            };
                            let _ = tx_clone.send(Some(dev)).await;
                        } else {
                            let _ = tx_clone.send(None).await;
                        }
                    }
                });
            }

            // Drop original tx so consumer can finish once tasks complete
            drop(tx);
            let _ = consumer_handle.await;
            is_running_clone.store(false, Ordering::SeqCst);
        });

        Ok(())
    }
}
