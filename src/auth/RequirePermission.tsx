import type { ReactNode } from 'react';
import { useAuth } from './useAuth';

interface RequirePermissionProps {
  permission: string;
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Cosmetic only — hides UI the caller has no permission for. The backend's
 * @PreAuthorize is the real enforcement; this never replaces it.
 */
export function RequirePermission({ permission, children, fallback = null }: RequirePermissionProps) {
  const { hasPermission } = useAuth();
  return hasPermission(permission) ? <>{children}</> : <>{fallback}</>;
}
