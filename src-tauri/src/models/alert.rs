use serde::{Deserialize, Serialize};

/// Severity level of an alert.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AlertSeverity {
    Critical,
    Warning,
    Info,
}

impl ToString for AlertSeverity {
    fn to_string(&self) -> String {
        match self {
            AlertSeverity::Critical => "critical".to_string(),
            AlertSeverity::Warning => "warning".to_string(),
            AlertSeverity::Info => "info".to_string(),
        }
    }
}

impl From<&str> for AlertSeverity {
    fn from(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "critical" => AlertSeverity::Critical,
            "warning" => AlertSeverity::Warning,
            _ => AlertSeverity::Info,
        }
    }
}

/// Alert type category.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AlertType {
    DeviceUnreachable,
    ServiceDegraded,
    LatencySpike,
    ServiceRestored,
}

impl ToString for AlertType {
    fn to_string(&self) -> String {
        match self {
            AlertType::DeviceUnreachable => "device_unreachable".to_string(),
            AlertType::ServiceDegraded => "service_degraded".to_string(),
            AlertType::LatencySpike => "latency_spike".to_string(),
            AlertType::ServiceRestored => "service_restored".to_string(),
        }
    }
}

impl From<&str> for AlertType {
    fn from(s: &str) -> Self {
        match s {
            "device_unreachable" => AlertType::DeviceUnreachable,
            "service_degraded" => AlertType::ServiceDegraded,
            "latency_spike" => AlertType::LatencySpike,
            "service_restored" => AlertType::ServiceRestored,
            _ => AlertType::DeviceUnreachable,
        }
    }
}

/// SQLite Alert entity.
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct Alert {
    pub id: i64,
    pub device_id: i64,
    pub alert_type: String,
    pub severity: String,
    pub message: String,
    pub is_read: i64,
    pub is_resolved: i64,
    pub created_at: String,
    pub resolved_at: Option<String>,
}

/// Alert DTO exposed to the frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlertDto {
    pub id: i64,
    pub device_id: i64,
    pub device_name: Option<String>,
    pub device_ip: Option<String>,
    pub alert_type: AlertType,
    pub severity: AlertSeverity,
    pub message: String,
    pub is_read: bool,
    pub is_resolved: bool,
    pub created_at: String,
    pub resolved_at: Option<String>,
}

/// Summary counts of alerts.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlertSummary {
    pub unread_count: i64,
    pub unresolved_count: i64,
    pub critical_count: i64,
}
