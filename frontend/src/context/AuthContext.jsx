import { createContext, useState, useEffect } from 'react';
import socket from '../socket';
import api from '../api/axios';
import { requestPushToken } from '../firebase';
import { registerPushToken, removePushToken } from '../api/notifications.api';

export const AuthContext = createContext(null);

// Attach the saved login token immediately, when the app loads. Without this, pages that
// fetch data as soon as they open (Admin, Profile, Inbox) send their request before
// AuthProvider's effect runs, and fail with 401 after a refresh.
const savedToken = localStorage.getItem('token');
if (savedToken) {
  api.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`;
}

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

    // Tell the server which user this socket belongs to, for online/offline status.
  // Re-registers on every reconnect too (e.g. after the free-tier server sleeps and wakes)
  useEffect(() => {
    if (!user) return;
    function doRegister() {
      socket.emit('register', user.id);
    }
    doRegister();
    socket.on('connect', doRegister);
    return () => socket.off('connect', doRegister);
  }, [user]);

    const [pushToken, setPushToken] = useState(null);

  // Ask for push permission and register the device token once logged in.
  // Silently does nothing if the person denies permission or the browser
  // doesn't support it (e.g. iOS Safari outside of an installed PWA).
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    requestPushToken().then((token) => {
      if (cancelled || !token) return;
      setPushToken(token);
      registerPushToken(token).catch(() => {});
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  function login(userData, jwt) {
    setUser(userData);
    setToken(jwt);
    localStorage.setItem('token', jwt);
    api.defaults.headers.common['Authorization'] = `Bearer ${jwt}`;
  }

    function logout() {
    if (pushToken) {
      removePushToken(pushToken).catch(() => {});
      setPushToken(null);
    }
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