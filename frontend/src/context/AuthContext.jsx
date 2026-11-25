import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { toast } from 'sonner';
import api, {
  clearStoredAuthTokens,
  REFRESH_TOKEN_STORAGE_KEY,
  SESSION_EXPIRED_EVENT,
  setStoredAuthTokens,
  TOKEN_STORAGE_KEY,
} from '../services/api';

const AuthContext = createContext(null);

export function getDefaultRouteForRole(role) {
  switch (role) {
    case 'admin':
      return '/admin/dashboard';
    case 'manager':
      return '/manager/dashboard';
    case 'employee':
      return '/employee/dashboard';
    default:
      return '/login';
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(() =>
    Boolean(
      localStorage.getItem(TOKEN_STORAGE_KEY) ||
        localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY)
    )
  );

  const fetchProfile = useCallback(async () => {
    const hasStoredSession = Boolean(
      localStorage.getItem(TOKEN_STORAGE_KEY) ||
        localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY)
    );
    if (!hasStoredSession) {
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
      clearStoredAuthTokens();
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    const handleSessionExpired = () => {
      clearStoredAuthTokens();
      setUser(null);
      setLoading(false);
      toast.info('Sesi Anda telah berakhir. Silakan masuk kembali.', {
        id: 'wb-session-expired',
      });
    };

    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => {
      window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    };
  }, []);

  const login = async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    const data = response.data?.data || {};
    const accessToken = data.access_token || data.token;
    const refreshToken = data.refresh_token;
    const loggedInUser = data.user;

    setStoredAuthTokens(accessToken, refreshToken);
    setUser(loggedInUser);
    return loggedInUser;
  };

  const logout = async () => {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
    try {
      await api.delete('/auth/logout', {
        data: refreshToken ? { refresh_token: refreshToken } : undefined,
      });
    } catch {
      // Clear local session regardless of server token expiry
    } finally {
      clearStoredAuthTokens();
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
