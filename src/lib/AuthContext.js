import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authLogin, authRegister } from '@/lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('estateops_token'));

  const normalizeUser = (rawUser) => {
    if (!rawUser) return null;
    if (!rawUser.role) return { ...rawUser, role: 'agent' };
    return rawUser;
  };

  const loadUser = useCallback(() => {
    const saved = localStorage.getItem('estateops_token');
    const cachedUser = localStorage.getItem('estateops_user');
    if (saved && cachedUser) {
      const trimmed = cachedUser.trim();
      const looksLikeJson = trimmed.startsWith('{') || trimmed.startsWith('[');
      if (trimmed !== 'undefined' && trimmed !== 'null' && looksLikeJson) {
        try {
          setUser(normalizeUser(JSON.parse(trimmed)));
          setToken(saved);
        } catch {
          localStorage.removeItem('estateops_user');
          setUser(null);
          setToken(saved);
        }
      } else {
        localStorage.removeItem('estateops_user');
        setUser(null);
        setToken(saved);
      }
    } else {
      setUser(null);
      setToken(saved || null);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadUser(); }, [loadUser]);

  const login = async (email, password) => {
    const r = await authLogin({ email, password });
    const token = r.data?.token || r.data?.access_token;
    if (!token) {
      throw new Error('Login response missing token');
    }
    const user = normalizeUser(r.data?.user || (r.data?.user_id ? { id: r.data.user_id } : null));
    localStorage.setItem('estateops_token', token);
    if (user) {
      localStorage.setItem('estateops_user', JSON.stringify(user));
    }
    setToken(token);
    setUser(user);
    return r.data;
  };

  const register = async (name, email, password, role) => {
    const r = await authRegister({ name, email, password, role });
    const token = r.data?.token || r.data?.access_token;
    if (!token) {
      throw new Error('Registration response missing token');
    }
    const user = normalizeUser(r.data?.user || (r.data?.user_id ? { id: r.data.user_id, role } : null));
    localStorage.setItem('estateops_token', token);
    if (user) {
      localStorage.setItem('estateops_user', JSON.stringify(user));
    }
    setToken(token);
    setUser(user);
    return r.data;
  };

  const logout = () => {
    localStorage.removeItem('estateops_token');
    localStorage.removeItem('estateops_user');
    setToken(null);
    setUser(null);
  };

  const hasRole = (...roles) => user && roles.includes(user.role);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
