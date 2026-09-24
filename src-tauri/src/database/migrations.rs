use crate::error::AppError;
use sqlx::SqlitePool;

/// Applies database migrations to initialize SQLite tables.
/// Ensures zero demo/mock data is injected:
/// - `users` table is left empty (bootstrap handled on first launch, bootstrap user gets role 'admin')
/// - `devices` table is left empty (user creates their real equipment)
/// - `settings` table initializes only system configuration defaults
/// - `diagnostic_history` table stores real measurements
/// - `alerts` table stores real network anomaly alerts
pub async fn run_migrations(pool: &SqlitePool) -> Result<(), AppError> {
    // 1. Users table
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'operator',
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

    // Migration for existing databases: ensure `role` column exists
    let pragma_user_columns: Vec<(i64, String, String, i64, Option<String>, i64)> =
        sqlx::query_as("PRAGMA table_info(users)")
            .fetch_all(pool)
            .await
            .unwrap_or_default();

    let has_role = pragma_user_columns.iter().any(|c| c.1 == "role");
    if !has_role {
        let _ = sqlx::query("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'operator'")
            .execute(pool)
            .await;
        // The first user ever created should be admin
        let _ = sqlx::query("UPDATE users SET role = 'admin' WHERE id = (SELECT MIN(id) FROM users)")
            .execute(pool)
            .await;
    }

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
            explanation TEXT,
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

    // Migration for diagnostic_history: ensure `explanation` column exists
    let pragma_diag_columns: Vec<(i64, String, String, i64, Option<String>, i64)> =
        sqlx::query_as("PRAGMA table_info(diagnostic_history)")
            .fetch_all(pool)
            .await
            .unwrap_or_default();

    let has_explanation = pragma_diag_columns.iter().any(|c| c.1 == "explanation");
    if !has_explanation {
        let _ = sqlx::query("ALTER TABLE diagnostic_history ADD COLUMN explanation TEXT")
            .execute(pool)
            .await;
    }

    // 5. Alerts table
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            device_id INTEGER NOT NULL,
            alert_type TEXT NOT NULL,
            severity TEXT NOT NULL,
            message TEXT NOT NULL,
            is_read INTEGER NOT NULL DEFAULT 0,
            is_resolved INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            resolved_at TEXT,
            FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_alerts_device_id ON alerts(device_id);
        CREATE INDEX IF NOT EXISTS idx_alerts_is_read ON alerts(is_read);
        CREATE INDEX IF NOT EXISTS idx_alerts_is_resolved ON alerts(is_resolved);
        CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at);
        "#,
    )
    .execute(pool)
    .await
    .map_err(|e| AppError::Database(format!("Failed to create alerts table: {}", e)))?;

    Ok(())
}
