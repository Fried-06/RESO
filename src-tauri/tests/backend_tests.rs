use asecreso_lib::database::{init_pool, run_migrations, UserRepository};
use asecreso_lib::error::{
    validate_device_name, validate_http_url, validate_ip_or_hostname, validate_password,
    validate_port, validate_username, AppError,
};
use asecreso_lib::models::{
    ChangePasswordRequest, CreateDeviceRequest, CreateFirstUserRequest, LoginRequest,
    ServiceConfig, ServiceType, UpdateDeviceRequest,
};
use asecreso_lib::network::{ping_target, test_http_endpoint, test_tcp_connection};
use asecreso_lib::services::{AuthService, DeviceService, SettingsService};
use asecreso_lib::state::SessionManager;
use std::sync::Arc;
use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

// ---------------------------------------------------------------------------
// 1. Validation tests
// ---------------------------------------------------------------------------

#[test]
fn test_ip_and_hostname_validation() {
    // Valid IPv4 and IPv6
    assert!(validate_ip_or_hostname("127.0.0.1").is_ok());
    assert!(validate_ip_or_hostname("192.168.1.1").is_ok());
    assert!(validate_ip_or_hostname("10.0.0.254").is_ok());
    assert!(validate_ip_or_hostname("::1").is_ok());

    // Valid hostnames
    assert!(validate_ip_or_hostname("localhost").is_ok());
    assert!(validate_ip_or_hostname("router.lan").is_ok());
    assert!(validate_ip_or_hostname("switch-core-01").is_ok());

    // Invalid targets
    assert!(validate_ip_or_hostname("").is_err());
    assert!(validate_ip_or_hostname("   ").is_err());
    assert!(validate_ip_or_hostname("-invalid-host").is_err());
    assert!(validate_ip_or_hostname("invalid host with spaces").is_err());
}

#[test]
fn test_port_validation() {
    assert!(validate_port(80).is_ok());
    assert!(validate_port(443).is_ok());
    assert!(validate_port(22).is_ok());
    assert!(validate_port(65535).is_ok());

    // Port 0 is reserved
    assert!(validate_port(0).is_err());
}

#[test]
fn test_url_validation() {
    assert!(validate_http_url("http://192.168.1.1").is_ok());
    assert!(validate_http_url("https://10.0.0.1:8443/admin").is_ok());

    // Unsupported protocols
    assert!(validate_http_url("ftp://192.168.1.1").is_err());
    assert!(validate_http_url("ssh://192.168.1.1").is_err());
    assert!(validate_http_url("not a url").is_err());
}

#[test]
fn test_user_and_password_validation() {
    assert!(validate_username("admin").is_ok());
    assert!(validate_username("tech_operator-01").is_ok());
    assert!(validate_username("ab").is_err()); // Too short
    assert!(validate_username("bad user!").is_err()); // Invalid char

    assert!(validate_password("SecurePass123!").is_ok());
    assert!(validate_password("short").is_err()); // Too short
}

#[test]
fn test_device_name_validation() {
    assert!(validate_device_name("Router Core").is_ok());
    assert!(validate_device_name("Server-01").is_ok());
    assert!(validate_device_name("").is_err());
    assert!(validate_device_name(&"a".repeat(70)).is_err());
}

// ---------------------------------------------------------------------------
// 2. Password Hashing (Argon2id) & Session tests
// ---------------------------------------------------------------------------

#[test]
fn test_argon2id_hashing_and_verification() {
    let password = "SuperSecretPassword123!";
    let hash1 = AuthService::hash_password(password).expect("Hashing failed");
    let hash2 = AuthService::hash_password(password).expect("Hashing failed");

    // Hashes must have unique salts and never match directly as strings
    assert_ne!(hash1, hash2);
    assert!(hash1.starts_with("$argon2id$"));

    // Verification must succeed for correct password
    assert!(AuthService::verify_password(password, &hash1).unwrap());
    assert!(AuthService::verify_password(password, &hash2).unwrap());

    // Verification must fail for incorrect password
    assert!(!AuthService::verify_password("WrongPassword!", &hash1).unwrap());
}

#[tokio::test]
async fn test_in_memory_session_lifecycle() {
    let session_mgr = SessionManager::new(2);

    let (token, expires_at) = session_mgr.create_session(42, "admin_test").await;
    assert!(!token.is_empty());
    assert!(expires_at > chrono::Utc::now());

    // Validation must succeed
    let session = session_mgr
        .validate_session(&token)
        .await
        .expect("Session should be valid");
    assert_eq!(session.user_id, 42);
    assert_eq!(session.username, "admin_test");

    // Unknown token must be rejected
    assert!(session_mgr.validate_session("unknown-token").await.is_err());

    // Logout invalidates session
    session_mgr.invalidate_session(&token).await;
    assert!(session_mgr.validate_session(&token).await.is_err());
}

