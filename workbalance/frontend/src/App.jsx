import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, getDefaultRouteForRole, useAuth } from './context/AuthContext';
import RoleRouteGuard from './context/RoleRouteGuard';
import LoginPage from './pages/LoginPage';
import DepartmentsPage from './pages/admin/DepartmentsPage';
import EmployeesPage from './pages/admin/EmployeesPage';
import EmployeeDashboardPage from './pages/employee/EmployeeDashboardPage';

function HomeRedirect() {
  const { user, loading } = useAuth();

  if (loading) {
    return null;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={getDefaultRouteForRole(user.role)} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/login" element={<LoginPage />} />

          <Route
            path="/admin/employees"
            element={
              <RoleRouteGuard allowedRoles={['admin']}>
                <EmployeesPage />
              </RoleRouteGuard>
            }
          />

          <Route
            path="/admin/departments"
            element={
              <RoleRouteGuard allowedRoles={['admin']}>
                <DepartmentsPage />
              </RoleRouteGuard>
            }
          />

          <Route
            path="/manager/employees"
            element={
              <RoleRouteGuard allowedRoles={['manager']}>
                <EmployeesPage readOnly />
              </RoleRouteGuard>
            }
          />

          <Route
            path="/manager/departments"
            element={
              <RoleRouteGuard allowedRoles={['manager']}>
                <DepartmentsPage readOnly />
              </RoleRouteGuard>
            }
          />

          <Route
            path="/employee/dashboard"
            element={
              <RoleRouteGuard allowedRoles={['employee']}>
                <EmployeeDashboardPage />
              </RoleRouteGuard>
            }
          />

          <Route path="*" element={<HomeRedirect />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
