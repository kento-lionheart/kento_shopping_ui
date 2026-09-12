import { useCallback, useEffect, useState, type ReactNode } from 'react';
import * as authApi from '../api/auth';
import type { AuthResponse, LoginRequest } from '../api/auth';
import { ApiError } from '../api/client';
import { clearToken, getToken, setToken } from './token';
import { AuthContext, type CurrentUser } from './authContextDefinition';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(() => getToken() !== null);

  const applyAuth = useCallback((auth: AuthResponse) => {
    setUser(auth.user ?? null);
    setRoles(auth.roles ?? []);
    setPermissions(auth.permissions ?? []);
  }, []);

  const clearAuth = useCallback(() => {
    setUser(null);
    setRoles([]);
    setPermissions([]);
    clearToken();
  }, []);

  useEffect(() => {
    if (!getToken()) {
      return;
    }

    authApi
      .me()
      .then(applyAuth)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          clearAuth();
        }
      })
      .finally(() => setIsLoading(false));
  }, [applyAuth, clearAuth]);

  const login = useCallback(
    async (credentials: LoginRequest) => {
      const auth = await authApi.login(credentials);
      if (auth.token) {
        setToken(auth.token);
      }
      applyAuth(auth);
    },
    [applyAuth],
  );

  const logout = useCallback(() => {
    clearAuth();
  }, [clearAuth]);

  const hasPermission = useCallback(
    (permission: string) => permissions.includes(permission),
    [permissions],
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        roles,
        permissions,
        isLoading,
        isAuthenticated: user !== null,
        login,
        logout,
        hasPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
