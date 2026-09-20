import { tauriInvoke } from "./client";
import type {
  DiagnosticHistoryRecord,
  DiagnosticResult,
  HttpTestResult,
  NetworkOverview,
  PingResult,
  TcpTestResult,
} from "@/types";

export async function runPing(target: string, timeoutMs?: number): Promise<PingResult> {
  return await tauriInvoke<PingResult>("run_ping", {
    target,
    timeoutMs,
  });
}

export async function runTcpTest(
  host: string,
  port: number,
  timeoutMs?: number
): Promise<TcpTestResult> {
  return await tauriInvoke<TcpTestResult>("run_tcp_test", {
    host,
    port,
    timeoutMs,
  });
}

export async function runHttpTest(url: string, timeoutMs?: number): Promise<HttpTestResult> {
  return await tauriInvoke<HttpTestResult>("run_http_test", {
    url,
    timeoutMs,
  });
}

export async function runDeviceDiagnostic(
  token: string,
  deviceId: number
): Promise<DiagnosticResult> {
  return await tauriInvoke<DiagnosticResult>("run_device_diagnostic", {
    token,
    deviceId,
  });
}

export async function getNetworkOverview(token: string): Promise<NetworkOverview> {
  return await tauriInvoke<NetworkOverview>("get_network_overview", { token });
}

export async function getDeviceHistory(
  token: string,
  deviceId: number,
  limit?: number
): Promise<DiagnosticHistoryRecord[]> {
  return await tauriInvoke<DiagnosticHistoryRecord[]>("get_device_history", {
    token,
    deviceId,
    limit,
  });
}
