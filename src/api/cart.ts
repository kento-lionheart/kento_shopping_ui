import { apiFetch } from './client';
import type { components } from '../types/api';

export type CartResponse = components['schemas']['CartResponse'];
export type CartItemResponse = components['schemas']['CartItemResponse'];
export type CartItemRequest = components['schemas']['CartItemRequest'];
export type UpdateCartItemQuantityRequest = components['schemas']['UpdateCartItemQuantityRequest'];

export function addCartItem(body: CartItemRequest): Promise<CartResponse> {
  return apiFetch<CartResponse>('/cart/items', { method: 'POST', body });
}

export function getCart(): Promise<CartResponse> {
  return apiFetch<CartResponse>('/cart');
}

export function updateCartItem(
  productId: number,
  quantity: number,
): Promise<CartResponse> {
  const body: UpdateCartItemQuantityRequest = { quantity };
  return apiFetch<CartResponse>(`/cart/items/${productId}`, { method: 'PUT', body });
}

export function removeCartItem(productId: number): Promise<CartResponse> {
  return apiFetch<CartResponse>(`/cart/items/${productId}`, { method: 'DELETE' });
}

export function clearCart(): Promise<CartResponse> {
  return apiFetch<CartResponse>('/cart', { method: 'DELETE' });
}
