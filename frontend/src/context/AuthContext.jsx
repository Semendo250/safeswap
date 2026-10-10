import { createContext, useState, useEffect } from 'react';
import socket from '../socket';
import api from '../api/axios';
import { requestPushToken, getNotificationPermission } from '../firebase';
import { registerPushToken, removePushToken } from '../api/notifications.api';

export const AuthContext = createContext(null);

const PUSH_TOKEN_KEY = 'safeswap_push_token';

function readSavedPushToken() {
  try {
    return localStorage.getItem(PUSH_TOKEN_KEY);
  } catch (err) {
    return null;
  }
}

function savePushToken(value) {
  try {
    if (value) localStorage.setItem(PUSH_TOKEN_KEY, value);
    else localStorage.removeItem(PUSH_TOKEN_KEY);
  } catch (err) {
    // storage blocked, push still works for this session
  }
}

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
  const [pushToken, setPushToken] = useState(readSavedPushToken);

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

  // Silent push registration after login: if the person has already allowed notifications,
  // register this device's token. This never shows a permission prompt. The prompt is shown
  // from the "Turn on notifications" button in the bell (see enablePush below), because
  // phones ignore prompts that don't come from a tap.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    requestPushToken().then((t) => {
      if (cancelled || !t) return;
      savePushToken(t);
      setPushToken(t);
      registerPushToken(t).catch(() => {});
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Called from a button tap: asks for permission, then registers the device.
  // Returns the resulting permission: 'granted' | 'denied' | 'default' | 'unsupported'
  async function enablePush() {
    const t = await requestPushToken({ prompt: true });
    if (t) {
      savePushToken(t);
      setPushToken(t);
      registerPushToken(t).catch(() => {});
    }
    return getNotificationPermission();
  }

  function login(userData, jwt) {
    setUser(userData);
    setToken(jwt);
    localStorage.setItem('token', jwt);
    api.defaults.headers.common['Authorization'] = `Bearer ${jwt}`;
  }

  function logout() {
    // Use the saved copy too, so logging out after a page refresh still unregisters this device
    const deviceToken = pushToken || readSavedPushToken();
    if (deviceToken) {
      removePushToken(deviceToken).catch(() => {});
    }
    savePushToken(null);
    setPushToken(null);

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
    <AuthContext.Provider value={{ user, token, login, logout, updateUser, enablePush, loading }}>
      {children}
    </AuthContext.Provider>
  );
}