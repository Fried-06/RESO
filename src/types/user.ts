export type UserRole = "admin" | "operator";

/** Extended user DTO with role field (returned by admin commands). */
export interface UserDtoFull {
  id: number;
  username: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdminCreateUserRequest {
  username: string;
  password: string;
  role?: UserRole;
}

export interface AdminUpdateUserRequest {
  username?: string;
  role?: UserRole;
  password?: string;
  is_active?: boolean;
}
