import { apiFetch } from './client';
import type { components } from '../types/api';

export type AddressRequest = components['schemas']['AddressRequest'];
export type AddressResponse = components['schemas']['AddressResponse'];

/**
 * Strict one-address-per-user model: no address ID in the URL.
 * Rejects with ApiError (status 404) if the user has no address yet.
 */
export function getAddress(): Promise<AddressResponse> {
  return apiFetch<AddressResponse>('/addresses');
}

/** Rejects with ApiError (status 409) if an address already exists for this user. */
export function createAddress(body: AddressRequest): Promise<void> {
  return apiFetch<void>('/addresses', { method: 'POST', body });
}

/** Rejects with ApiError (status 404) if no address exists yet. */
export function updateAddress(body: AddressRequest): Promise<void> {
  return apiFetch<void>('/addresses', { method: 'PUT', body });
}