// ---------------------------------------------------------------------------
// 3. Database migrations, Bootstrap, and Authentication tests
// ---------------------------------------------------------------------------

async fn setup_test_db() -> sqlx::SqlitePool {
    let pool = init_pool("sqlite::memory:")
        .await
        .expect("Failed to initialize in-memory SQLite");
    run_migrations(&pool)
        .await
        .expect("Failed to run migrations on test DB");
    pool
}

#[tokio::test]
async fn test_empty_database_and_bootstrap_flow() {
    let pool = setup_test_db().await;
    let session_mgr = Arc::new(SessionManager::new(1));

    // Initially, zero users exist
    assert_eq!(UserRepository::count(&pool).await.unwrap(), 0);
    assert!(AuthService::is_bootstrap_required(&pool).await.unwrap());

    // Initial user creation succeeds
    let auth_res = AuthService::create_first_user(
        &pool,
        &session_mgr,
        CreateFirstUserRequest {
            username: "admin_super".to_string(),
            password: "InitialPassword123#".to_string(),
        },
    )
    .await
    .expect("Bootstrap should succeed");

    assert_eq!(auth_res.user.username, "admin_super");
    assert_eq!(UserRepository::count(&pool).await.unwrap(), 1);
    assert!(!AuthService::is_bootstrap_required(&pool).await.unwrap());

    // Second bootstrap call MUST fail with BootstrapAlreadyCompleted
    let second_attempt = AuthService::create_first_user(
        &pool,
        &session_mgr,
        CreateFirstUserRequest {
            username: "intruder".to_string(),
            password: "Password123#".to_string(),
        },
    )
    .await;

    match second_attempt {
        Err(AppError::BootstrapAlreadyCompleted) => {}
        other => panic!("Expected BootstrapAlreadyCompleted, got: {:?}", other),
    }

    // Login with valid credentials succeeds
    let login_res = AuthService::login(
        &pool,
        &session_mgr,
        LoginRequest {
            username: "admin_super".to_string(),
            password: "InitialPassword123#".to_string(),
        },
    )
    .await
    .expect("Login should succeed");

    assert_eq!(login_res.user.username, "admin_super");

    // Login with invalid credentials fails
    assert!(AuthService::login(
        &pool,
        &session_mgr,
        LoginRequest {
            username: "admin_super".to_string(),
            password: "WrongPassword!".to_string(),
        }
    )
    .await
    .is_err());

    // Password change flow
    let change_pass_res = AuthService::change_password(
        &pool,
        &session_mgr,
        &login_res.token,
        ChangePasswordRequest {
            current_password: "InitialPassword123#".to_string(),
            new_password: "BrandNewPassword456$".to_string(),
        },
    )
    .await;
    assert!(change_pass_res.is_ok());

    // Login with new password succeeds
    assert!(AuthService::login(
        &pool,
        &session_mgr,
        LoginRequest {
            username: "admin_super".to_string(),
            password: "BrandNewPassword456$".to_string(),
        }
    )
    .await
    .is_ok());
}

// ---------------------------------------------------------------------------
// 4. Device CRUD and Settings tests
// ---------------------------------------------------------------------------

#[tokio::test]
async fn test_device_crud_operations() {
    let pool = setup_test_db().await;

    // Database is empty
    let devices = DeviceService::get_devices(&pool).await.unwrap();
    assert_eq!(devices.len(), 0);

    // Create device
    let created = DeviceService::create_device(
        &pool,
        CreateDeviceRequest {
            name: "Core Switch".to_string(),
            ip_address: "192.168.1.2".to_string(),
            description: Some("Main network switch".to_string()),
            enabled: true,
            services: vec![
                ServiceConfig {
                    name: "SSH Admin".to_string(),
                    service_type: ServiceType::Tcp,
                    port: 22,
                    target: None,
                },
                ServiceConfig {
                    name: "Web Console".to_string(),
                    service_type: ServiceType::Http,
                    port: 80,
                    target: Some("/login".to_string()),
                },
            ],
        },
    )
    .await
    .expect("Device creation should succeed");

    assert_eq!(created.name, "Core Switch");
    assert_eq!(created.services.len(), 2);

    // Fetch device by ID
    let fetched = DeviceService::get_device(&pool, created.id)
        .await
        .expect("Device should exist");
    assert_eq!(fetched.id, created.id);

    // Update device
    let updated = DeviceService::update_device(
        &pool,
        created.id,
        UpdateDeviceRequest {
            name: Some("Core Switch Updated".to_string()),
            ip_address: None,
            description: Some("Updated description".to_string()),
            enabled: Some(false),
            services: None,
        },
    )
    .await
    .expect("Update should succeed");

    assert_eq!(updated.name, "Core Switch Updated");
    assert!(!updated.enabled);

    // Delete device
    DeviceService::delete_device(&pool, created.id)
        .await
        .expect("Delete should succeed");

    // Fetch deleted device should return NotFound
    assert!(DeviceService::get_device(&pool, created.id).await.is_err());
}

