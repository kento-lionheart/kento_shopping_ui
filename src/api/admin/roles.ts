import { apiFetch } from '../client';
import type { components } from '../../types/api';

export type RoleResponse = components['schemas']['RoleResponse'];
export type PermissionResponse = components['schemas']['PermissionResponse'];
export type CreateRoleRequest = components['schemas']['CreateRoleRequest'];

export function getRoles(): Promise<RoleResponse[]> {
  return apiFetch<RoleResponse[]>('/admin/roles');
}

export function getPermissions(): Promise<PermissionResponse[]> {
  return apiFetch<PermissionResponse[]>('/admin/permissions');
}

export function createRole(body: CreateRoleRequest): Promise<RoleResponse> {
  return apiFetch<RoleResponse>('/admin/roles', {
    method: 'POST',
    body,
  });
}

export function updateRolePermissions(roleId: number, permissions: string[]): Promise<RoleResponse> {
  return apiFetch<RoleResponse>(`/admin/roles/${roleId}/permissions`, {
    method: 'PUT',
    body: { permissions },
  });
}
