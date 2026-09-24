use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Role of an authenticated user.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum UserRole {
    Admin,
    Operator,
}

impl Default for UserRole {
    fn default() -> Self {
        UserRole::Operator
    }
}

impl ToString for UserRole {
    fn to_string(&self) -> String {
        match self {
            UserRole::Admin => "admin".to_string(),
            UserRole::Operator => "operator".to_string(),
        }
    }
}

impl From<&str> for UserRole {
    fn from(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "admin" => UserRole::Admin,
            _ => UserRole::Operator,
        }
    }
}

/// Internal SQLite user entity.
/// Note: `password_hash` is never serialized or sent to the client.
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct User {
    pub id: i64,
    pub username: String,
    pub password_hash: String,
    pub role: String,
    pub is_active: i64,
    pub created_at: String,
    pub updated_at: String,
}

/// Safe user representation exposed to the frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserDto {
    pub id: i64,
    pub username: String,
    pub role: UserRole,
    pub is_active: bool,
    pub created_at: String,
    pub updated_at: String,
}

impl From<User> for UserDto {
    fn from(user: User) -> Self {
        Self {
            id: user.id,
            username: user.username,
            role: UserRole::from(user.role.as_str()),
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

/// Request payload for creating a new user by an administrator.
#[derive(Debug, Clone, Deserialize)]
pub struct AdminCreateUserRequest {
    pub username: String,
    pub password: String,
    pub role: Option<UserRole>,
}

/// Request payload for updating a user by an administrator.
#[derive(Debug, Clone, Deserialize)]
pub struct AdminUpdateUserRequest {
    pub username: Option<String>,
    pub role: Option<UserRole>,
    pub password: Option<String>,
    pub is_active: Option<bool>,
}
