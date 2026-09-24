import { tauriInvoke } from "./client";
import type {
  DiscoveredDevice,
  DiscoveryProgress,
  StartDiscoveryRequest,
} from "@/types/discovery";

export async function startDiscovery(
  token: string,
  req: StartDiscoveryRequest
): Promise<void> {
  return tauriInvoke<void>("start_discovery", { token, req });
}

export async function stopDiscovery(token: string): Promise<void> {
  return tauriInvoke<void>("stop_discovery", { token });
}

export async function getDiscoveryStatus(
  token: string
): Promise<[DiscoveryProgress, DiscoveredDevice[]]> {
  return tauriInvoke<[DiscoveryProgress, DiscoveredDevice[]]>(
    "get_discovery_status",
    { token }
  );
}
