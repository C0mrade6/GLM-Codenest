import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, getToken, setToken } from '../api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      if (getToken()) {
        try {
          const { user: me } = await api('/api/auth/me');
          setUser(me);
        } catch {
          setToken(null);
        }
      }
      setReady(true);
    })();
  }, []);

  const login = useCallback(async (username, password) => {
    const { token, user: me } = await api('/api/auth/login', { method: 'POST', body: { username, password } });
    setToken(token);
    setUser(me);
    return me;
  }, []);

  const register = useCallback(async (username, password, displayName) => {
    const { token, user: me } = await api('/api/auth/register', { method: 'POST', body: { username, password, displayName } });
    setToken(token);
    setUser(me);
    return me;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, ready, login, register, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
