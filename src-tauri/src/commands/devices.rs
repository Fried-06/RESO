use crate::error::AppError;
use crate::models::{CreateDeviceRequest, DeviceDto, UpdateDeviceRequest};
use crate::services::DeviceService;
use crate::state::AppState;
use tauri::State;

/// Creates a new network device (requires valid session).
#[tauri::command]
pub async fn create_device(
    state: State<'_, AppState>,
    token: String,
    req: CreateDeviceRequest,
) -> Result<DeviceDto, AppError> {
    state.sessions.validate_session(&token).await?;
    DeviceService::create_device(&state.pool, req).await
}

/// Retrieves all network devices (requires valid session).
#[tauri::command]
pub async fn get_devices(
    state: State<'_, AppState>,
    token: String,
) -> Result<Vec<DeviceDto>, AppError> {
    state.sessions.validate_session(&token).await?;
    DeviceService::get_devices(&state.pool).await
}

/// Retrieves a single network device by ID (requires valid session).
#[tauri::command]
pub async fn get_device(
    state: State<'_, AppState>,
    token: String,
    id: i64,
) -> Result<DeviceDto, AppError> {
    state.sessions.validate_session(&token).await?;
    DeviceService::get_device(&state.pool, id).await
}

/// Updates an existing network device (requires valid session).
#[tauri::command]
pub async fn update_device(
    state: State<'_, AppState>,
    token: String,
    id: i64,
    req: UpdateDeviceRequest,
) -> Result<DeviceDto, AppError> {
    state.sessions.validate_session(&token).await?;
    DeviceService::update_device(&state.pool, id, req).await
}

/// Deletes an existing network device (requires valid session).
#[tauri::command]
pub async fn delete_device(
    state: State<'_, AppState>,
    token: String,
    id: i64,
) -> Result<(), AppError> {
    state.sessions.validate_session(&token).await?;
    DeviceService::delete_device(&state.pool, id).await
}
