import { useState, useEffect, createContext, useContext } from 'react';
import { authApi } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('devlens_token');
    if (!token) {
      setLoading(false);
      return;
    }
    authApi.get('/me')
      .then((res) => setUser(res.data.data))
      .catch(() => localStorage.removeItem('devlens_token'))
      .finally(() => setLoading(false));
  }, []);

  function login(token, username) {
    localStorage.setItem('devlens_token', token);
    setUser({ username });
    // Fetch full profile in background
    authApi.get('/me').then((res) => setUser(res.data.data)).catch(() => {});
  }

  function logout() {
    localStorage.removeItem('devlens_token');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
