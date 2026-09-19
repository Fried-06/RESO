use crate::error::AppError;
use crate::models::{AppSettings, UpdateSettingsRequest};
use chrono::Utc;
use sqlx::SqlitePool;

pub struct SettingsRepository;

impl SettingsRepository {
    /// Gets application settings from SQLite (singleton row id = 1).
    pub async fn get(pool: &SqlitePool) -> Result<AppSettings, AppError> {
        let settings = sqlx::query_as::<_, AppSettings>(
            r#"
            SELECT id, scan_interval_secs, network_timeout_ms, max_concurrent_tests, startup_scan, updated_at
            FROM settings
            WHERE id = 1
            "#,
        )
        .fetch_one(pool)
        .await
        .map_err(|e| AppError::Database(format!("Failed to query settings: {}", e)))?;

        Ok(settings)
    }

    /// Updates application settings with validated parameters.
    pub async fn update(
        pool: &SqlitePool,
        req: &UpdateSettingsRequest,
    ) -> Result<AppSettings, AppError> {
        let existing = Self::get(pool).await?;
        let now = Utc::now().to_rfc3339();

        let scan_interval = req
            .scan_interval_secs
            .map(|v| v as i64)
            .unwrap_or(existing.scan_interval_secs);
        let network_timeout = req
            .network_timeout_ms
            .map(|v| v as i64)
            .unwrap_or(existing.network_timeout_ms);
        let max_concurrent = req
            .max_concurrent_tests
            .map(|v| v as i64)
            .unwrap_or(existing.max_concurrent_tests);
        let startup_scan = req
            .startup_scan
            .map(|v| if v { 1 } else { 0 })
            .unwrap_or(existing.startup_scan);

        sqlx::query(
            r#"
            UPDATE settings
            SET scan_interval_secs = ?1, network_timeout_ms = ?2, max_concurrent_tests = ?3, startup_scan = ?4, updated_at = ?5
            WHERE id = 1
            "#,
        )
        .bind(scan_interval)
        .bind(network_timeout)
        .bind(max_concurrent)
        .bind(startup_scan)
        .bind(&now)
        .execute(pool)
        .await
        .map_err(|e| AppError::Database(format!("Failed to update settings: {}", e)))?;

        Ok(AppSettings {
            id: 1,
            scan_interval_secs: scan_interval,
            network_timeout_ms: network_timeout,
            max_concurrent_tests: max_concurrent,
            startup_scan,
            updated_at: now,
        })
    }
}
