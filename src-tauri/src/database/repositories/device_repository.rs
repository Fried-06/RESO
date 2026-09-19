use crate::error::AppError;
use crate::models::{CreateDeviceRequest, Device, DiagnosticHistoryRecord, UpdateDeviceRequest};
use chrono::Utc;
use sqlx::SqlitePool;

pub struct DeviceRepository;

impl DeviceRepository {
    /// Inserts a new generic network device into SQLite.
    pub async fn create(pool: &SqlitePool, req: &CreateDeviceRequest) -> Result<Device, AppError> {
        let now = Utc::now().to_rfc3339();
        let services_json = serde_json::to_string(&req.services).map_err(|e| {
            AppError::Internal(format!("Failed to serialize services config: {}", e))
        })?;

        let id = sqlx::query(
            r#"
            INSERT INTO devices (name, ip_address, description, enabled, services_config, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
            "#,
        )
        .bind(&req.name)
        .bind(&req.ip_address)
        .bind(&req.description)
        .bind(if req.enabled { 1 } else { 0 })
        .bind(&services_json)
        .bind(&now)
        .bind(&now)
        .execute(pool)
        .await
        .map_err(|e| AppError::Database(format!("Failed to insert device: {}", e)))?
        .last_insert_rowid();

        Ok(Device {
            id,
            name: req.name.clone(),
            ip_address: req.ip_address.clone(),
            description: req.description.clone(),
            enabled: if req.enabled { 1 } else { 0 },
            services_config: services_json,
            created_at: now.clone(),
            updated_at: now,
        })
    }

    /// Fetches all devices ordered by name.
    pub async fn find_all(pool: &SqlitePool) -> Result<Vec<Device>, AppError> {
        let devices = sqlx::query_as::<_, Device>(
            r#"
            SELECT id, name, ip_address, description, enabled, services_config, created_at, updated_at
            FROM devices
            ORDER BY id ASC
            "#,
        )
        .fetch_all(pool)
        .await
        .map_err(|e| AppError::Database(format!("Failed to query devices: {}", e)))?;

        Ok(devices)
    }

    /// Fetches a device by ID.
    pub async fn find_by_id(pool: &SqlitePool, id: i64) -> Result<Option<Device>, AppError> {
        let device = sqlx::query_as::<_, Device>(
            r#"
            SELECT id, name, ip_address, description, enabled, services_config, created_at, updated_at
            FROM devices
            WHERE id = ?1
            "#,
        )
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(|e| AppError::Database(format!("Failed to query device by ID: {}", e)))?;

        Ok(device)
    }

    /// Updates an existing device.
    pub async fn update(
        pool: &SqlitePool,
        id: i64,
        req: &UpdateDeviceRequest,
    ) -> Result<Device, AppError> {
        let existing = Self::find_by_id(pool, id)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Device ID {} not found", id)))?;

        let now = Utc::now().to_rfc3339();
        let name = req.name.as_ref().unwrap_or(&existing.name);
        let ip_address = req.ip_address.as_ref().unwrap_or(&existing.ip_address);
        let description = match &req.description {
            Some(desc) => Some(desc.clone()),
            None => existing.description.clone(),
        };
        let enabled = req
            .enabled
            .map(|e| if e { 1 } else { 0 })
            .unwrap_or(existing.enabled);

        let services_json = match &req.services {
            Some(services) => serde_json::to_string(services).map_err(|e| {
                AppError::Internal(format!("Failed to serialize services config: {}", e))
            })?,
            None => existing.services_config.clone(),
        };

        sqlx::query(
            r#"
            UPDATE devices
            SET name = ?1, ip_address = ?2, description = ?3, enabled = ?4, services_config = ?5, updated_at = ?6
            WHERE id = ?7
            "#,
        )
        .bind(name)
        .bind(ip_address)
        .bind(&description)
        .bind(enabled)
        .bind(&services_json)
        .bind(&now)
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| AppError::Database(format!("Failed to update device: {}", e)))?;

        Ok(Device {
            id,
            name: name.clone(),
            ip_address: ip_address.clone(),
            description,
            enabled,
            services_config: services_json,
            created_at: existing.created_at,
            updated_at: now,
        })
    }

    /// Deletes a device by ID.
    pub async fn delete(pool: &SqlitePool, id: i64) -> Result<(), AppError> {
        let rows_affected = sqlx::query("DELETE FROM devices WHERE id = ?1")
            .bind(id)
            .execute(pool)
            .await
            .map_err(|e| AppError::Database(format!("Failed to delete device: {}", e)))?
            .rows_affected();

        if rows_affected == 0 {
            Err(AppError::NotFound(format!("Device ID {} not found", id)))
        } else {
            Ok(())
        }
    }

    /// Stores a real diagnostic run in the SQLite history table.
    pub async fn save_diagnostic(
        pool: &SqlitePool,
        device_id: i64,
        overall_status: &str,
        l3_success: bool,
        l3_latency_ms: Option<f64>,
        l3_error: Option<&str>,
        l7_summary: &str,
    ) -> Result<(), AppError> {
        let now = Utc::now().to_rfc3339();

        sqlx::query(
            r#"
            INSERT INTO diagnostic_history (device_id, overall_status, l3_success, l3_latency_ms, l3_error, l7_summary, executed_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
            "#,
        )
        .bind(device_id)
        .bind(overall_status)
        .bind(if l3_success { 1 } else { 0 })
        .bind(l3_latency_ms)
        .bind(l3_error)
        .bind(l7_summary)
        .bind(&now)
        .execute(pool)
        .await
        .map_err(|e| AppError::Database(format!("Failed to save diagnostic history: {}", e)))?;

        Ok(())
    }

    /// Retrieves history records for a given device.
    pub async fn get_history(
        pool: &SqlitePool,
        device_id: i64,
        limit: i64,
    ) -> Result<Vec<DiagnosticHistoryRecord>, AppError> {
        let records = sqlx::query_as::<_, DiagnosticHistoryRecord>(
            r#"
            SELECT id, device_id, overall_status, l3_success, l3_latency_ms, l3_error, l7_summary, executed_at
            FROM diagnostic_history
            WHERE device_id = ?1
            ORDER BY id DESC
            LIMIT ?2
            "#,
        )
        .bind(device_id)
        .bind(limit)
        .fetch_all(pool)
        .await
        .map_err(|e| AppError::Database(format!("Failed to query diagnostic history: {}", e)))?;

        Ok(records)
    }
}
