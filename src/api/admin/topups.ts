import { apiFetch } from '../client';
import type { components } from '../../types/api';

export type TopUpRequestResponse = components['schemas']['TopUpRequestResponse'];
export type PageTopUpRequestResponse = components['schemas']['PageTopUpRequestResponse'];
export type TopUpStatus = NonNullable<TopUpRequestResponse['status']>;

export interface GetTopUpQueueParams {
  status?: TopUpStatus;
  page?: number;
  size?: number;
}

export function getTopUpQueue(
  params: GetTopUpQueueParams = {},
): Promise<PageTopUpRequestResponse> {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.page !== undefined) query.set('page', String(params.page));
  if (params.size !== undefined) query.set('size', String(params.size));

  const qs = query.toString();
  return apiFetch<PageTopUpRequestResponse>(`/admin/top-ups${qs ? `?${qs}` : ''}`);
}

export function approveTopUp(id: number): Promise<TopUpRequestResponse> {
  return apiFetch<TopUpRequestResponse>(`/admin/top-ups/${id}/approve`, {
    method: 'PUT',
  });
}

export function rejectTopUp(id: number, note: string): Promise<TopUpRequestResponse> {
  return apiFetch<TopUpRequestResponse>(`/admin/top-ups/${id}/reject`, {
    method: 'PUT',
    body: { note },
  });
}
