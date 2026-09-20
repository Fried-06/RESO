import { tauriInvoke } from "./client";
import type {
  AuthResponse,
  ChangePasswordRequest,
  CreateFirstUserRequest,
  LoginRequest,
  UserDto,
} from "@/types";

export async function isBootstrapRequired(): Promise<boolean> {
  return await tauriInvoke<boolean>("is_bootstrap_required");
}

export async function createFirstUser(req: CreateFirstUserRequest): Promise<AuthResponse> {
  return await tauriInvoke<AuthResponse>("create_first_user", { req });
}

export async function login(req: LoginRequest): Promise<AuthResponse> {
  return await tauriInvoke<AuthResponse>("login", { req });
}

export async function logout(token: string): Promise<void> {
  await tauriInvoke<void>("logout", { token });
}

export async function getCurrentUser(token: string): Promise<UserDto> {
  return await tauriInvoke<UserDto>("get_current_user", { token });
}

export async function changePassword(token: string, req: ChangePasswordRequest): Promise<void> {
  await tauriInvoke<void>("change_password", { token, req });
}
