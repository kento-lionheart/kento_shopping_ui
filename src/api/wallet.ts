import { apiFetch } from './client';
import type { components } from '../types/api';

export type TopUpRequestResponse = components['schemas']['TopUpRequestResponse'];
export type CreateTopUpRequest = components['schemas']['CreateTopUpRequest'];
export type WalletResponse = components['schemas']['WalletResponse'];

/**
 * Creates a new PENDING top-up request. Does not change the wallet balance —
 * balance only changes once an admin approves the request (separate UC).
 */
export function createTopUpRequest(amount: number): Promise<TopUpRequestResponse> {
  return apiFetch<TopUpRequestResponse>('/wallet/top-ups', {
    method: 'POST',
    body: { amount } satisfies CreateTopUpRequest,
  });
}

/** The current customer's own top-up requests, newest first. Not paginated. */
export function getTopUpRequests(): Promise<TopUpRequestResponse[]> {
  return apiFetch<TopUpRequestResponse[]>('/wallet/top-ups');
}

/** Withdraws a request while it is still PENDING; it becomes CANCELLED. */
export function cancelTopUpRequest(id: number): Promise<TopUpRequestResponse> {
  return apiFetch<TopUpRequestResponse>(`/wallet/top-ups/${id}`, { method: 'DELETE' });
}

export function getWallet(): Promise<WalletResponse> {
  return apiFetch<WalletResponse>('/wallet');
}
