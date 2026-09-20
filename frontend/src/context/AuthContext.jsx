import { createContext, useState, useEffect } from 'react';
import socket from '../socket';
import api from '../api/axios';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      socket.connect();
      api.get('/auth/me')
        .then((res) => setUser(res.data))
        .catch(() => {
          // token invalid/expired - clear it
          localStorage.removeItem('token');
          setToken(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
    return () => socket.disconnect();
  }, [token]);

  function login(userData, jwt) {
    setUser(userData);
    setToken(jwt);
    localStorage.setItem('token', jwt);
    api.defaults.headers.common['Authorization'] = `Bearer ${jwt}`;
  }

  function logout() {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    delete api.defaults.headers.common['Authorization'];
    socket.disconnect();
  }

  // Merge new fields into the logged-in user (used after editing the profile)
  function updateUser(patch) {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, updateUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
}