export type AlertSeverity = "critical" | "warning" | "info";

export type AlertType = "device_unreachable" | "service_degraded" | "latency_spike" | "service_restored";

export interface AlertDto {
  id: number;
  device_id: number;
  device_name?: string;
  device_ip?: string;
  alert_type: AlertType;
  severity: AlertSeverity;
  message: string;
  is_read: boolean;
  is_resolved: boolean;
  created_at: string;
  resolved_at?: string;
}

export interface AlertSummary {
  unread_count: number;
  unresolved_count: number;
  critical_count: number;
}
