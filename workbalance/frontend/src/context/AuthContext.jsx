import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api, { TOKEN_STORAGE_KEY } from '../services/api';

const AuthContext = createContext(null);

export function getDefaultRouteForRole(role) {
  switch (role) {
    case 'admin':
      return '/admin/employees';
    case 'manager':
      return '/manager/employees';
    case 'employee':
      return '/employee/dashboard';
    default:
      return '/login';
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem(TOKEN_STORAGE_KEY)));

  const fetchProfile = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!token) {
      setUser(null);
      setLoading(false);
      return null;
    }

    try {
      const response = await api.get('/auth/me');
      const activeUser = response.data?.data?.user || null;
      setUser(activeUser);
      return activeUser;
    } catch {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const login = async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    const { token, user: loggedInUser } = response.data.data;
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    setUser(loggedInUser);
    return loggedInUser;
  };

  const logout = async () => {
    try {
      await api.delete('/auth/logout');
    } catch {
      // Clear local session regardless of server token expiry
    } finally {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, fetchProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside an AuthProvider');
  }
  return context;
}
