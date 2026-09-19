use crate::error::AppError;
use sqlx::SqlitePool;

/// Applies database migrations to initialize SQLite tables.
/// Ensures zero demo/mock data is injected:
/// - `users` table is left empty (bootstrap handled on first launch)
/// - `devices` table is left empty (user creates their real equipment)
/// - `settings` table initializes only system configuration defaults
/// - `diagnostic_history` table stores real measurements
pub async fn run_migrations(pool: &SqlitePool) -> Result<(), AppError> {
    // 1. Users table
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
        "#,
    )
    .execute(pool)
    .await
    .map_err(|e| AppError::Database(format!("Failed to create users table: {}", e)))?;

    // 2. Devices table
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS devices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            ip_address TEXT NOT NULL,
            description TEXT,
            enabled INTEGER NOT NULL DEFAULT 1,
            services_config TEXT NOT NULL DEFAULT '[]',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_devices_ip_address ON devices(ip_address);
        "#,
    )
    .execute(pool)
    .await
    .map_err(|e| AppError::Database(format!("Failed to create devices table: {}", e)))?;

    // 3. Settings table (singleton row with id = 1)
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS settings (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            scan_interval_secs INTEGER NOT NULL DEFAULT 60,
            network_timeout_ms INTEGER NOT NULL DEFAULT 3000,
            max_concurrent_tests INTEGER NOT NULL DEFAULT 10,
            startup_scan INTEGER NOT NULL DEFAULT 0,
            updated_at TEXT NOT NULL
        );
        INSERT OR IGNORE INTO settings (id, scan_interval_secs, network_timeout_ms, max_concurrent_tests, startup_scan, updated_at)
        VALUES (1, 60, 3000, 10, 0, datetime('now'));
        "#,
    )
    .execute(pool)
    .await
    .map_err(|e| AppError::Database(format!("Failed to create settings table: {}", e)))?;

    // 4. Diagnostic history table
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS diagnostic_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            device_id INTEGER NOT NULL,
            overall_status TEXT NOT NULL,
            l3_success INTEGER NOT NULL,
            l3_latency_ms REAL,
            l3_error TEXT,
            l7_summary TEXT NOT NULL DEFAULT '[]',
            executed_at TEXT NOT NULL,
            FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_diag_hist_device_id ON diagnostic_history(device_id);
        CREATE INDEX IF NOT EXISTS idx_diag_hist_executed_at ON diagnostic_history(executed_at);
        "#,
    )
    .execute(pool)
    .await
    .map_err(|e| AppError::Database(format!("Failed to create diagnostic_history table: {}", e)))?;

    Ok(())
}
