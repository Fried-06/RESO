use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Overall operational status of an equipment.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DeviceStatus {
    Operational,
    Degraded,
    Offline,
}

/// Real ICMP L3 Ping measurement.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PingResult {
    pub target: String,
    pub success: bool,
    pub latency_ms: Option<f64>,
    pub error: Option<String>,
}

/// Real TCP L7 connection measurement.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TcpTestResult {
    pub host: String,
    pub port: u16,
    pub success: bool,
    pub latency_ms: Option<f64>,
    pub error: Option<String>,
}

/// Real HTTP/HTTPS L7 request measurement.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HttpTestResult {
    pub url: String,
    pub status_code: Option<u16>,
    pub success: bool,
    pub latency_ms: Option<f64>,
    pub error: Option<String>,
}

/// Aggregated result of a single L7 service probe.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceProbeResult {
    pub name: String,
    pub service_type: String,
    pub port: u16,
    pub success: bool,
    pub latency_ms: Option<f64>,
    pub status_code: Option<u16>,
    pub error: Option<String>,
}

/// Full comprehensive diagnostic for an equipment.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiagnosticResult {
    pub device_id: i64,
    pub device_name: String,
    pub ip_address: String,
    pub l3_result: PingResult,
    pub l7_results: Vec<ServiceProbeResult>,
    pub overall_status: DeviceStatus,
    pub executed_at: DateTime<Utc>,
}

/// High-level network supervision overview for dashboard visualization.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkOverview {
    pub total_devices: usize,
    pub online_devices: usize,
    pub degraded_devices: usize,
    pub offline_devices: usize,
    pub scanned_at: DateTime<Utc>,
    pub results: Vec<DiagnosticResult>,
}

/// Record stored in SQLite for diagnostic history tracking.
#[derive(Debug, Clone, sqlx::FromRow, Serialize, Deserialize)]
pub struct DiagnosticHistoryRecord {
    pub id: i64,
    pub device_id: i64,
    pub overall_status: String,
    pub l3_success: i64,
    pub l3_latency_ms: Option<f64>,
    pub l3_error: Option<String>,
    pub l7_summary: String,
    pub executed_at: String,
}
