export type DeviceStatus = "operational" | "degraded" | "offline";

export interface PingResult {
  target: string;
  success: boolean;
  latency_ms?: number;
  error?: string;
}

export interface TcpTestResult {
  host: string;
  port: number;
  success: boolean;
  latency_ms?: number;
  error?: string;
}

export interface HttpTestResult {
  url: string;
  status_code?: number;
  success: boolean;
  latency_ms?: number;
  error?: string;
}

export interface ServiceProbeResult {
  name: string;
  service_type: string;
  port: number;
  success: boolean;
  latency_ms?: number;
  status_code?: number;
  error?: string;
}

export interface DiagnosticResult {
  device_id: number;
  device_name: string;
  ip_address: string;
  l3_result: PingResult;
  l7_results: ServiceProbeResult[];
  overall_status: DeviceStatus;
  executed_at: string;
}

export interface NetworkOverview {
  total_devices: number;
  online_devices: number;
  degraded_devices: number;
  offline_devices: number;
  scanned_at: string;
  results: DiagnosticResult[];
}

export interface DiagnosticHistoryRecord {
  id: number;
  device_id: number;
  overall_status: string;
  l3_success: number;
  l3_latency_ms?: number;
  l3_error?: string;
  l7_summary: string;
  executed_at: string;
}
