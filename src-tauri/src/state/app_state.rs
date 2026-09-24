use crate::error::AppError;
use crate::models::UserRole;
use crate::network::discovery::DiscoveryController;
use chrono::{DateTime, Duration, Utc};
use sqlx::SqlitePool;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

/// Active user session metadata stored strictly in memory (no secrets or passwords).
#[derive(Debug, Clone)]
pub struct SessionInfo {
    pub user_id: i64,
    pub username: String,
    pub role: UserRole,
    pub created_at: DateTime<Utc>,
    pub last_active_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
}

/// Thread-safe in-memory session manager for local desktop authentication.
pub struct SessionManager {
    sessions: RwLock<HashMap<String, SessionInfo>>,
    session_timeout: Duration,
}

impl SessionManager {
    pub fn new(timeout_hours: i64) -> Self {
        Self {
            sessions: RwLock::new(HashMap::new()),
            session_timeout: Duration::hours(timeout_hours),
        }
    }

    /// Creates a new cryptographically random session token for a validated user.
    pub async fn create_session(
        &self,
        user_id: i64,
        username: &str,
        role: UserRole,
    ) -> (String, DateTime<Utc>) {
        let token = Uuid::new_v4().to_string();
        let now = Utc::now();
        let expires_at = now + self.session_timeout;

        let info = SessionInfo {
            user_id,
            username: username.to_string(),
            role,
            created_at: now,
            last_active_at: now,
            expires_at,
        };

        let mut lock = self.sessions.write().await;
        lock.insert(token.clone(), info);

        (token, expires_at)
    }

    /// Validates an active session token and refreshes last_active_at.
    pub async fn validate_session(&self, token: &str) -> Result<SessionInfo, AppError> {
        let now = Utc::now();
        let mut lock = self.sessions.write().await;

        if let Some(session) = lock.get_mut(token) {
            if session.expires_at < now {
                // Token has expired
                lock.remove(token);
                Err(AppError::Unauthorized)
            } else {
                session.last_active_at = now;
                Ok(session.clone())
            }
        } else {
            Err(AppError::Unauthorized)
        }
    }

    /// Validates that an active session belongs to an administrator.
    pub async fn validate_admin_session(&self, token: &str) -> Result<SessionInfo, AppError> {
        let session = self.validate_session(token).await?;
        if session.role != UserRole::Admin {
            return Err(AppError::Auth(
                "Action réservée exclusivement aux administrateurs de l'application".to_string(),
            ));
        }
        Ok(session)
    }

    /// Invalidates and removes a session token (e.g. on logout).
    pub async fn invalidate_session(&self, token: &str) {
        let mut lock = self.sessions.write().await;
        lock.remove(token);
    }
}

/// Global shared state of the ASECNA Network Monitor application.
pub struct AppState {
    pub pool: SqlitePool,
    pub sessions: Arc<SessionManager>,
    pub http_client: reqwest::Client,
    pub discovery: Arc<DiscoveryController>,
}

impl AppState {
    pub fn new(pool: SqlitePool) -> Self {
        let http_client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(5))
            .redirect(reqwest::redirect::Policy::limited(3))
            .build()
            .expect("Failed to initialize HTTP client");

        Self {
            pool,
            sessions: Arc::new(SessionManager::new(8)), // 8 hours session timeout
            http_client,
            discovery: Arc::new(DiscoveryController::new()),
        }
    }
}
