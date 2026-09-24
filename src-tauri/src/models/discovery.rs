use serde::{Deserialize, Serialize};

/// Item discovered on the network during subnet scan.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveredDevice {
    pub ip_address: String,
    pub hostname: Option<String>,
    pub mac_address: Option<String>,
    pub response_time_ms: Option<f64>,
    pub is_registered: bool,
    pub registered_device_id: Option<i64>,
    pub registered_device_name: Option<String>,
}

/// Progress state of the network discovery process.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveryProgress {
    pub subnet: String,
    pub is_running: bool,
    pub total_targets: u32,
    pub scanned_targets: u32,
    pub found_count: usize,
    pub current_ip: Option<String>,
    pub error: Option<String>,
}

/// Request to start a subnet discovery.
#[derive(Debug, Clone, Deserialize)]
pub struct StartDiscoveryRequest {
    pub subnet: Option<String>, // e.g. "10.28.0.0/16" or a smaller range
    pub max_concurrency: Option<usize>,
    pub timeout_ms: Option<u64>,
}
