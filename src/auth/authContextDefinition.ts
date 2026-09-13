import { createContext } from 'react';
import type { AuthResponse, LoginRequest } from '../api/auth';

export type CurrentUser = NonNullable<AuthResponse['user']>;

export interface AuthContextValue {
  user: CurrentUser | null;
  roles: string[];
  permissions: string[];
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginRequest) => Promise<AuthResponse>;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
