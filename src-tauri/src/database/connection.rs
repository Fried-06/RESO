use crate::error::AppError;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::SqlitePool;
use std::str::FromStr;
use std::time::Duration;

/// Initializes a robust SQLite connection pool with production-grade pragmas.
/// - WAL journal mode for concurrent reads while writing.
/// - Foreign keys enabled for data integrity.
/// - Busy timeout to handle concurrent access without immediate lock failure.
pub async fn init_pool(database_url: &str) -> Result<SqlitePool, AppError> {
    let connect_options = SqliteConnectOptions::from_str(database_url)
        .map_err(|e| AppError::Database(format!("Invalid SQLite connection string: {}", e)))?
        .create_if_missing(true)
        .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal)
        .foreign_keys(true)
        .busy_timeout(Duration::from_secs(5));

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .acquire_timeout(Duration::from_secs(5))
        .connect_with(connect_options)
        .await
        .map_err(|e| AppError::Database(format!("Failed to connect to SQLite: {}", e)))?;

    Ok(pool)
}
