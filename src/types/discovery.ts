export interface DiscoveredDevice {
  ip_address: string;
  hostname?: string;
  mac_address?: string;
  response_time_ms?: number;
  is_registered: boolean;
  registered_device_id?: number;
  registered_device_name?: string;
}

export interface DiscoveryProgress {
  subnet: string;
  is_running: boolean;
  total_targets: number;
  scanned_targets: number;
  found_count: number;
  current_ip?: string;
  error?: string;
}

export interface StartDiscoveryRequest {
  subnet?: string;
  max_concurrency?: number;
  timeout_ms?: number;
}
