export interface SettingsDto {
  scan_interval_secs: number;
  network_timeout_ms: number;
  max_concurrent_tests: number;
  startup_scan: boolean;
  updated_at: string;
}

export interface UpdateSettingsRequest {
  scan_interval_secs?: number;
  network_timeout_ms?: number;
  max_concurrent_tests?: number;
  startup_scan?: boolean;
}
