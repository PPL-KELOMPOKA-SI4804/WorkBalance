import { Navigate } from 'react-router-dom';
import { getDefaultRouteForRole, useAuth } from '../context/AuthContext';

export default function RoleRouteGuard({ allowedRoles = [], children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-6 py-5">
          <img
            src="/assets/workbalance_logo_2.svg"
            alt="WorkBalance"
            className="size-7 animate-pulse"
          />
          <span className="text-sm font-medium text-muted-foreground">
            Memverifikasi sesi pengguna...
          </span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return <Navigate to={getDefaultRouteForRole(user.role)} replace />;
  }

  return children;
}
