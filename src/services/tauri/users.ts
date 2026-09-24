import { tauriInvoke } from "./client";
import type {
  UserDtoFull,
  AdminCreateUserRequest,
  AdminUpdateUserRequest,
} from "@/types/user";

export async function getUsers(token: string): Promise<UserDtoFull[]> {
  return tauriInvoke<UserDtoFull[]>("get_users", { token });
}

export async function adminCreateUser(
  token: string,
  req: AdminCreateUserRequest
): Promise<UserDtoFull> {
  return tauriInvoke<UserDtoFull>("admin_create_user", { token, req });
}

export async function adminUpdateUser(
  token: string,
  userId: number,
  req: AdminUpdateUserRequest
): Promise<UserDtoFull> {
  return tauriInvoke<UserDtoFull>("admin_update_user", {
    token,
    user_id: userId,
    userId,
    req,
  });
}

export async function adminDeleteUser(
  token: string,
  userId: number
): Promise<void> {
  return tauriInvoke<void>("admin_delete_user", {
    token,
    user_id: userId,
    userId,
  });
}

