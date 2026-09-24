use crate::error::AppError;
use crate::models::{AlertDto, AlertSummary};
use crate::services::AlertService;
use crate::state::AppState;
use tauri::State;

/// Retrieves list of system alerts.
#[tauri::command]
pub async fn get_alerts(
    state: State<'_, AppState>,
    token: String,
    unresolved_only: Option<bool>,
    limit: Option<i64>,
) -> Result<Vec<AlertDto>, AppError> {
    state.sessions.validate_session(&token).await?;
    AlertService::get_alerts(&state.pool, unresolved_only.unwrap_or(false), limit).await
}

/// Retrieves summary statistics of alerts (unread, unresolved, critical).
#[tauri::command]
pub async fn get_alert_summary(
    state: State<'_, AppState>,
    token: String,
) -> Result<AlertSummary, AppError> {
    state.sessions.validate_session(&token).await?;
    AlertService::get_summary(&state.pool).await
}

/// Marks a single alert as read.
#[tauri::command]
pub async fn mark_alert_as_read(
    state: State<'_, AppState>,
    token: String,
    alert_id: i64,
) -> Result<(), AppError> {
    state.sessions.validate_session(&token).await?;
    AlertService::mark_as_read(&state.pool, alert_id).await
}

/// Marks all unread alerts as read.
#[tauri::command]
pub async fn mark_all_alerts_as_read(
    state: State<'_, AppState>,
    token: String,
) -> Result<(), AppError> {
    state.sessions.validate_session(&token).await?;
    AlertService::mark_all_as_read(&state.pool).await
}

/// Manually marks an alert as resolved.
#[tauri::command]
pub async fn mark_alert_as_resolved(
    state: State<'_, AppState>,
    token: String,
    alert_id: i64,
) -> Result<(), AppError> {
    state.sessions.validate_session(&token).await?;
    AlertService::mark_as_resolved(&state.pool, alert_id).await
}
