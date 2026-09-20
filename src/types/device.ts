export type ServiceType = "tcp" | "http" | "https";

export interface ServiceConfig {
  name: string;
  service_type: ServiceType;
  port: number;
  target?: string;
}

export interface DeviceDto {
  id: number;
  name: string;
  ip_address: string;
  description?: string;
  enabled: boolean;
  services: ServiceConfig[];
  created_at: string;
  updated_at: string;
}

export interface CreateDeviceRequest {
  name: string;
  ip_address: string;
  description?: string;
  enabled?: boolean;
  services: ServiceConfig[];
}

export interface UpdateDeviceRequest {
  name?: string;
  ip_address?: string;
  description?: string;
  enabled?: boolean;
  services?: ServiceConfig[];
}
