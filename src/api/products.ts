import { apiFetch } from './client';
import type { components } from '../types/api';

export type ProductResponse = components['schemas']['ProductResponse'];
export type PageProductResponse = components['schemas']['PageProductResponse'];
export type CategoryResponse = components['schemas']['CategoryResponse'];

export type ProductSort = 'newest' | 'price_asc' | 'price_desc';

export interface GetProductsParams {
  search?: string;
  categoryId?: number;
  sort?: ProductSort;
  page?: number;
  size?: number;
}

export function getProducts(params: GetProductsParams = {}): Promise<PageProductResponse> {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.categoryId !== undefined) query.set('categoryId', String(params.categoryId));
  if (params.sort) query.set('sort', params.sort);
  if (params.page !== undefined) query.set('page', String(params.page));
  if (params.size !== undefined) query.set('size', String(params.size));

  const qs = query.toString();
  return apiFetch<PageProductResponse>(`/products${qs ? `?${qs}` : ''}`);
}

export function getProductById(id: number): Promise<ProductResponse> {
  return apiFetch<ProductResponse>(`/products/${id}`);
}

export function getCategories(): Promise<CategoryResponse[]> {
  return apiFetch<CategoryResponse[]>('/categories');
}
