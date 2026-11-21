import { Navigate } from 'react-router-dom';
import { getDefaultRouteForRole, useAuth } from '../context/AuthContext';

export default function RoleRouteGuard({ allowedRoles = [], children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
        <div className="bg-white rounded-xl border border-slate-200/80 px-6 py-5 flex items-center gap-3 shadow-xs">
          <img
            src="/assets/workbalance_logo_2.svg"
            alt="WorkBalance"
            className="w-7 h-7 animate-pulse"
          />
          <span className="text-sm font-medium text-slate-600">Memverifikasi sesi pengguna...</span>
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
