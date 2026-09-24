use crate::error::AppError;
use crate::models::{Alert, AlertDto, AlertSeverity, AlertSummary, AlertType};
use chrono::Utc;
use sqlx::SqlitePool;

pub struct AlertRepository;

impl AlertRepository {
    /// Inserts a new alert, avoiding duplicate unresolved alerts of same type for same device.
    pub async fn create_alert(
        pool: &SqlitePool,
        device_id: i64,
        alert_type: AlertType,
        severity: AlertSeverity,
        message: &str,
    ) -> Result<Option<Alert>, AppError> {
        let alert_type_str = alert_type.to_string();
        let severity_str = severity.to_string();

        // Check if an unresolved alert of the same type already exists for this device
        let existing: Option<(i64,)> = sqlx::query_as(
            "SELECT id FROM alerts WHERE device_id = ?1 AND alert_type = ?2 AND is_resolved = 0 LIMIT 1",
        )
        .bind(device_id)
        .bind(&alert_type_str)
        .fetch_optional(pool)
        .await
        .map_err(|e| AppError::Database(format!("Failed to check existing alert: {}", e)))?;

        if existing.is_some() {
            // Already reported and not yet resolved; avoid duplicate alerts
            return Ok(None);
        }

        let now = Utc::now().to_rfc3339();

        let id = sqlx::query(
            r#"
            INSERT INTO alerts (device_id, alert_type, severity, message, is_read, is_resolved, created_at)
            VALUES (?1, ?2, ?3, ?4, 0, 0, ?5)
            "#,
        )
        .bind(device_id)
        .bind(&alert_type_str)
        .bind(&severity_str)
        .bind(message)
        .bind(&now)
        .execute(pool)
        .await
        .map_err(|e| AppError::Database(format!("Failed to insert alert: {}", e)))?
        .last_insert_rowid();

        Ok(Some(Alert {
            id,
            device_id,
            alert_type: alert_type_str,
            severity: severity_str,
            message: message.to_string(),
            is_read: 0,
            is_resolved: 0,
            created_at: now,
            resolved_at: None,
        }))
    }

    /// Automatically resolves any pending unresolved alerts of a given type when device status recovers.
    pub async fn resolve_alerts_for_device(
        pool: &SqlitePool,
        device_id: i64,
        alert_types: &[AlertType],
    ) -> Result<i64, AppError> {
        let now = Utc::now().to_rfc3339();
        let mut total_resolved = 0;

        for at in alert_types {
            let type_str = at.to_string();
            let rows = sqlx::query(
                "UPDATE alerts SET is_resolved = 1, resolved_at = ?1 WHERE device_id = ?2 AND alert_type = ?3 AND is_resolved = 0",
            )
            .bind(&now)
            .bind(device_id)
            .bind(&type_str)
            .execute(pool)
            .await
            .map_err(|e| AppError::Database(format!("Failed to resolve alerts: {}", e)))?
            .rows_affected();

            total_resolved += rows as i64;
        }

        Ok(total_resolved)
    }

    /// Fetches all alerts, joining with devices table for device name and IP.
    pub async fn find_all(
        pool: &SqlitePool,
        unresolved_only: bool,
        limit: i64,
    ) -> Result<Vec<AlertDto>, AppError> {
        let query_str = if unresolved_only {
            r#"
            SELECT a.id, a.device_id, d.name as device_name, d.ip_address as device_ip,
                   a.alert_type, a.severity, a.message, a.is_read, a.is_resolved, a.created_at, a.resolved_at
            FROM alerts a
            LEFT JOIN devices d ON a.device_id = d.id
            WHERE a.is_resolved = 0
            ORDER BY a.id DESC
            LIMIT ?1
            "#
        } else {
            r#"
            SELECT a.id, a.device_id, d.name as device_name, d.ip_address as device_ip,
                   a.alert_type, a.severity, a.message, a.is_read, a.is_resolved, a.created_at, a.resolved_at
            FROM alerts a
            LEFT JOIN devices d ON a.device_id = d.id
            ORDER BY a.id DESC
            LIMIT ?1
            "#
        };

        type AlertJoinRow = (
            i64,
            i64,
            Option<String>,
            Option<String>,
            String,
            String,
            String,
            i64,
            i64,
            String,
            Option<String>,
        );

        let rows: Vec<AlertJoinRow> = sqlx::query_as(query_str)
            .bind(limit)
            .fetch_all(pool)
            .await
            .map_err(|e| AppError::Database(format!("Failed to fetch alerts: {}", e)))?;

        let dtos = rows
            .into_iter()
            .map(
                |(id, dev_id, dev_name, dev_ip, atype, sev, msg, read, resolved, created, res_at)| {
                    AlertDto {
                        id,
                        device_id: dev_id,
                        device_name: dev_name,
                        device_ip: dev_ip,
                        alert_type: AlertType::from(atype.as_str()),
                        severity: AlertSeverity::from(sev.as_str()),
                        message: msg,
                        is_read: read == 1,
                        is_resolved: resolved == 1,
                        created_at: created,
                        resolved_at: res_at,
                    }
                },
            )
            .collect();

        Ok(dtos)
    }

    /// Returns summary counts: unread, unresolved, and critical count.
    pub async fn get_summary(pool: &SqlitePool) -> Result<AlertSummary, AppError> {
        let unread: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM alerts WHERE is_read = 0 AND is_resolved = 0")
            .fetch_one(pool)
            .await
            .map_err(|e| AppError::Database(format!("Failed to count unread alerts: {}", e)))?;

        let unresolved: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM alerts WHERE is_resolved = 0")
            .fetch_one(pool)
            .await
            .map_err(|e| AppError::Database(format!("Failed to count unresolved alerts: {}", e)))?;

        let critical: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM alerts WHERE severity = 'critical' AND is_resolved = 0",
        )
        .fetch_one(pool)
        .await
        .map_err(|e| AppError::Database(format!("Failed to count critical alerts: {}", e)))?;

        Ok(AlertSummary {
            unread_count: unread.0,
            unresolved_count: unresolved.0,
            critical_count: critical.0,
        })
    }

    /// Marks an alert as read.
    pub async fn mark_as_read(pool: &SqlitePool, alert_id: i64) -> Result<(), AppError> {
        sqlx::query("UPDATE alerts SET is_read = 1 WHERE id = ?1")
            .bind(alert_id)
            .execute(pool)
            .await
            .map_err(|e| AppError::Database(format!("Failed to mark alert as read: {}", e)))?;
        Ok(())
    }

    /// Marks all alerts as read.
    pub async fn mark_all_as_read(pool: &SqlitePool) -> Result<(), AppError> {
        sqlx::query("UPDATE alerts SET is_read = 1 WHERE is_read = 0")
            .execute(pool)
            .await
            .map_err(|e| AppError::Database(format!("Failed to mark all alerts as read: {}", e)))?;
        Ok(())
    }

    /// Manually marks an alert as resolved.
    pub async fn mark_as_resolved(pool: &SqlitePool, alert_id: i64) -> Result<(), AppError> {
        let now = Utc::now().to_rfc3339();
        sqlx::query("UPDATE alerts SET is_resolved = 1, resolved_at = ?1 WHERE id = ?2")
            .bind(&now)
            .bind(alert_id)
            .execute(pool)
            .await
            .map_err(|e| AppError::Database(format!("Failed to resolve alert: {}", e)))?;
        Ok(())
    }
}
