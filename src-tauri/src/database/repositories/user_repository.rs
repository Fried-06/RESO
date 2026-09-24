use crate::error::AppError;
use crate::models::{User, UserRole};
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

    /// Counts total admin accounts in SQLite to prevent deleting the last admin.
    pub async fn count_admins(pool: &SqlitePool) -> Result<i64, AppError> {
        let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM users WHERE role = 'admin' AND is_active = 1")
            .fetch_one(pool)
            .await
            .map_err(|e| AppError::Database(format!("Failed to count admin users: {}", e)))?;
        Ok(count.0)
    }

    /// Finds all users in SQLite.
    pub async fn find_all(pool: &SqlitePool) -> Result<Vec<User>, AppError> {
        let users = sqlx::query_as::<_, User>(
            "SELECT id, username, password_hash, role, is_active, created_at, updated_at FROM users ORDER BY id ASC"
        )
        .fetch_all(pool)
        .await
        .map_err(|e| AppError::Database(format!("Failed to query users: {}", e)))?;

        Ok(users)
    }

    /// Finds a user by unique username using parameterized query.
    pub async fn find_by_username(
        pool: &SqlitePool,
        username: &str,
    ) -> Result<Option<User>, AppError> {
        let user = sqlx::query_as::<_, User>(
            "SELECT id, username, password_hash, role, is_active, created_at, updated_at FROM users WHERE username = ?1"
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
            "SELECT id, username, password_hash, role, is_active, created_at, updated_at FROM users WHERE id = ?1"
        )
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(|e| AppError::Database(format!("Failed to query user by ID: {}", e)))?;

        Ok(user)
    }

    /// Inserts a new user with Argon2 password hash and specified role.
    pub async fn create(
        pool: &SqlitePool,
        username: &str,
        password_hash: &str,
        role: UserRole,
    ) -> Result<User, AppError> {
        let now = Utc::now().to_rfc3339();
        let role_str = role.to_string();

        let id = sqlx::query(
            r#"
            INSERT INTO users (username, password_hash, role, is_active, created_at, updated_at)
            VALUES (?1, ?2, ?3, 1, ?4, ?5)
            "#,
        )
        .bind(username)
        .bind(password_hash)
        .bind(&role_str)
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
            role: role_str,
            is_active: 1,
            created_at: now.clone(),
            updated_at: now,
        })
    }

    /// Updates general user properties (username, role, is_active).
    pub async fn update(
        pool: &SqlitePool,
        id: i64,
        username: Option<&str>,
        role: Option<UserRole>,
        is_active: Option<bool>,
    ) -> Result<User, AppError> {
        let existing = Self::find_by_id(pool, id)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("User ID {} not found", id)))?;

        let now = Utc::now().to_rfc3339();
        let new_username = username.unwrap_or(&existing.username);
        let new_role_str = role.map(|r| r.to_string()).unwrap_or(existing.role);
        let new_is_active = is_active.map(|a| if a { 1 } else { 0 }).unwrap_or(existing.is_active);

        sqlx::query(
            r#"
            UPDATE users
            SET username = ?1, role = ?2, is_active = ?3, updated_at = ?4
            WHERE id = ?5
            "#,
        )
        .bind(new_username)
        .bind(&new_role_str)
        .bind(new_is_active)
        .bind(&now)
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| AppError::Database(format!("Failed to update user: {}", e)))?;

        Ok(User {
            id,
            username: new_username.to_string(),
            password_hash: existing.password_hash,
            role: new_role_str,
            is_active: new_is_active,
            created_at: existing.created_at,
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

    /// Deletes a user by ID.
    pub async fn delete(pool: &SqlitePool, id: i64) -> Result<(), AppError> {
        let rows_affected = sqlx::query("DELETE FROM users WHERE id = ?1")
            .bind(id)
            .execute(pool)
            .await
            .map_err(|e| AppError::Database(format!("Failed to delete user: {}", e)))?
            .rows_affected();

        if rows_affected == 0 {
            Err(AppError::NotFound(format!("User ID {} not found", id)))
        } else {
            Ok(())
        }
    }
}
