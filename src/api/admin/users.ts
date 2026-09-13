import { apiFetch } from '../client';
import type { components } from '../../types/api';

export type AdminUserResponse = components['schemas']['AdminUserResponse'];
export type PageAdminUserResponse = components['schemas']['PageAdminUserResponse'];

export interface GetUsersParams {
  email?: string;
  page?: number;
  size?: number;
}

export function getUsers(params: GetUsersParams = {}): Promise<PageAdminUserResponse> {
  const query = new URLSearchParams();
  if (params.email) query.set('email', params.email);
  if (params.page !== undefined) query.set('page', String(params.page));
  if (params.size !== undefined) query.set('size', String(params.size));

  const qs = query.toString();
  return apiFetch<PageAdminUserResponse>(`/admin/users${qs ? `?${qs}` : ''}`);
}

export function getUser(id: number): Promise<AdminUserResponse> {
  return apiFetch<AdminUserResponse>(`/admin/users/${id}`);
}

export function assignRoles(userId: number, roleNames: string[]): Promise<AdminUserResponse> {
  return apiFetch<AdminUserResponse>(`/admin/users/${userId}/roles`, {
    method: 'PUT',
    body: { roleNames },
  });
}
