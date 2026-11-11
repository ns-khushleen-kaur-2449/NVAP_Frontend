import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  authLogin, authLoginMfa, authLogout, authRegister, changePassword as changePasswordRequest, getMe, verifyMfaEnrollment,
} from '@/lib/api';
import { creatableRoles as creatableRolesOf, hasPermission } from '@/lib/rbac';

const AuthContext = createContext(null);

const TOKEN_KEY = 'estateops_token';
const USER_KEY = 'estateops_user';

// What the server can require before anything else (see X-Auth-Required-Action).
export const REQUIRED_ACTIONS = Object.freeze({
  CHANGE_PASSWORD: 'password_change_required',
  TENANT_SUSPENDED: 'tenant_suspended',
  // A Super Admin without two-factor authentication: only the setup screen until it's done.
  MFA_ENROLLMENT: 'mfa_enrollment_required',
});

// What the server says the user must do first, from /me or a sign-in response.
const actionFor = (me) => {
  if (me?.must_change_password) return REQUIRED_ACTIONS.CHANGE_PASSWORD;
  if (me?.mfa?.required && !me?.mfa?.session_verified) return REQUIRED_ACTIONS.MFA_ENROLLMENT;
  return null;
};

const readCachedUser = () => {
  const cached = localStorage.getItem(USER_KEY);
  if (!cached) return null;
  const trimmed = cached.trim();
  if (!trimmed.startsWith('{')) {
    localStorage.removeItem(USER_KEY);
    return null;
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    localStorage.removeItem(USER_KEY);
    return null;
  }
};

/**
 * The logged-in user, loaded once from /api/auth/me after login (and on reload), with
 * role, tenant, team, permissions and creatable_roles.  The cached copy is shown only
 * until /me answers; the server's answer always wins.
 */
export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(() => (localStorage.getItem(TOKEN_KEY) ? readCachedUser() : null));
  const [loading, setLoading] = useState(Boolean(localStorage.getItem(TOKEN_KEY)));
  const [requiredAction, setRequiredAction] = useState(null);

  const storeUser = useCallback((next) => {
    setUser(next);
    if (next) localStorage.setItem(USER_KEY, JSON.stringify(next));
    else localStorage.removeItem(USER_KEY);
    setRequiredAction(actionFor(next));
  }, []);

  const logout = useCallback(() => {
    // End the server session too; the token is dropped here whatever the answer.
    const current = localStorage.getItem(TOKEN_KEY);
    if (current) authLogout(current).catch(() => {});
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
    setRequiredAction(null);
  }, []);

  const refreshMe = useCallback(async () => {
    try {
      const response = await getMe();
      storeUser(response.data);
      return response.data;
    } catch (error) {
      const status = error.response?.status;
      const action = error.response?.headers?.['x-auth-required-action'];
      if (status === 403 && action) setRequiredAction(action);
      else if (status === 401) logout();
      return null;
    }
  }, [logout, storeUser]);

  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) {
      setLoading(false);
      return;
    }
    refreshMe().finally(() => setLoading(false));
  }, [refreshMe]);

  // Any request the server refuses with a required action (see api.js) switches the screen.
  useEffect(() => {
    const onRequiredAction = (event) => setRequiredAction(event.detail);
    window.addEventListener('auth:required-action', onRequiredAction);
    return () => window.removeEventListener('auth:required-action', onRequiredAction);
  }, []);

  const startSession = async (data) => {
    const newToken = data?.token || data?.access_token;
    if (!newToken) throw new Error('Login response missing token');
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
    // The login response already says who this is; /me adds permissions, tenant, team and MFA status.
    storeUser({ ...(data?.user || {}), must_change_password: Boolean(data?.must_change_password),
      mfa: data?.mfa_enrollment_required ? { required: true, session_verified: false } : undefined });
    await refreshMe();
    return data;
  };

  /** Password step. A Super Admin with MFA gets `{ mfa_required, mfa_token }` back and no session yet. */
  const login = async (email, password) => {
    const r = await authLogin({ email, password });
    if (r.data?.mfa_required) return r.data;
    return startSession(r.data);
  };

  /** Second step: the challenge from `login` and a code or one recovery code. */
  const completeMfaLogin = async (mfaToken, codes) => {
    const r = await authLoginMfa(mfaToken, codes);
    return startSession(r.data);
  };

  /** Finish two-factor setup: the server swaps this enrollment-only session for a verified one. */
  const completeMfaEnrollment = async (code) => {
    const r = await verifyMfaEnrollment(code);
    localStorage.setItem(TOKEN_KEY, r.data.access_token);
    setToken(r.data.access_token);
    return r.data;  // { recovery_codes } are shown once by the caller, which then calls refreshMe()
  };

  // Kept for the old self-registration form; /register now redirects to /login.
  const register = async (name, email, password, role) => {
    const r = await authRegister({ name, email, password, role });
    return r.data;
  };

  const changePassword = async (currentPassword, newPassword) => {
    const r = await changePasswordRequest(currentPassword, newPassword);
    await refreshMe();
    return r.data;
  };

  const hasRole = (...roles) => Boolean(user) && roles.includes(user.role);
  const can = (permission) => hasPermission(user, permission);

  return (
    <AuthContext.Provider value={{
      user, token, loading, login, completeMfaLogin, completeMfaEnrollment, register, logout, hasRole, can, refreshMe,
      changePassword,
      role: user?.role || null,
      creatableRoles: creatableRolesOf(user),
      requiredAction,
      mustChangePassword: requiredAction === REQUIRED_ACTIONS.CHANGE_PASSWORD,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

// Exported for component tests that render with a fixed user.
export { AuthContext };
