import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, getDefaultRouteForRole, useAuth } from './context/AuthContext';
import RoleRouteGuard from './context/RoleRouteGuard';
import LoginPage from './pages/LoginPage';
import DepartmentsPage from './pages/admin/DepartmentsPage';
import EmployeesPage from './pages/admin/EmployeesPage';
import TrainingParticipationsPage from './pages/admin/TrainingParticipationsPage';
import TrainingsPage from './pages/admin/TrainingsPage';
import EmployeeDashboardPage from './pages/employee/EmployeeDashboardPage';
import TaskAssignmentsPage from './pages/manager/TaskAssignmentsPage';
import TasksPage from './pages/manager/TasksPage';

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
            path="/admin/tasks"
            element={
              <RoleRouteGuard allowedRoles={['admin']}>
                <TasksPage />
              </RoleRouteGuard>
            }
          />

          <Route
            path="/admin/task-assignments"
            element={
              <RoleRouteGuard allowedRoles={['admin']}>
                <TaskAssignmentsPage />
              </RoleRouteGuard>
            }
          />

          <Route
            path="/admin/trainings"
            element={
              <RoleRouteGuard allowedRoles={['admin']}>
                <TrainingsPage />
              </RoleRouteGuard>
            }
          />

          <Route
            path="/admin/training-participations"
            element={
              <RoleRouteGuard allowedRoles={['admin']}>
                <TrainingParticipationsPage />
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
            path="/manager/tasks"
            element={
              <RoleRouteGuard allowedRoles={['manager']}>
                <TasksPage />
              </RoleRouteGuard>
            }
          />

          <Route
            path="/manager/task-assignments"
            element={
              <RoleRouteGuard allowedRoles={['manager']}>
                <TaskAssignmentsPage />
              </RoleRouteGuard>
            }
          />

          <Route
            path="/manager/trainings"
            element={
              <RoleRouteGuard allowedRoles={['manager']}>
                <TrainingsPage />
              </RoleRouteGuard>
            }
          />

          <Route
            path="/manager/training-participations"
            element={
              <RoleRouteGuard allowedRoles={['manager']}>
                <TrainingParticipationsPage />
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

          <Route
            path="/employee/tasks"
            element={
              <RoleRouteGuard allowedRoles={['employee']}>
                <TasksPage readOnly />
              </RoleRouteGuard>
            }
          />

          <Route
            path="/employee/task-assignments"
            element={
              <RoleRouteGuard allowedRoles={['employee']}>
                <TaskAssignmentsPage readOnly />
              </RoleRouteGuard>
            }
          />

          <Route
            path="/employee/training-participations"
            element={
              <RoleRouteGuard allowedRoles={['employee']}>
                <TrainingParticipationsPage readOnly />
              </RoleRouteGuard>
            }
          />

          <Route path="*" element={<HomeRedirect />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
