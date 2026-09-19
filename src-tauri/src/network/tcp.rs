use crate::error::{validate_ip_or_hostname, validate_port};
use crate::models::TcpTestResult;
use std::io::ErrorKind;
use std::net::SocketAddr;
use std::time::{Duration, Instant};
use tokio::net::TcpStream;
use tokio::time::timeout;

/// Tests real Layer 7 TCP availability by attempting a three-way TCP handshake.
/// Distinguishes:
/// - Port open (SYN-ACK received, handshake complete)
/// - Port closed (RST packet received, ConnectionRefused)
/// - Timed out (SYN dropped, host down, or filtered by firewall)
/// - Unreachable host / network
/// - DNS failure or invalid address
pub async fn test_tcp_connection(
    host: &str,
    port: u16,
    timeout_duration: Duration,
) -> TcpTestResult {
    let host_str = host.to_string();

    if let Err(e) = validate_ip_or_hostname(host) {
        return TcpTestResult {
            host: host_str,
            port,
            success: false,
            latency_ms: None,
            error: Some(e.to_string()),
        };
    }

    if let Err(e) = validate_port(port) {
        return TcpTestResult {
            host: host_str,
            port,
            success: false,
            latency_ms: None,
            error: Some(e.to_string()),
        };
    }

    // Resolve socket address
    let target = format!("{}:{}", host, port);
    let socket_addrs = match tokio::net::lookup_host(&target).await {
        Ok(addrs) => addrs.collect::<Vec<SocketAddr>>(),
        Err(e) => {
            return TcpTestResult {
                host: host_str,
                port,
                success: false,
                latency_ms: None,
                error: Some(format!("DNS resolution failed for '{}': {}", target, e)),
            };
        }
    };

    if socket_addrs.is_empty() {
        return TcpTestResult {
            host: host_str,
            port,
            success: false,
            latency_ms: None,
            error: Some(format!("No IP address found for host '{}'", host)),
        };
    }

    let start_time = Instant::now();

    // Try connecting with bounded timeout
    let connect_future = TcpStream::connect(&socket_addrs[0]);
    match timeout(timeout_duration, connect_future).await {
        Ok(Ok(_stream)) => {
            // Handshake succeeded!
            let latency_ms = start_time.elapsed().as_secs_f64() * 1000.0;
            TcpTestResult {
                host: host_str,
                port,
                success: true,
                latency_ms: Some(latency_ms),
                error: None,
            }
        }
        Ok(Err(io_err)) => {
            let error_msg = match io_err.kind() {
                ErrorKind::ConnectionRefused => {
                    "Port closed (connection refused by host)".to_string()
                }
                ErrorKind::TimedOut => "Connection timed out".to_string(),
                ErrorKind::ConnectionReset => "Connection reset by peer".to_string(),
                ErrorKind::NetworkUnreachable => "Network unreachable".to_string(),
                ErrorKind::HostUnreachable => "Host unreachable".to_string(),
                _ => format!("TCP connection error: {}", io_err),
            };

            TcpTestResult {
                host: host_str,
                port,
                success: false,
                latency_ms: None,
                error: Some(error_msg),
            }
        }
        Err(_) => {
            // Timeout elapsed
            TcpTestResult {
                host: host_str,
                port,
                success: false,
                latency_ms: None,
                error: Some(format!(
                    "Connection attempt timed out after {} ms",
                    timeout_duration.as_millis()
                )),
            }
        }
    }
}
