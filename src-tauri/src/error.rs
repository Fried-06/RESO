use serde::{Deserialize, Serialize};
use std::net::IpAddr;
use thiserror::Error;
use url::Url;

/// Centralized application errors for the backend.
/// Designed to be serialized to a clean JSON object for the React frontend.
#[derive(Debug, Error)]
pub enum AppError {
    #[error("Database error: {0}")]
    Database(String),

    #[error("Authentication error: {0}")]
    Auth(String),

    #[error("Validation error: {0}")]
    Validation(String),

    #[error("Network error: {0}")]
    Network(String),

    #[error("Resource not found: {0}")]
    NotFound(String),

    #[error("Unauthorized: valid active session required")]
    Unauthorized,

    #[error("Bootstrap required: no administrator account exists yet")]
    BootstrapRequired,

    #[error("Bootstrap already completed: initial account has already been created")]
    BootstrapAlreadyCompleted,

    #[error("Internal server error: {0}")]
    Internal(String),
}

/// Serializable error representation sent over the Tauri IPC boundary.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorPayload {
    pub code: String,
    pub message: String,
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        let payload = match self {
            AppError::Database(msg) => ErrorPayload {
                code: "DATABASE_ERROR".to_string(),
                message: msg.clone(),
            },
            AppError::Auth(msg) => ErrorPayload {
                code: "AUTH_ERROR".to_string(),
                message: msg.clone(),
            },
            AppError::Validation(msg) => ErrorPayload {
                code: "VALIDATION_ERROR".to_string(),
                message: msg.clone(),
            },
            AppError::Network(msg) => ErrorPayload {
                code: "NETWORK_ERROR".to_string(),
                message: msg.clone(),
            },
            AppError::NotFound(msg) => ErrorPayload {
                code: "NOT_FOUND".to_string(),
                message: msg.clone(),
            },
            AppError::Unauthorized => ErrorPayload {
                code: "UNAUTHORIZED".to_string(),
                message: "Authentication required or session expired".to_string(),
            },
            AppError::BootstrapRequired => ErrorPayload {
                code: "BOOTSTRAP_REQUIRED".to_string(),
                message: "Initial account setup required".to_string(),
            },
            AppError::BootstrapAlreadyCompleted => ErrorPayload {
                code: "BOOTSTRAP_ALREADY_COMPLETED".to_string(),
                message: "Initial user setup has already been completed".to_string(),
            },
            AppError::Internal(msg) => ErrorPayload {
                code: "INTERNAL_ERROR".to_string(),
                message: msg.clone(),
            },
        };
        payload.serialize(serializer)
    }
}

impl From<sqlx::Error> for AppError {
    fn from(err: sqlx::Error) -> Self {
        AppError::Database(err.to_string())
    }
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/// Validates an IPv4, IPv6 address or a valid hostname/domain.
pub fn validate_ip_or_hostname(target: &str) -> Result<(), AppError> {
    let trimmed = target.trim();
    if trimmed.is_empty() {
        return Err(AppError::Validation(
            "Target IP address or hostname cannot be empty".to_string(),
        ));
    }

    // Check if valid IP address
    if trimmed.parse::<IpAddr>().is_ok() {
        return Ok(());
    }

    // Otherwise validate as a hostname (RFC 1123 compliant characters)
    if trimmed.len() > 253 {
        return Err(AppError::Validation(
            "Hostname length exceeds 253 characters".to_string(),
        ));
    }

    let is_valid_hostname = trimmed.split('.').all(|label| {
        !label.is_empty()
            && label.len() <= 63
            && label.chars().all(|c| c.is_alphanumeric() || c == '-')
            && !label.starts_with('-')
            && !label.ends_with('-')
    });

    if is_valid_hostname {
        Ok(())
    } else {
        Err(AppError::Validation(format!(
            "Invalid IP address or hostname format: '{}'",
            target
        )))
    }
}

/// Validates a TCP port number.
pub fn validate_port(port: u16) -> Result<(), AppError> {
    if port == 0 {
        Err(AppError::Validation(
            "Port 0 is reserved and invalid for network services".to_string(),
        ))
    } else {
        Ok(())
    }
}

/// Validates a URL for HTTP / HTTPS testing.
pub fn validate_http_url(raw_url: &str) -> Result<Url, AppError> {
    let parsed = Url::parse(raw_url)
        .map_err(|e| AppError::Validation(format!("Invalid URL '{}': {}", raw_url, e)))?;

    match parsed.scheme() {
        "http" | "https" => Ok(parsed),
        scheme => Err(AppError::Validation(format!(
            "Unsupported protocol '{}': only HTTP and HTTPS are permitted",
            scheme
        ))),
    }
}

/// Validates username format.
pub fn validate_username(username: &str) -> Result<(), AppError> {
    let trimmed = username.trim();
    if trimmed.len() < 3 || trimmed.len() > 32 {
        return Err(AppError::Validation(
            "Username must be between 3 and 32 characters long".to_string(),
        ));
    }
    if !trimmed
        .chars()
        .all(|c| c.is_alphanumeric() || c == '_' || c == '-')
    {
        return Err(AppError::Validation(
            "Username may only contain letters, digits, underscores, and hyphens".to_string(),
        ));
    }
    Ok(())
}

/// Validates password complexity.
pub fn validate_password(password: &str) -> Result<(), AppError> {
    if password.len() < 8 {
        return Err(AppError::Validation(
            "Password must be at least 8 characters long".to_string(),
        ));
    }
    if password.len() > 128 {
        return Err(AppError::Validation(
            "Password cannot exceed 128 characters".to_string(),
        ));
    }
    Ok(())
}

/// Validates device name.
pub fn validate_device_name(name: &str) -> Result<(), AppError> {
    let trimmed = name.trim();
    if trimmed.is_empty() || trimmed.len() > 64 {
        return Err(AppError::Validation(
            "Device name must be between 1 and 64 characters".to_string(),
        ));
    }
    Ok(())
}
