import { apiFetch } from './client';
import type { components } from '../types/api';

export type CheckoutRequest = components['schemas']['CheckoutRequest'];
export type OrderResponse = components['schemas']['OrderResponse'];
export type OrderItemResponse = components['schemas']['OrderItemResponse'];
export type OrderSummaryResponse = components['schemas']['OrderSummaryResponse'];

/**
 * Creates a PENDING order from the current cart. Requires a non-empty cart
 * (400 "Cart is empty" otherwise) and validates stock per line item (400
 * "<product> has insufficient stock" on shortfall). Shipping fields are
 * submitted fresh here — independent of any saved Address entity. On
 * success the cart is cleared server-side.
 */
export function checkout(body: CheckoutRequest): Promise<OrderResponse> {
  return apiFetch<OrderResponse>('/orders/checkout', { method: 'POST', body });
}

/**
 * Pays for a PENDING order out of the customer's coin wallet. No request body.
 * Rejects with ApiError (status 400) and message
 * "Insufficient coin balance. Required: X — available: Y" if the balance is
 * too low — the order stays PENDING and payment can be retried after a
 * wallet top-up.
 */
export function makePayment(orderId: number): Promise<OrderResponse> {
  return apiFetch<OrderResponse>(`/orders/${orderId}/payment`, { method: 'POST' });
}

/** Plain array, not paginated. */
export function getOrderHistory(): Promise<OrderSummaryResponse[]> {
  return apiFetch<OrderSummaryResponse[]>('/orders');
}

export function cancelOrder(orderId: number): Promise<OrderResponse> {
  return apiFetch<OrderResponse>(`/orders/${orderId}/cancel`, { method: 'PATCH' });
}