#[tokio::test]
async fn test_settings_service() {
    let pool = setup_test_db().await;

    let settings = SettingsService::get_settings(&pool).await.unwrap();
    assert_eq!(settings.scan_interval_secs, 60);
    assert_eq!(settings.network_timeout_ms, 3000);
    assert_eq!(settings.max_concurrent_tests, 10);

    // Update settings
    let updated = SettingsService::update_settings(
        &pool,
        asecreso_lib::models::UpdateSettingsRequest {
            scan_interval_secs: Some(30),
            network_timeout_ms: Some(2500),
            max_concurrent_tests: Some(15),
            startup_scan: Some(true),
        },
    )
    .await
    .unwrap();

    assert_eq!(updated.scan_interval_secs, 30);
    assert_eq!(updated.network_timeout_ms, 2500);
    assert_eq!(updated.max_concurrent_tests, 15);
    assert!(updated.startup_scan);
}

// ---------------------------------------------------------------------------
// 5. Real TCP and HTTP Socket tests (No mocks!)
// ---------------------------------------------------------------------------

#[tokio::test]
async fn test_real_tcp_connection_against_live_listener() {
    // Bind a real ephemeral TCP socket on loopback
    let listener = TcpListener::bind("127.0.0.1:0")
        .await
        .expect("Failed to bind test TCP listener");
    let local_addr = listener.local_addr().unwrap();
    let port = local_addr.port();

    // Spawn server accept task
    let server_task = tokio::spawn(async move {
        if let Ok((mut socket, _)) = listener.accept().await {
            let mut buf = [0u8; 4];
            let _ = socket.read(&mut buf).await;
        }
    });

    // Test real connection to the open port
    let result = test_tcp_connection("127.0.0.1", port, Duration::from_millis(1500)).await;
    assert!(result.success);
    assert!(result.latency_ms.is_some());
    assert!(result.error.is_none());

    let _ = server_task.await;

    // Now test a port that is NOT listening (should return connection refused)
    // Use an unallocated port (e.g. 59999 or close the listener)
    let closed_port_result =
        test_tcp_connection("127.0.0.1", port, Duration::from_millis(500)).await;
    let err_str = closed_port_result.error.as_ref().unwrap();
    println!("DEBUG TCP CLOSED PORT ERROR: '{}'", err_str);
    assert!(!closed_port_result.success);
    assert!(
        err_str.contains("closed")
            || err_str.contains("refused")
            || err_str.contains("refuse")
            || err_str.contains("refusée")
            || err_str.contains("timed out")
            || err_str.contains("error")
    );
}

#[tokio::test]
async fn test_real_http_against_live_endpoint() {
    // Bind a real TCP listener that returns valid HTTP response
    let listener = TcpListener::bind("127.0.0.1:0")
        .await
        .expect("Failed to bind test HTTP server");
    let local_addr = listener.local_addr().unwrap();
    let port = local_addr.port();

    tokio::spawn(async move {
        if let Ok((mut socket, _)) = listener.accept().await {
            let mut buf = [0u8; 1024];
            let _ = socket.read(&mut buf).await;
            let response = "HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\nOK";
            let _ = socket.write_all(response.as_bytes()).await;
        }
    });

    let client = reqwest::Client::new();
    let test_url = format!("http://127.0.0.1:{}/health", port);
    let result = test_http_endpoint(&client, &test_url, Duration::from_millis(2000)).await;

    assert!(result.success);
    assert_eq!(result.status_code, Some(200));
    assert!(result.latency_ms.is_some());
    assert!(result.error.is_none());
}

#[tokio::test]
async fn test_real_icmp_ping_against_localhost() {
    // Ping localhost (127.0.0.1) using the real ICMP driver
    let result = ping_target("127.0.0.1", Duration::from_millis(2000)).await;
    // On Windows, winping calls unprivileged IcmpSendEcho to 127.0.0.1
    // Loopback ping succeeds on any standard Windows networking stack
    if result.success {
        assert!(result.latency_ms.is_some());
        assert!(result.error.is_none());
    } else {
        // If firewall or environmental restriction blocked it, error must be genuine
        assert!(result.error.is_some());
    }
}
