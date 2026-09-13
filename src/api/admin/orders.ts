import { apiFetch } from '../client';
import type { components } from '../../types/api';

export type AdminOrderSummaryResponse = components['schemas']['AdminOrderSummaryResponse'];
export type PageAdminOrderSummaryResponse = components['schemas']['PageAdminOrderSummaryResponse'];
export type OrderResponse = components['schemas']['OrderResponse'];
export type OrderStatus = NonNullable<components['schemas']['UpdateOrderStatusRequest']['status']>;

export interface GetAllOrdersParams {
  email?: string;
  status?: OrderStatus;
  page?: number;
  size?: number;
}

/**
 * GET /api/v1/admin/orders — requires ORDER_READ_ALL.
 * No sort param exists on the real endpoint; ordering is whatever the
 * repository query returns (no explicit ORDER BY), not guaranteed createdAt DESC.
 */
export function getAllOrders(params: GetAllOrdersParams = {}): Promise<PageAdminOrderSummaryResponse> {
  const query = new URLSearchParams();
  if (params.email) query.set('email', params.email);
  if (params.status) query.set('status', params.status);
  if (params.page !== undefined) query.set('page', String(params.page));
  if (params.size !== undefined) query.set('size', String(params.size));

  const qs = query.toString();
  return apiFetch<PageAdminOrderSummaryResponse>(`/admin/orders${qs ? `?${qs}` : ''}`);
}

/**
 * PUT /api/v1/admin/orders/{id}/status — requires ORDER_UPDATE_STATUS.
 *
 * NOTE: the backend refuses `CANCELLED` as a target status through this
 * endpoint entirely (see OrderServiceImpl.updateOrderStatus) — cancelling a
 * paid order would skip restocking/refund, so it is deliberately blocked
 * here. It also refuses any update once the order is already DELIVERED or
 * CANCELLED. There is no separate admin "cancel any order" endpoint reachable
 * anywhere in the backend — ORDER_CANCEL_ANY is seeded as a permission but no
 * controller checks for it, so no cancel-any function is exposed here.
 */
export function updateOrderStatus(id: number, status: OrderStatus): Promise<OrderResponse> {
  return apiFetch<OrderResponse>(`/admin/orders/${id}/status`, {
    method: 'PUT',
    body: { status },
  });
}
