use crate::database::DeviceRepository;
use crate::error::{validate_device_name, validate_ip_or_hostname, validate_port, AppError};
use crate::models::{CreateDeviceRequest, DeviceDto, ServiceConfig, UpdateDeviceRequest};
use sqlx::SqlitePool;

pub struct DeviceService;

impl DeviceService {
    /// Validates an equipment's service configuration list.
    fn validate_services(services: &[ServiceConfig]) -> Result<(), AppError> {
        for service in services {
            let name = service.name.trim();
            if name.is_empty() || name.len() > 32 {
                return Err(AppError::Validation(
                    "Service name must be between 1 and 32 characters".to_string(),
                ));
            }
            validate_port(service.port)?;
        }
        Ok(())
    }

    /// Creates a new network device after strict input validation.
    pub async fn create_device(
        pool: &SqlitePool,
        req: CreateDeviceRequest,
    ) -> Result<DeviceDto, AppError> {
        validate_device_name(&req.name)?;
        validate_ip_or_hostname(&req.ip_address)?;
        Self::validate_services(&req.services)?;

        let device = DeviceRepository::create(pool, &req).await?;
        Ok(device.to_dto())
    }

    /// Fetches all configured network devices.
    pub async fn get_devices(pool: &SqlitePool) -> Result<Vec<DeviceDto>, AppError> {
        let devices = DeviceRepository::find_all(pool).await?;
        Ok(devices.into_iter().map(|d| d.to_dto()).collect())
    }

    /// Fetches a specific device by ID.
    pub async fn get_device(pool: &SqlitePool, id: i64) -> Result<DeviceDto, AppError> {
        let device = DeviceRepository::find_by_id(pool, id)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Device ID {} not found", id)))?;

        Ok(device.to_dto())
    }

    /// Updates an existing device with validated changes.
    pub async fn update_device(
        pool: &SqlitePool,
        id: i64,
        req: UpdateDeviceRequest,
    ) -> Result<DeviceDto, AppError> {
        if let Some(ref name) = req.name {
            validate_device_name(name)?;
        }
        if let Some(ref ip) = req.ip_address {
            validate_ip_or_hostname(ip)?;
        }
        if let Some(ref services) = req.services {
            Self::validate_services(services)?;
        }

        let updated = DeviceRepository::update(pool, id, &req).await?;
        Ok(updated.to_dto())
    }

    /// Deletes a device and cascades to its diagnostic history.
    pub async fn delete_device(pool: &SqlitePool, id: i64) -> Result<(), AppError> {
        DeviceRepository::delete(pool, id).await
    }
}
