import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import type { User } from '../types';
import { getMe, logout as logoutApi } from '../api/auth';
import { API_URL } from '../api/client';
import { clearAuthToken, setAuthToken } from '../lib/auth';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: () => void;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get('auth_token');

    if (tokenFromUrl) {
      setAuthToken(tokenFromUrl);
      window.history.replaceState({}, '', window.location.pathname);
    }

    getMe()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  function login() {
    window.location.href = `${API_URL}/auth/spotify`;
  }

  async function logout() {
    clearAuthToken();
    try {
      await logoutApi();
    } catch {
      // Stateless token logout: server-side call is best-effort.
    }
    setUser(null);
    navigate('/');
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
