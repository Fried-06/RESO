use serde::{Deserialize, Serialize};

/// Type of monitored application-layer service.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ServiceType {
    Tcp,
    Http,
    Https,
}

/// Generic configuration for a monitored Layer 7 service on a device.
/// Enables monitoring any arbitrary TCP port (e.g. 22 SSH, 9100 RAW printing, 3389 RDP)
/// or HTTP/HTTPS endpoint without hardcoding specific equipment profiles in Rust.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceConfig {
    pub name: String,
    pub service_type: ServiceType,
    pub port: u16,
    #[serde(default)]
    pub target: Option<String>,
}

/// Internal SQLite device entity.
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct Device {
    pub id: i64,
    pub name: String,
    pub ip_address: String,
    pub description: Option<String>,
    pub enabled: i64,
    pub services_config: String,
    pub created_at: String,
    pub updated_at: String,
}

/// Safe, client-facing device representation with parsed service configurations.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceDto {
    pub id: i64,
    pub name: String,
    pub ip_address: String,
    pub description: Option<String>,
    pub enabled: bool,
    pub services: Vec<ServiceConfig>,
    pub created_at: String,
    pub updated_at: String,
}

impl Device {
    /// Converts a database row to a client-facing `DeviceDto`.
    pub fn to_dto(&self) -> DeviceDto {
        let services: Vec<ServiceConfig> =
            serde_json::from_str(&self.services_config).unwrap_or_default();

        DeviceDto {
            id: self.id,
            name: self.name.clone(),
            ip_address: self.ip_address.clone(),
            description: self.description.clone(),
            enabled: self.enabled == 1,
            services,
            created_at: self.created_at.clone(),
            updated_at: self.updated_at.clone(),
        }
    }
}

/// Request payload for creating a new network device.
#[derive(Debug, Clone, Deserialize)]
pub struct CreateDeviceRequest {
    pub name: String,
    pub ip_address: String,
    pub description: Option<String>,
    #[serde(default = "default_true")]
    pub enabled: bool,
    #[serde(default)]
    pub services: Vec<ServiceConfig>,
}

/// Request payload for updating an existing network device.
#[derive(Debug, Clone, Deserialize)]
pub struct UpdateDeviceRequest {
    pub name: Option<String>,
    pub ip_address: Option<String>,
    pub description: Option<String>,
    pub enabled: Option<bool>,
    pub services: Option<Vec<ServiceConfig>>,
}

fn default_true() -> bool {
    true
}
