use crate::error::AppError;
use crate::models::{AdminCreateUserRequest, AdminUpdateUserRequest, UserDto};
use crate::services::UserService;
use crate::state::AppState;
use tauri::State;

/// Retrieves the list of all user accounts. Strictly reserved for administrators.
#[tauri::command]
pub async fn get_users(
    state: State<'_, AppState>,
    token: String,
) -> Result<Vec<UserDto>, AppError> {
    state.sessions.validate_admin_session(&token).await?;
    UserService::get_all_users(&state.pool).await
}

/// Creates a new user account with specified role. Strictly reserved for administrators.
#[tauri::command]
pub async fn admin_create_user(
    state: State<'_, AppState>,
    token: String,
    req: AdminCreateUserRequest,
) -> Result<UserDto, AppError> {
    state.sessions.validate_admin_session(&token).await?;
    UserService::create_user(&state.pool, req).await
}

/// Updates an existing user account. Strictly reserved for administrators.
#[tauri::command]
pub async fn admin_update_user(
    state: State<'_, AppState>,
    token: String,
    user_id: i64,
    req: AdminUpdateUserRequest,
) -> Result<UserDto, AppError> {
    state.sessions.validate_admin_session(&token).await?;
    UserService::update_user(&state.pool, user_id, req).await
}

/// Deletes a user account. Strictly reserved for administrators.
/// Prevents deleting self and prevents deleting the last administrator.
#[tauri::command]
pub async fn admin_delete_user(
    state: State<'_, AppState>,
    token: String,
    user_id: i64,
) -> Result<(), AppError> {
    let session = state.sessions.validate_admin_session(&token).await?;
    UserService::delete_user(&state.pool, session.user_id, user_id).await
}
