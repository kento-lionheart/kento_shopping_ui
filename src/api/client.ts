import { getToken, clearToken } from '../auth/token';

const BASE_URL = import.meta.env.VITE_API_BASE_URL;
const ORIGIN = new URL(BASE_URL).origin;

/** Product images and other static assets are served from the API origin, outside /api/v1. */
export function getAssetUrl(path: string): string {
  return `${ORIGIN}${path}`;
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type RequestOptions = Omit<RequestInit, 'body'> & { body?: unknown };

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, headers, ...rest } = options;
  const token = getToken();

  const res = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    clearToken();
  }

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const message = data?.message ?? res.statusText;
    throw new ApiError(data?.status ?? res.status, message);
  }

  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}
