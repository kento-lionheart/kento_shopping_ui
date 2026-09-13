import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './useAuth';

/**
 * Cosmetic route guard — customers hold zero permissions (see CLAUDE.md), so
 * this keeps them out of the /admin shell entirely instead of just hiding
 * individual nav items/actions. Each admin page still enforces its own
 * specific permission independently; the backend's @PreAuthorize is the real
 * enforcement either way.
 */
export function RequireAdminAccess() {
  const { permissions } = useAuth();

  if (permissions.length === 0) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
