use serde::{Deserialize, Serialize};

/// Global network supervision settings stored in SQLite.
#[derive(Debug, Clone, sqlx::FromRow, Serialize, Deserialize)]
pub struct AppSettings {
    pub id: i64,
    pub scan_interval_secs: i64,
    pub network_timeout_ms: i64,
    pub max_concurrent_tests: i64,
    pub startup_scan: i64,
    pub updated_at: String,
}

/// Client-facing DTO for settings.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettingsDto {
    pub scan_interval_secs: u64,
    pub network_timeout_ms: u64,
    pub max_concurrent_tests: usize,
    pub startup_scan: bool,
    pub updated_at: String,
}

impl From<AppSettings> for SettingsDto {
    fn from(s: AppSettings) -> Self {
        Self {
            scan_interval_secs: s.scan_interval_secs as u64,
            network_timeout_ms: s.network_timeout_ms as u64,
            max_concurrent_tests: s.max_concurrent_tests as usize,
            startup_scan: s.startup_scan == 1,
            updated_at: s.updated_at,
        }
    }
}

/// Request payload for updating settings.
#[derive(Debug, Clone, Deserialize)]
pub struct UpdateSettingsRequest {
    pub scan_interval_secs: Option<u64>,
    pub network_timeout_ms: Option<u64>,
    pub max_concurrent_tests: Option<usize>,
    pub startup_scan: Option<bool>,
}
