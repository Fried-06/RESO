import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { UserDto, LoginRequest, CreateFirstUserRequest } from "@/types";
import * as authService from "@/services/tauri/auth";

interface AuthContextType {
  user: UserDto | null;
  token: string | null;
  isLoading: boolean;
  bootstrapRequired: boolean;
  login: (req: LoginRequest) => Promise<void>;
  createFirstUser: (req: CreateFirstUserRequest) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = "asecna_session_token";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserDto | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [bootstrapRequired, setBootstrapRequired] = useState<boolean>(false);

  const initAuth = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Check if first user creation is required
      const needsBootstrap = await authService.isBootstrapRequired();
      setBootstrapRequired(needsBootstrap);

      if (needsBootstrap) {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
        setIsLoading(false);
        return;
      }

      // 2. If token exists, validate session with backend
      const storedToken = localStorage.getItem(TOKEN_KEY);
      if (storedToken) {
        try {
          const currentUser = await authService.getCurrentUser(storedToken);
          setUser(currentUser);
          setToken(storedToken);
        } catch (err) {
          console.warn("Session token expired or invalid:", err);
          localStorage.removeItem(TOKEN_KEY);
          setToken(null);
          setUser(null);
        }
      }
    } catch (error) {
      console.error("Auth initialization failed:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  const login = async (req: LoginRequest) => {
    const res = await authService.login(req);
    localStorage.setItem(TOKEN_KEY, res.token);
    setToken(res.token);
    setUser(res.user);
    setBootstrapRequired(false);
  };

  const createFirstUser = async (req: CreateFirstUserRequest) => {
    const res = await authService.createFirstUser(req);
    localStorage.setItem(TOKEN_KEY, res.token);
    setToken(res.token);
    setUser(res.user);
    setBootstrapRequired(false);
  };

  const logout = async () => {
    if (token) {
      try {
        await authService.logout(token);
      } catch (err) {
        console.warn("Logout error on backend:", err);
      }
    }
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  };

  const refreshUser = async () => {
    if (!token) return;
    try {
      const updated = await authService.getCurrentUser(token);
      setUser(updated);
    } catch (err) {
      console.error("Failed to refresh user:", err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        bootstrapRequired,
        login,
        createFirstUser,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
