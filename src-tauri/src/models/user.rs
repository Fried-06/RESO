use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Internal SQLite user entity.
/// Note: `password_hash` is never serialized or sent to the client.
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct User {
    pub id: i64,
    pub username: String,
    pub password_hash: String,
    pub is_active: i64,
    pub created_at: String,
    pub updated_at: String,
}

/// Safe user representation exposed to the frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserDto {
    pub id: i64,
    pub username: String,
    pub is_active: bool,
    pub created_at: String,
    pub updated_at: String,
}

impl From<User> for UserDto {
    fn from(user: User) -> Self {
        Self {
            id: user.id,
            username: user.username,
            is_active: user.is_active == 1,
            created_at: user.created_at,
            updated_at: user.updated_at,
        }
    }
}

/// Request payload for creating the very first user (bootstrap).
#[derive(Debug, Clone, Deserialize)]
pub struct CreateFirstUserRequest {
    pub username: String,
    pub password: String,
}

/// Request payload for user authentication.
#[derive(Debug, Clone, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

/// Response returned on successful authentication.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthResponse {
    pub token: String,
    pub user: UserDto,
    pub expires_at: DateTime<Utc>,
}

/// Request payload for changing an existing user's password.
#[derive(Debug, Clone, Deserialize)]
pub struct ChangePasswordRequest {
    pub current_password: String,
    pub new_password: String,
}
