import { apiFetch } from './client';
import type { components } from '../types/api';

export type CartResponse = components['schemas']['CartResponse'];
export type CartItemRequest = components['schemas']['CartItemRequest'];

export function addCartItem(body: CartItemRequest): Promise<CartResponse> {
  return apiFetch<CartResponse>('/cart/items', { method: 'POST', body });
}
