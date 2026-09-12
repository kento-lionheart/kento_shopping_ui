import { apiFetch } from './client';
import type { components } from '../types/api';

export type LoginRequest = components['schemas']['LoginRequest'];
export type RegisterRequest = components['schemas']['RegisterRequest'];
export type AuthResponse = components['schemas']['AuthResponse'];

export function login(body: LoginRequest): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/auth/login', { method: 'POST', body });
}

export function register(body: RegisterRequest): Promise<void> {
  return apiFetch<void>('/auth/register', { method: 'POST', body });
}

export function me(): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/auth/me', { method: 'GET' });
}
