use crate::error::AppError;
use crate::models::{
    DiagnosticHistoryRecord, DiagnosticResult, HttpTestResult, NetworkOverview, PingResult,
    TcpTestResult,
};
use crate::services::DiagnosticService;
use crate::state::AppState;
use tauri::State;

/// Runs an ad-hoc Layer 3 ICMP ping test.
#[tauri::command]
pub async fn run_ping(target: String, timeout_ms: Option<u64>) -> Result<PingResult, AppError> {
    let timeout = timeout_ms.unwrap_or(3000);
    Ok(DiagnosticService::run_ping(&target, timeout).await)
}

/// Runs an ad-hoc Layer 7 TCP connection test.
#[tauri::command]
pub async fn run_tcp_test(
    host: String,
    port: u16,
    timeout_ms: Option<u64>,
) -> Result<TcpTestResult, AppError> {
    let timeout = timeout_ms.unwrap_or(3000);
    Ok(DiagnosticService::run_tcp_test(&host, port, timeout).await)
}

/// Runs an ad-hoc Layer 7 HTTP/HTTPS endpoint test.
#[tauri::command]
pub async fn run_http_test(
    state: State<'_, AppState>,
    url: String,
    timeout_ms: Option<u64>,
) -> Result<HttpTestResult, AppError> {
    let timeout = timeout_ms.unwrap_or(5000);
    Ok(DiagnosticService::run_http_test(&state.http_client, &url, timeout).await)
}

/// Runs a full diagnostic (L3 + L7) on a configured device (requires session).
#[tauri::command]
pub async fn run_device_diagnostic(
    state: State<'_, AppState>,
    token: String,
    device_id: i64,
) -> Result<DiagnosticResult, AppError> {
    state.sessions.validate_session(&token).await?;
    DiagnosticService::run_device_diagnostic(&state.pool, &state.http_client, device_id).await
}

/// Runs concurrent diagnostics on all enabled devices and returns dashboard overview (requires session).
#[tauri::command]
pub async fn get_network_overview(
    state: State<'_, AppState>,
    token: String,
) -> Result<NetworkOverview, AppError> {
    state.sessions.validate_session(&token).await?;
    DiagnosticService::get_network_overview(&state.pool, &state.http_client).await
}

/// Retrieves diagnostic history records for a device (requires session).
#[tauri::command]
pub async fn get_device_history(
    state: State<'_, AppState>,
    token: String,
    device_id: i64,
    limit: Option<i64>,
) -> Result<Vec<DiagnosticHistoryRecord>, AppError> {
    state.sessions.validate_session(&token).await?;
    DiagnosticService::get_device_history(&state.pool, device_id, limit).await
}
