use crate::database::UserRepository;
use crate::error::{validate_password, validate_username, AppError};
use crate::models::{
    AuthResponse, ChangePasswordRequest, CreateFirstUserRequest, LoginRequest, UserDto,
};
use crate::state::SessionManager;
use argon2::password_hash::rand_core::OsRng;
use argon2::password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use argon2::Argon2;
use sqlx::SqlitePool;
use std::sync::Arc;

pub struct AuthService;

impl AuthService {
    /// Computes a secure Argon2id hash with a cryptographically secure random salt.
    pub fn hash_password(password: &str) -> Result<String, AppError> {
        validate_password(password)?;
        let salt = SaltString::generate(&mut OsRng);
        let argon2 = Argon2::default();
        let hash = argon2
            .hash_password(password.as_bytes(), &salt)
            .map_err(|e| AppError::Internal(format!("Password hashing failed: {}", e)))?
            .to_string();
        Ok(hash)
    }

    /// Verifies a plain text password against an Argon2 hash.
    pub fn verify_password(password: &str, password_hash: &str) -> Result<bool, AppError> {
        let parsed_hash = PasswordHash::new(password_hash)
            .map_err(|e| AppError::Internal(format!("Invalid password hash: {}", e)))?;
        Ok(Argon2::default()
            .verify_password(password.as_bytes(), &parsed_hash)
            .is_ok())
    }

    /// Checks if the application requires initial administrator setup.
    pub async fn is_bootstrap_required(pool: &SqlitePool) -> Result<bool, AppError> {
        let count = UserRepository::count(pool).await?;
        Ok(count == 0)
    }

    /// Creates the very first administrator account.
    /// Strictly allowed ONLY when SQLite contains zero users.
    pub async fn create_first_user(
        pool: &SqlitePool,
        sessions: &Arc<SessionManager>,
        req: CreateFirstUserRequest,
    ) -> Result<AuthResponse, AppError> {
        let user_count = UserRepository::count(pool).await?;
        if user_count > 0 {
            return Err(AppError::BootstrapAlreadyCompleted);
        }

        validate_username(&req.username)?;
        let password_hash = Self::hash_password(&req.password)?;

        let user = UserRepository::create(pool, &req.username, &password_hash, crate::models::UserRole::Admin).await?;
        let (token, expires_at) = sessions.create_session(user.id, &user.username, crate::models::UserRole::Admin).await;

        Ok(AuthResponse {
            token,
            user: user.into(),
            expires_at,
        })
    }

    /// Authenticates an existing user and creates an in-memory session.
    pub async fn login(
        pool: &SqlitePool,
        sessions: &Arc<SessionManager>,
        req: LoginRequest,
    ) -> Result<AuthResponse, AppError> {
        validate_username(&req.username)?;

        let user = UserRepository::find_by_username(pool, &req.username)
            .await?
            .ok_or_else(|| AppError::Auth("Invalid username or password".to_string()))?;

        if user.is_active == 0 {
            return Err(AppError::Auth("User account is disabled".to_string()));
        }

        let is_valid = Self::verify_password(&req.password, &user.password_hash)?;
        if !is_valid {
            return Err(AppError::Auth("Invalid username or password".to_string()));
        }

        let role = crate::models::UserRole::from(user.role.as_str());
        let (token, expires_at) = sessions.create_session(user.id, &user.username, role).await;

        Ok(AuthResponse {
            token,
            user: user.into(),
            expires_at,
        })
    }

    /// Logs out a user by invalidating the active session token.
    pub async fn logout(sessions: &Arc<SessionManager>, token: &str) {
        sessions.invalidate_session(token).await;
    }

    /// Resolves the currently authenticated user from a session token.
    pub async fn get_current_user(
        pool: &SqlitePool,
        sessions: &Arc<SessionManager>,
        token: &str,
    ) -> Result<UserDto, AppError> {
        let session = sessions.validate_session(token).await?;
        let user = UserRepository::find_by_id(pool, session.user_id)
            .await?
            .ok_or_else(|| {
                AppError::NotFound("Authenticated user not found in database".to_string())
            })?;

        Ok(user.into())
    }

    /// Updates password for the currently authenticated user.
    pub async fn change_password(
        pool: &SqlitePool,
        sessions: &Arc<SessionManager>,
        token: &str,
        req: ChangePasswordRequest,
    ) -> Result<(), AppError> {
        let session = sessions.validate_session(token).await?;

        let user = UserRepository::find_by_id(pool, session.user_id)
            .await?
            .ok_or_else(|| AppError::NotFound("User not found".to_string()))?;

        let current_valid = Self::verify_password(&req.current_password, &user.password_hash)?;
        if !current_valid {
            return Err(AppError::Auth("Current password is incorrect".to_string()));
        }

        let new_hash = Self::hash_password(&req.new_password)?;
        UserRepository::update_password(pool, session.user_id, &new_hash).await?;

        Ok(())
    }
}
