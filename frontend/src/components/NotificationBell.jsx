import { useState, useEffect, useRef, useContext, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { onForegroundMessage, getNotificationPermission, needsHomeScreenInstall } from '../firebase';
import {
  getNotifications,
  getUnreadCount,
  markOneRead,
  markAllRead,
} from '../api/notifications.api';

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const TYPE_ICON = {
  verification_approved: '✅',
  verification_rejected: '❌',
  listing_approved: '✅',
  listing_rejected: '🚫',
  payment_status: '💳',
  new_message: '💬',
  new_listing_review: '🆕',
  listing_removed: '🚫',
  listing_flagged: '🚩',
  listing_sold: '🎉',
  meetup_confirmed: '🤝',
  new_verification_request: '🪪',
  new_report: '⚠️',
};

export default function NotificationBell() {
  const { user, enablePush } = useContext(AuthContext);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [perm, setPerm] = useState(getNotificationPermission);
  const [enabling, setEnabling] = useState(false);
  const wrapRef = useRef(null);

  const refreshCount = useCallback(() => {
    if (!user) return;
    getUnreadCount()
      .then((res) => setUnreadCount(res.data.unreadCount))
      .catch(() => {});
  }, [user]);

  // Poll the unread count every 20s, so the badge stays current even without a push
  useEffect(() => {
    if (!user) return;
    refreshCount();
    const interval = setInterval(refreshCount, 20000);
    return () => clearInterval(interval);
  }, [user, refreshCount]);

  // A push that arrives while the app is open and focused bumps the badge immediately
  useEffect(() => {
    if (!user) return;
    let unsubscribe;
    onForegroundMessage(() => refreshCount()).then((fn) => {
      unsubscribe = fn;
    });
    return () => unsubscribe?.();
  }, [user, refreshCount]);

  // Close on outside tap
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      setPerm(getNotificationPermission());
      setLoading(true);
      try {
        const res = await getNotifications(1);
        setNotifications(res.data.notifications);
      } finally {
        setLoading(false);
      }
    }
  }

  async function handleItemClick(n) {
    setOpen(false);
    setNotifications((prev) => prev.filter((x) => x._id !== n._id));
    setUnreadCount((c) => Math.max(0, c - (n.read ? 0 : 1)));
    if (!n.read) markOneRead(n._id).catch(() => {});
    if (n.link) navigate(n.link);
  }

  async function handleMarkAll() {
    setUnreadCount(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await markAllRead();
    } catch (err) {
      // best effort
    }
  }

  // Runs from a button tap, which is what lets phones show the permission prompt
  async function handleEnable() {
    setEnabling(true);
    try {
      const result = await enablePush();
      setPerm(result);
    } finally {
      setEnabling(false);
    }
  }

  if (!user) return null;

  // What to show above the list about push notifications
  let pushBanner = null;
  const bannerBox = {
    padding: '10px 14px',
    borderBottom: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    fontSize: 12,
    color: 'var(--color-muted)',
    lineHeight: 1.5,
  };
  if (perm === 'unsupported' && needsHomeScreenInstall()) {
    pushBanner = (
      <div style={bannerBox}>
        To get notifications on iPhone, tap Share, then "Add to Home Screen", and open SafeSwap from your Home
        Screen.
      </div>
    );
  } else if (perm === 'default') {
    pushBanner = (
      <div style={{ ...bannerBox, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <span style={{ flex: 1, minWidth: 0 }}>Get alerts on this device even when SafeSwap is closed.</span>
        <button
          type="button"
          onClick={handleEnable}
          disabled={enabling}
          style={{
            minWidth: 0,
            alignSelf: 'center',
            padding: '6px 10px',
            fontSize: 12,
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          {enabling ? 'Please wait...' : 'Turn on'}
        </button>
      </div>
    );
  } else if (perm === 'denied') {
    pushBanner = (
      <div style={bannerBox}>
        Notifications are blocked for this site. Tap the lock icon next to the address bar, open Permissions, and
        allow Notifications.
      </div>
    );
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        onClick={toggle}
        aria-label="Notifications"
        style={{
          position: 'relative',
          width: 36,
          height: 36,
          minWidth: 0,
          padding: 0,
          border: 'none',
          background: 'transparent',
          fontSize: 18,
          lineHeight: 1,
          cursor: 'pointer',
          color: 'var(--color-ink)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        🔔
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: 2,
              right: 2,
              background: 'var(--color-warning)',
              color: '#fff',
              fontSize: 10,
              fontWeight: 700,
              borderRadius: 999,
              minWidth: 16,
              height: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 3px',
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 44,
            right: 0,
            width: 320,
            maxWidth: 'calc(100vw - 32px)',
            maxHeight: 420,
            overflowY: 'auto',
            background: 'var(--color-card)',
            border: '1px solid var(--color-border)',
            borderRadius: 12,
            boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
            zIndex: 200,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px',
              borderBottom: '1px solid var(--color-border)',
            }}
          >
            <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-ink)' }}>Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAll}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-teal)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  minWidth: 0,
                  padding: 0,
                }}
              >
                Mark all read
              </button>
            )}
          </div>

          {pushBanner}

          {loading && (
            <p style={{ padding: '20px', textAlign: 'center', fontSize: 13, color: 'var(--color-muted)' }}>
              Loading...
            </p>
          )}

          {!loading && notifications.length === 0 && (
            <p style={{ padding: '24px 16px', textAlign: 'center', fontSize: 13, color: 'var(--color-muted)' }}>
              No notifications yet
            </p>
          )}

          {!loading &&
            notifications.map((n) => (
              <button
                key={n._id}
                onClick={() => handleItemClick(n)}
                style={{
                  display: 'flex',
                  gap: 10,
                  width: '100%',
                  textAlign: 'left',
                  padding: '12px 14px',
                  border: 'none',
                  borderBottom: '1px solid var(--color-border)',
                  background: n.read ? 'transparent' : 'color-mix(in srgb, var(--color-primary) 6%, transparent)',
                  cursor: 'pointer',
                  minWidth: 0,
                }}
              >
                <span style={{ fontSize: 16, flexShrink: 0 }}>{TYPE_ICON[n.type] || '🔔'}</span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--color-ink)' }}>
                    {n.title}
                  </span>
                  {n.body && (
                    <span style={{ display: 'block', fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>
                      {n.body}
                    </span>
                  )}
                  <span style={{ display: 'block', fontSize: 11, color: 'var(--color-muted)', marginTop: 3 }}>
                    {timeAgo(n.createdAt)}
                  </span>
                </span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}