import { apiFetch } from '../client';
import type { components } from '../../types/api';

export type ProductCreateRequest = components['schemas']['ProductCreateRequest'];
export type ProductRequest = components['schemas']['ProductRequest'];
export type StockRequest = components['schemas']['StockRequest'];

/** POST /api/v1/admin/products — requires PRODUCT_CREATE. */
export function createProduct(request: ProductCreateRequest): Promise<void> {
  return apiFetch<void>('/admin/products', { method: 'POST', body: request });
}

/** PUT /api/v1/admin/products/{id} — requires PRODUCT_UPDATE. */
export function updateProduct(id: number, request: ProductRequest): Promise<void> {
  return apiFetch<void>(`/admin/products/${id}`, { method: 'PUT', body: request });
}

/** DELETE /api/v1/admin/products/{id} — requires PRODUCT_DELETE. */
export function deleteProduct(id: number): Promise<void> {
  return apiFetch<void>(`/admin/products/${id}`, { method: 'DELETE' });
}

/**
 * PUT /api/v1/admin/products/{id}/stock — requires INVENTORY_UPDATE.
 * `quantity` is the new absolute stock level, not a delta.
 */
export function updateStock(id: number, request: StockRequest): Promise<void> {
  return apiFetch<void>(`/admin/products/${id}/stock`, { method: 'PUT', body: request });
}
