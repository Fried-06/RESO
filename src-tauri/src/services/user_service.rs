use crate::database::UserRepository;
use crate::error::{validate_password, validate_username, AppError};
use crate::models::{AdminCreateUserRequest, AdminUpdateUserRequest, UserDto, UserRole};
use crate::services::AuthService;
use sqlx::SqlitePool;

pub struct UserService;

impl UserService {
    /// Lists all users. Requires administrator role.
    pub async fn get_all_users(pool: &SqlitePool) -> Result<Vec<UserDto>, AppError> {
        let users = UserRepository::find_all(pool).await?;
        Ok(users.into_iter().map(UserDto::from).collect())
    }

    /// Creates a new user with chosen role and hashed password. Requires administrator role.
    pub async fn create_user(
        pool: &SqlitePool,
        req: AdminCreateUserRequest,
    ) -> Result<UserDto, AppError> {
        validate_username(&req.username)?;
        validate_password(&req.password)?;

        // Ensure username is unique
        let existing = UserRepository::find_by_username(pool, &req.username).await?;
        if existing.is_some() {
            return Err(AppError::Validation(format!(
                "Le nom d'utilisateur '{}' est déjà utilisé",
                req.username
            )));
        }

        let password_hash = AuthService::hash_password(&req.password)?;
        let role = req.role.unwrap_or(UserRole::Operator);

        let user = UserRepository::create(pool, &req.username, &password_hash, role).await?;
        Ok(user.into())
    }

    /// Updates user attributes (username, role, password, active state). Requires administrator role.
    pub async fn update_user(
        pool: &SqlitePool,
        target_user_id: i64,
        req: AdminUpdateUserRequest,
    ) -> Result<UserDto, AppError> {
        if let Some(ref uname) = req.username {
            validate_username(uname)?;
            // Check uniqueness if username changed
            if let Some(existing) = UserRepository::find_by_username(pool, uname).await? {
                if existing.id != target_user_id {
                    return Err(AppError::Validation(format!(
                        "Le nom d'utilisateur '{}' est déjà utilisé",
                        uname
                    )));
                }
            }
        }

        // If demoting an admin or deactivating an admin, ensure they aren't the last active admin
        let target = UserRepository::find_by_id(pool, target_user_id)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("User ID {} not found", target_user_id)))?;

        let is_demoting = req.role.is_some() && req.role != Some(UserRole::Admin) && target.role == "admin";
        let is_deactivating = req.is_active == Some(false) && target.role == "admin";

        if is_demoting || is_deactivating {
            let active_admins = UserRepository::count_admins(pool).await?;
            if active_admins <= 1 {
                return Err(AppError::Validation(
                    "Impossible de désactiver ou rétrograder le dernier compte administrateur actif"
                        .to_string(),
                ));
            }
        }

        // Apply metadata updates
        let updated_user = UserRepository::update(
            pool,
            target_user_id,
            req.username.as_deref(),
            req.role,
            req.is_active,
        )
        .await?;

        // If password was provided, hash and update it
        if let Some(ref pwd) = req.password {
            if !pwd.trim().is_empty() {
                validate_password(pwd)?;
                let hash = AuthService::hash_password(pwd)?;
                UserRepository::update_password(pool, target_user_id, &hash).await?;
            }
        }

        Ok(updated_user.into())
    }

    /// Deletes a user account. Cannot delete the last active administrator.
    pub async fn delete_user(
        pool: &SqlitePool,
        caller_user_id: i64,
        target_user_id: i64,
    ) -> Result<(), AppError> {
        if caller_user_id == target_user_id {
            return Err(AppError::Validation(
                "Vous ne pouvez pas supprimer votre propre compte administrateur actuellement connecté"
                    .to_string(),
            ));
        }

        let target = UserRepository::find_by_id(pool, target_user_id)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("User ID {} not found", target_user_id)))?;

        if target.role == "admin" {
            let active_admins = UserRepository::count_admins(pool).await?;
            if active_admins <= 1 {
                return Err(AppError::Validation(
                    "Impossible de supprimer le dernier compte administrateur de l'application"
                        .to_string(),
                ));
            }
        }

        UserRepository::delete(pool, target_user_id).await
    }
}
