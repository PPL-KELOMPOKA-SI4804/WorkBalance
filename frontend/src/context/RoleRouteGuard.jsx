import { Navigate } from 'react-router-dom';
import { getDefaultRouteForRole, useAuth } from '@/context/AuthContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { Spinner } from '@/components/ui/spinner';
import { BrandLogo } from '@/components/workbalance';

export default function RoleRouteGuard({ allowedRoles = [], children }) {
  const { user, loading } = useAuth();
  useDocumentTitle(loading ? 'Memuat' : '');

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-5 py-4">
          <BrandLogo variant="mark" className="shrink-0" />
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Spinner className="size-4 text-primary" />
            <span>Memverifikasi sesi...</span>
          </div>
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
