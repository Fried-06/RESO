use crate::database::DeviceRepository;
use crate::error::AppError;
use crate::models::{DiscoveredDevice, DiscoveryProgress, StartDiscoveryRequest};
use crate::state::AppState;
use tauri::State;

/// Starts a subnet discovery scan (e.g. 10.28.0.0/16).
#[tauri::command]
pub async fn start_discovery(
    state: State<'_, AppState>,
    token: String,
    req: StartDiscoveryRequest,
) -> Result<(), AppError> {
    state.sessions.validate_session(&token).await?;

    // Load registered devices for cross-referencing
    let devices = DeviceRepository::find_all(&state.pool).await?;
    let registered_list = devices
        .into_iter()
        .map(|d| (d.id, d.name, d.ip_address))
        .collect();

    state
        .discovery
        .start(req, registered_list)
        .await
        .map_err(|e| AppError::Network(e))
}

/// Stops an ongoing discovery scan cleanly.
#[tauri::command]
pub async fn stop_discovery(state: State<'_, AppState>, token: String) -> Result<(), AppError> {
    state.sessions.validate_session(&token).await?;
    state.discovery.stop();
    Ok(())
}

/// Retrieves current discovery scan progress and list of detected devices.
#[tauri::command]
pub async fn get_discovery_status(
    state: State<'_, AppState>,
    token: String,
) -> Result<(DiscoveryProgress, Vec<DiscoveredDevice>), AppError> {
    state.sessions.validate_session(&token).await?;
    Ok(state.discovery.get_status().await)
}
