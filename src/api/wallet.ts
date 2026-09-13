import { apiFetch } from './client';
import type { components } from '../types/api';

export type TopUpRequestResponse = components['schemas']['TopUpRequestResponse'];
export type CreateTopUpRequest = components['schemas']['CreateTopUpRequest'];
export type WalletResponse = components['schemas']['WalletResponse'];
export type CoinTransactionResponse = components['schemas']['CoinTransactionResponse'];
export type PageCoinTransactionResponse = components['schemas']['PageCoinTransactionResponse'];

export interface GetTransactionsParams {
  page?: number;
  size?: number;
}

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

/** Balance + the 10 most recent transactions. Uses getOrCreate on the backend, so a
 * never-transacted customer sees a zero balance rather than a 404. */
export function getWallet(): Promise<WalletResponse> {
  return apiFetch<WalletResponse>('/wallet');
}

/** Full paginated transaction ledger for the current customer, newest first. */
export function getTransactions(
  params: GetTransactionsParams = {},
): Promise<PageCoinTransactionResponse> {
  const query = new URLSearchParams();
  if (params.page !== undefined) query.set('page', String(params.page));
  if (params.size !== undefined) query.set('size', String(params.size));

  const qs = query.toString();
  return apiFetch<PageCoinTransactionResponse>(`/wallet/transactions${qs ? `?${qs}` : ''}`);
}

/** Any customer's wallet, for staff/admin holding WALLET_READ_ALL. */
export function getWalletForUser(userId: number): Promise<WalletResponse> {
  return apiFetch<WalletResponse>(`/admin/wallets/${userId}`);
}
