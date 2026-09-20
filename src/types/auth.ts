export interface UserDto {
  id: number;
  username: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  token: string;
  user: UserDto;
  expires_at: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface CreateFirstUserRequest {
  username: string;
  password: string;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}
