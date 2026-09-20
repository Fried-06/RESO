import { tauriInvoke } from "./client";
import type { SettingsDto, UpdateSettingsRequest } from "@/types";

export async function getSettings(token: string): Promise<SettingsDto> {
  return await tauriInvoke<SettingsDto>("get_settings", { token });
}

export async function updateSettings(
  token: string,
  req: UpdateSettingsRequest
): Promise<SettingsDto> {
  return await tauriInvoke<SettingsDto>("update_settings", { token, req });
}
