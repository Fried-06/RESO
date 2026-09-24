import { tauriInvoke } from "./client";
import type { AlertDto, AlertSummary } from "@/types/alert";

export async function getAlerts(
  token: string,
  unresolvedOnly = false,
  limit?: number
): Promise<AlertDto[]> {
  return tauriInvoke<AlertDto[]>("get_alerts", {
    token,
    unresolvedOnly,
    unresolved_only: unresolvedOnly,
    limit: limit ?? null,
  });
}

export async function getAlertSummary(token: string): Promise<AlertSummary> {
  return tauriInvoke<AlertSummary>("get_alert_summary", { token });
}

export async function markAlertAsRead(token: string, alertId: number): Promise<void> {
  return tauriInvoke<void>("mark_alert_as_read", {
    token,
    alertId,
    alert_id: alertId,
  });
}

export async function markAllAlertsAsRead(token: string): Promise<void> {
  return tauriInvoke<void>("mark_all_alerts_as_read", { token });
}

export async function markAlertAsResolved(token: string, alertId: number): Promise<void> {
  return tauriInvoke<void>("mark_alert_as_resolved", {
    token,
    alertId,
    alert_id: alertId,
  });
}

