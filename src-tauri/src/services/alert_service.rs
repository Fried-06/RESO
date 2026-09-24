use crate::database::AlertRepository;
use crate::error::AppError;
use crate::models::{AlertDto, AlertSummary};
use sqlx::SqlitePool;

pub struct AlertService;

impl AlertService {
    /// Gets all alerts (optionally unresolved only).
    pub async fn get_alerts(
        pool: &SqlitePool,
        unresolved_only: bool,
        limit: Option<i64>,
    ) -> Result<Vec<AlertDto>, AppError> {
        let limit = limit.unwrap_or(100).clamp(1, 500);
        AlertRepository::find_all(pool, unresolved_only, limit).await
    }

    /// Gets summary counts of alerts for badges.
    pub async fn get_summary(pool: &SqlitePool) -> Result<AlertSummary, AppError> {
        AlertRepository::get_summary(pool).await
    }

    /// Marks a specific alert as read.
    pub async fn mark_as_read(pool: &SqlitePool, alert_id: i64) -> Result<(), AppError> {
        AlertRepository::mark_as_read(pool, alert_id).await
    }

    /// Marks all unread alerts as read.
    pub async fn mark_all_as_read(pool: &SqlitePool) -> Result<(), AppError> {
        AlertRepository::mark_all_as_read(pool).await
    }

    /// Marks an alert as resolved.
    pub async fn mark_as_resolved(pool: &SqlitePool, alert_id: i64) -> Result<(), AppError> {
        AlertRepository::mark_as_resolved(pool, alert_id).await
    }
}
