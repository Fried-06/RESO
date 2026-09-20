import { tauriInvoke } from "./client";
import type { CreateDeviceRequest, DeviceDto, UpdateDeviceRequest } from "@/types";

export async function getDevices(token: string): Promise<DeviceDto[]> {
  return await tauriInvoke<DeviceDto[]>("get_devices", { token });
}

export async function getDevice(token: string, id: number): Promise<DeviceDto> {
  return await tauriInvoke<DeviceDto>("get_device", { token, id });
}

export async function createDevice(token: string, req: CreateDeviceRequest): Promise<DeviceDto> {
  return await tauriInvoke<DeviceDto>("create_device", { token, req });
}

export async function updateDevice(
  token: string,
  id: number,
  req: UpdateDeviceRequest
): Promise<DeviceDto> {
  return await tauriInvoke<DeviceDto>("update_device", { token, id, req });
}

export async function deleteDevice(token: string, id: number): Promise<void> {
  await tauriInvoke<void>("delete_device", { token, id });
}
