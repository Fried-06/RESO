use crate::error::AppError;
use crate::models::User;
use chrono::Utc;
use sqlx::SqlitePool;

pub struct UserRepository;

impl UserRepository {
    /// Counts total users in SQLite to determine if bootstrap is required.
    pub async fn count(pool: &SqlitePool) -> Result<i64, AppError> {
        let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM users")
            .fetch_one(pool)
            .await
            .map_err(|e| AppError::Database(format!("Failed to count users: {}", e)))?;
        Ok(count.0)
    }

    /// Finds a user by unique username using parameterized query.
    pub async fn find_by_username(
        pool: &SqlitePool,
        username: &str,
    ) -> Result<Option<User>, AppError> {
        let user = sqlx::query_as::<_, User>(
            "SELECT id, username, password_hash, is_active, created_at, updated_at FROM users WHERE username = ?1"
        )
        .bind(username)
        .fetch_optional(pool)
        .await
        .map_err(|e| AppError::Database(format!("Failed to query user by username: {}", e)))?;

        Ok(user)
    }

    /// Finds a user by ID using parameterized query.
    pub async fn find_by_id(pool: &SqlitePool, id: i64) -> Result<Option<User>, AppError> {
        let user = sqlx::query_as::<_, User>(
            "SELECT id, username, password_hash, is_active, created_at, updated_at FROM users WHERE id = ?1"
        )
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(|e| AppError::Database(format!("Failed to query user by ID: {}", e)))?;

        Ok(user)
    }

    /// Inserts a new user with Argon2 password hash.
    pub async fn create(
        pool: &SqlitePool,
        username: &str,
        password_hash: &str,
    ) -> Result<User, AppError> {
        let now = Utc::now().to_rfc3339();

        let id = sqlx::query(
            r#"
            INSERT INTO users (username, password_hash, is_active, created_at, updated_at)
            VALUES (?1, ?2, 1, ?3, ?4)
            "#,
        )
        .bind(username)
        .bind(password_hash)
        .bind(&now)
        .bind(&now)
        .execute(pool)
        .await
        .map_err(|e| AppError::Database(format!("Failed to insert user: {}", e)))?
        .last_insert_rowid();

        Ok(User {
            id,
            username: username.to_string(),
            password_hash: password_hash.to_string(),
            is_active: 1,
            created_at: now.clone(),
            updated_at: now,
        })
    }

    /// Updates password hash for a specific user.
    pub async fn update_password(
        pool: &SqlitePool,
        id: i64,
        new_password_hash: &str,
    ) -> Result<(), AppError> {
        let now = Utc::now().to_rfc3339();

        let rows_affected =
            sqlx::query("UPDATE users SET password_hash = ?1, updated_at = ?2 WHERE id = ?3")
                .bind(new_password_hash)
                .bind(&now)
                .bind(id)
                .execute(pool)
                .await
                .map_err(|e| AppError::Database(format!("Failed to update password: {}", e)))?
                .rows_affected();

        if rows_affected == 0 {
            Err(AppError::NotFound(format!("User ID {} not found", id)))
        } else {
            Ok(())
        }
    }
}
