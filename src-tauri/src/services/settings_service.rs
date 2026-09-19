use crate::database::SettingsRepository;
use crate::error::AppError;
use crate::models::{SettingsDto, UpdateSettingsRequest};
use sqlx::SqlitePool;

pub struct SettingsService;

impl SettingsService {
    /// Retrieves current application settings.
    pub async fn get_settings(pool: &SqlitePool) -> Result<SettingsDto, AppError> {
        let settings = SettingsRepository::get(pool).await?;
        Ok(settings.into())
    }

    /// Validates and updates application settings.
    pub async fn update_settings(
        pool: &SqlitePool,
        req: UpdateSettingsRequest,
    ) -> Result<SettingsDto, AppError> {
        if let Some(interval) = req.scan_interval_secs {
            if !(5..=86400).contains(&interval) {
                return Err(AppError::Validation(
                    "Scan interval must be between 5 seconds and 86400 seconds (24h)".to_string(),
                ));
            }
        }

        if let Some(timeout) = req.network_timeout_ms {
            if !(200..=30000).contains(&timeout) {
                return Err(AppError::Validation(
                    "Network timeout must be between 200 ms and 30000 ms (30s)".to_string(),
                ));
            }
        }

        if let Some(concurrent) = req.max_concurrent_tests {
            if !(1..=50).contains(&concurrent) {
                return Err(AppError::Validation(
                    "Max concurrent tests must be between 1 and 50".to_string(),
                ));
            }
        }

        let updated = SettingsRepository::update(pool, &req).await?;
        Ok(updated.into())
    }
}
