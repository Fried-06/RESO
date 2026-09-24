pub mod commands;
pub mod database;
pub mod error;
pub mod models;
pub mod network;
pub mod services;
pub mod state;

use database::{init_pool, run_migrations};
use state::AppState;
use std::path::PathBuf;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Determine SQLite storage location:
            // Uses the user's app local data directory, or falls back to current working directory
            let data_dir = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| PathBuf::from("."));

            let _ = std::fs::create_dir_all(&data_dir);
            let db_path = data_dir.join("asecna_monitor.db");
            let db_url = format!("sqlite://{}?mode=rwc", db_path.to_string_lossy());

            // Initialize SQLite connection pool and execute schema migrations
            tauri::async_runtime::block_on(async {
                let pool = init_pool(&db_url)
                    .await
                    .expect("Failed to initialize SQLite database pool");

                run_migrations(&pool)
                    .await
                    .expect("Failed to run database migrations");

                let app_state = AppState::new(pool);
                app.manage(app_state);
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Authentication commands
            commands::is_bootstrap_required,
            commands::create_first_user,
            commands::login,
            commands::logout,
            commands::get_current_user,
            commands::change_password,
            // User Administration (RBAC) commands
            commands::get_users,
            commands::admin_create_user,
            commands::admin_update_user,
            commands::admin_delete_user,
            // Device management commands
            commands::create_device,
            commands::get_devices,
            commands::get_device,
            commands::update_device,
            commands::delete_device,
            // Network & Diagnostics commands
            commands::run_ping,
            commands::run_tcp_test,
            commands::run_http_test,
            commands::run_device_diagnostic,
            commands::get_network_overview,
            commands::get_device_history,
            // Network Discovery commands
            commands::start_discovery,
            commands::stop_discovery,
            commands::get_discovery_status,
            // Alerts & Notification commands
            commands::get_alerts,
            commands::get_alert_summary,
            commands::mark_alert_as_read,
            commands::mark_all_alerts_as_read,
            commands::mark_alert_as_resolved,
            // Settings commands
            commands::get_settings,
            commands::update_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
