use crate::error::AppError;
use crate::models::{SettingsDto, UpdateSettingsRequest};
use crate::services::SettingsService;
use crate::state::AppState;
use tauri::State;

/// Retrieves current application settings (requires session).
#[tauri::command]
pub async fn get_settings(
    state: State<'_, AppState>,
    token: String,
) -> Result<SettingsDto, AppError> {
    state.sessions.validate_session(&token).await?;
    SettingsService::get_settings(&state.pool).await
}

/// Updates application settings (requires session).
#[tauri::command]
pub async fn update_settings(
    state: State<'_, AppState>,
    token: String,
    req: UpdateSettingsRequest,
) -> Result<SettingsDto, AppError> {
    state.sessions.validate_session(&token).await?;
    SettingsService::update_settings(&state.pool, req).await
}
