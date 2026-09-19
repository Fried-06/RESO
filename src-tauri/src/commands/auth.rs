use crate::error::AppError;
use crate::models::{
    AuthResponse, ChangePasswordRequest, CreateFirstUserRequest, LoginRequest, UserDto,
};
use crate::services::AuthService;
use crate::state::AppState;
use tauri::State;

/// Checks if initial account bootstrap is required (no users in SQLite).
#[tauri::command]
pub async fn is_bootstrap_required(state: State<'_, AppState>) -> Result<bool, AppError> {
    AuthService::is_bootstrap_required(&state.pool).await
}

/// Creates the very first administrator user when SQLite is empty.
#[tauri::command]
pub async fn create_first_user(
    state: State<'_, AppState>,
    req: CreateFirstUserRequest,
) -> Result<AuthResponse, AppError> {
    AuthService::create_first_user(&state.pool, &state.sessions, req).await
}

/// Authenticates an existing user and returns an in-memory session token.
#[tauri::command]
pub async fn login(
    state: State<'_, AppState>,
    req: LoginRequest,
) -> Result<AuthResponse, AppError> {
    AuthService::login(&state.pool, &state.sessions, req).await
}

/// Invalidates an active user session.
#[tauri::command]
pub async fn logout(state: State<'_, AppState>, token: String) -> Result<(), AppError> {
    AuthService::logout(&state.sessions, &token).await;
    Ok(())
}

/// Gets the currently authenticated user profile.
#[tauri::command]
pub async fn get_current_user(
    state: State<'_, AppState>,
    token: String,
) -> Result<UserDto, AppError> {
    AuthService::get_current_user(&state.pool, &state.sessions, &token).await
}

/// Changes the password of the currently authenticated user.
#[tauri::command]
pub async fn change_password(
    state: State<'_, AppState>,
    token: String,
    req: ChangePasswordRequest,
) -> Result<(), AppError> {
    AuthService::change_password(&state.pool, &state.sessions, &token, req).await
}
