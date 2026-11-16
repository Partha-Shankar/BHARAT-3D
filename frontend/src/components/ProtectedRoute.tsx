import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { allowedPath } from '../lib/roles';

/** Where the sign-in page should send the visitor once they are signed in. */
export type LoginState = { from?: string };

/**
 * Pages that need a signed-in user. Without a valid session the visitor goes to the sign-in page, which remembers
 * this address and returns to it afterwards. A signed-in user who opens another role's workspace (an old bookmark, a
 * shared link) is taken to the nearest page their role may use instead of a page that would fail.
 */
export default function ProtectedRoute() {
  const { isAuthenticated, user } = useAuthStore();
  const location = useLocation();
  const here = `${location.pathname}${location.search}${location.hash}`;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: here } satisfies LoginState} />;
  }
  const target = allowedPath(user?.role, here);
  if (target !== here) return <Navigate to={target} replace />;
  return <Outlet />;
}
