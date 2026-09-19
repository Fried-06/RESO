use crate::error::{validate_ip_or_hostname, AppError};
use crate::models::PingResult;
use std::net::IpAddr;
use std::time::Duration;
use tokio::time::timeout;

/// Resolves a target hostname or IP string to an `IpAddr`.
async fn resolve_ip(target: &str) -> Result<IpAddr, AppError> {
    validate_ip_or_hostname(target)?;

    // If it's already an IP address, parse directly
    if let Ok(ip) = target.parse::<IpAddr>() {
        return Ok(ip);
    }

    // Resolve hostname asynchronously
    let address_with_port = format!("{}:80", target);
    let mut addrs = tokio::net::lookup_host(&address_with_port)
        .await
        .map_err(|e| AppError::Network(format!("DNS resolution failed for '{}': {}", target, e)))?;

    if let Some(socket_addr) = addrs.next() {
        Ok(socket_addr.ip())
    } else {
        Err(AppError::Network(format!(
            "No IP addresses found for hostname '{}'",
            target
        )))
    }
}

/// Executes a real Layer 3 ICMP ping against a target (IP or hostname).
/// - On Windows: Uses the native `IcmpSendEcho` API via the `winping` crate (no admin rights required).
/// - On Non-Windows: Uses standard system ping process execution with real output parsing.
/// - Returns real latency, success flag, and detailed network error if unreachable or timed out.
pub async fn ping_target(target: &str, timeout_duration: Duration) -> PingResult {
    let target_str = target.to_string();

    let ip = match resolve_ip(target).await {
        Ok(ip) => ip,
        Err(e) => {
            return PingResult {
                target: target_str,
                success: false,
                latency_ms: None,
                error: Some(e.to_string()),
            };
        }
    };

    #[cfg(windows)]
    {
        // Execute unprivileged Windows ICMP ping via winping
        let ping_future = tokio::task::spawn_blocking(move || {
            let pinger = match winping::Pinger::new() {
                Ok(p) => p,
                Err(e) => return Err(format!("Failed to initialize ICMP pinger: {:?}", e)),
            };

            let mut buffer = winping::Buffer::new();
            match pinger.send(ip, &mut buffer) {
                Ok(rtt) => Ok(rtt as f64),
                Err(e) => Err(match e {
                    winping::Error::Timeout => "Request timed out".to_string(),
                    winping::Error::HostUnreachable => "Destination host unreachable".to_string(),
                    winping::Error::NetUnreachable => "Destination network unreachable".to_string(),
                    winping::Error::TtlExpired => "TTL expired in transit".to_string(),
                    other => format!("ICMP error: {}", other),
                }),
            }
        });

        match timeout(timeout_duration, ping_future).await {
            Ok(Ok(Ok(latency_ms))) => PingResult {
                target: target_str,
                success: true,
                latency_ms: Some(latency_ms),
                error: None,
            },
            Ok(Ok(Err(err_msg))) => PingResult {
                target: target_str,
                success: false,
                latency_ms: None,
                error: Some(err_msg),
            },
            Ok(Err(join_err)) => PingResult {
                target: target_str,
                success: false,
                latency_ms: None,
                error: Some(format!("Worker thread panicked: {}", join_err)),
            },
            Err(_) => PingResult {
                target: target_str,
                success: false,
                latency_ms: None,
                error: Some("Request timed out".to_string()),
            },
        }
    }

    #[cfg(not(windows))]
    {
        // Non-Windows fallback using system ping
        let timeout_secs = timeout_duration.as_secs().max(1);
        let output = tokio::process::Command::new("ping")
            .arg("-c")
            .arg("1")
            .arg("-W")
            .arg(timeout_secs.to_string())
            .arg(ip.to_string())
            .output()
            .await;

        match output {
            Ok(out) if out.status.success() => {
                let stdout = String::from_utf8_lossy(&out.stdout);
                // Attempt to parse latency from stdout (e.g. time=X ms)
                let latency_ms = stdout.lines().find_map(|line| {
                    if let Some(pos) = line.find("time=") {
                        let part = &line[pos + 5..];
                        part.split_whitespace()
                            .next()
                            .and_then(|s| s.parse::<f64>().ok())
                    } else {
                        None
                    }
                });

                PingResult {
                    target: target_str,
                    success: true,
                    latency_ms,
                    error: None,
                }
            }
            Ok(out) => PingResult {
                target: target_str,
                success: false,
                latency_ms: None,
                error: Some(format!(
                    "Ping failed with status code {}",
                    out.status.code().unwrap_or(-1)
                )),
            },
            Err(e) => PingResult {
                target: target_str,
                success: false,
                latency_ms: None,
                error: Some(format!("Failed to execute ping: {}", e)),
            },
        }
    }
}
