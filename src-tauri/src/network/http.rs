use crate::error::validate_http_url;
use crate::models::HttpTestResult;
use std::time::{Duration, Instant};

/// Tests real Layer 7 HTTP/HTTPS service availability.
/// Clearly differentiates between:
/// - "Machine joignable" (L3/TCP level reachability)
/// - "Service applicatif fonctionnel" (Application responding with 2xx/3xx HTTP status).
///
/// If a server returns 500 or 503, the host is reachable, but the application service is failing.
pub async fn test_http_endpoint(
    client: &reqwest::Client,
    raw_url: &str,
    timeout_duration: Duration,
) -> HttpTestResult {
    let url_str = raw_url.to_string();

    let parsed_url = match validate_http_url(raw_url) {
        Ok(u) => u,
        Err(e) => {
            return HttpTestResult {
                url: url_str,
                status_code: None,
                success: false,
                latency_ms: None,
                error: Some(e.to_string()),
            };
        }
    };

    let start_time = Instant::now();

    // Execute HTTP request (GET) with configurable timeout
    let response_result = client
        .get(parsed_url)
        .timeout(timeout_duration)
        .send()
        .await;

    let latency_ms = start_time.elapsed().as_secs_f64() * 1000.0;

    match response_result {
        Ok(response) => {
            let status = response.status();
            let status_code = status.as_u16();
            let is_success = status.is_success() || status.is_redirection();

            let error = if !is_success {
                Some(format!(
                    "HTTP service returned non-success status code: {} ({})",
                    status_code,
                    status.canonical_reason().unwrap_or("Unknown")
                ))
            } else {
                None
            };

            HttpTestResult {
                url: url_str,
                status_code: Some(status_code),
                success: is_success,
                latency_ms: Some(latency_ms),
                error,
            }
        }
        Err(err) => {
            let error_msg = if err.is_timeout() {
                format!(
                    "HTTP request timed out after {} ms",
                    timeout_duration.as_millis()
                )
            } else if err.is_connect() {
                "Failed to establish TCP/TLS connection to HTTP server".to_string()
            } else {
                format!("HTTP request error: {}", err)
            };

            HttpTestResult {
                url: url_str,
                status_code: None,
                success: false,
                latency_ms: None,
                error: Some(error_msg),
            }
        }
    }
}
