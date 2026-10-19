import { useContext, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import { getNeedsAttention } from '../api/admin.api';
import { getUnreadMessages } from '../api/chat.api';
import NotificationBell from './NotificationBell';

const ICON_PATHS = {
  star: <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />,
  alert: (
    <>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </>
  ),
  userx: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="m17 8 5 5" />
      <path d="m22 8-5 5" />
    </>
  ),
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  idcard: (
    <>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <circle cx="8" cy="12" r="2" />
      <path d="M14 10h4" />
      <path d="M14 14h4" />
    </>
  ),
  listings: (
    <>
      <path d="M3 5h.01" />
      <path d="M3 12h.01" />
      <path d="M3 19h.01" />
      <path d="M8 5h13" />
      <path d="M8 12h13" />
      <path d="M8 19h13" />
    </>
  ),
  flag: (
    <>
      <path d="M4 22V4" />
      <path d="M4 4h12l-2 4 2 4H4" />
    </>
  ),
  payments: (
    <>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
    </>
  ),
  offers: (
    <>
      <path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <path d="M7 7h.01" />
    </>
  ),
  block: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="m4.9 4.9 14.2 14.2" />
    </>
  ),
  complaints: (
    <>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <path d="M12 7v4" />
      <path d="M12 14h.01" />
    </>
  ),
  broadcast: (
    <>
      <path d="m3 11 18-5v12L3 14v-3z" />
      <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
    </>
  ),
  pin: (
    <>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
      <circle cx="12" cy="10" r="3" />
    </>
  ),
  history: (
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l4 2" />
    </>
  ),
  logout: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </>
  ),
};

function Icon({ name, size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICON_PATHS[name]}
    </svg>
  );
}

const ADMIN_LINKS = [
  { to: '/admin', label: 'Dashboard', icon: 'dashboard' },
  { to: '/admin/users', label: 'Users', icon: 'users' },
  { to: '/admin/verification', label: 'Verification queue', icon: 'idcard' },
  { to: '/admin/listings', label: 'All listings', icon: 'listings' },
  { to: '/admin/flagged', label: 'Flagged queue', icon: 'flag' },
  { to: '/admin/reports', label: 'Reports', icon: 'alert' },
  { to: '/admin/payments', label: 'Payments', icon: 'payments' },
  { to: '/admin/offers', label: 'Offers', icon: 'offers' },
  { to: '/admin/reviews', label: 'Reviews', icon: 'star' },
  { to: '/admin/blacklist', label: 'IMEI blacklist', icon: 'block' },
  { to: '/admin/blocks', label: 'Blocks', icon: 'userx' },
  { to: '/admin/disputes', label: 'Complaints', icon: 'complaints' },
  { to: '/admin/broadcast', label: 'Broadcast', icon: 'broadcast' },
  { to: '/admin/safe-zones', label: 'Meetup spots', icon: 'pin' },
  { to: '/admin/activity', label: 'Activity log', icon: 'history' },
];

// How many items are waiting on each admin page (0 shows no badge)
function badgeCount(to, d) {
  if (!d) return 0;
  if (to === '/admin/verification') return d.pendingVerifications || 0;
  if (to === '/admin/flagged') return d.pendingListings || 0;
  if (to === '/admin/reports') return d.openReports || 0;
  if (to === '/admin/offers') return d.offerFlags || 0;
  if (to === '/admin/payments') return (d.heldOverThreeDays || 0) + (d.stuckPending || 0);
  if (to === '/admin/disputes') return d.openDisputes || 0;
  return 0;
}

export default function Navbar() {
  const { theme, toggleTheme } = useContext(ThemeContext);
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const navRef = useRef(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [attention, setAttention] = useState(null);
  const [unreadMsgs, setUnreadMsgs] = useState(0);

  const isAdmin = user?.role === 'admin';
  const onAdminPage = isAdmin && location.pathname.startsWith('/admin');

  useEffect(() => {
    setMenuOpen(false);
    setAdminMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen && !adminMenuOpen) return;
    function onPointerDown(e) {
      if (navRef.current && !navRef.current.contains(e.target)) {
        setMenuOpen(false);
        setAdminMenuOpen(false);
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [menuOpen, adminMenuOpen]);

  useEffect(() => {
    if (!confirmOpen) return;
    function onKey(e) {
      if (e.key === 'Escape') setConfirmOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [confirmOpen]);

  // Load the badge numbers each time the admin menu opens
  useEffect(() => {
    if (!adminMenuOpen || !isAdmin) return;
    let cancelled = false;
    getNeedsAttention()
      .then((res) => {
        if (!cancelled) setAttention(res.data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [adminMenuOpen, isAdmin]);

  useEffect(() => {
    if (!user) {
      setUnreadMsgs(0);
      return;
    }
    let cancelled = false;
    function load() {
      getUnreadMessages()
        .then((res) => {
          if (!cancelled) setUnreadMsgs(res.data.unreadCount || 0);
        })
        .catch(() => {});
    }
    load();
    const timer = setInterval(load, 20000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [user?.id, location.pathname]);

  const msgBadge =
    unreadMsgs > 0 ? (
      <span
        aria-label={`${unreadMsgs} unread`}
        style={{
          marginLeft: 6,
          minWidth: 18,
          height: 18,
          padding: '0 5px',
          borderRadius: 999,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          fontWeight: 700,
          background: 'var(--color-warning)',
          color: '#fff',
          verticalAlign: 'middle',
        }}
      >
        {unreadMsgs > 9 ? '9+' : unreadMsgs}
      </span>
    ) : null;

  function toggleMenu() {
    setMenuOpen((v) => !v);
  }
  function toggleAdminMenu() {
    setAdminMenuOpen((v) => !v);
  }
  function askLogout() {
    setMenuOpen(false);
    setAdminMenuOpen(false);
    setConfirmOpen(true);
  }
  function confirmLogout() {
    logout();
    setConfirmOpen(false);
    navigate('/');
  }
  function exitAdmin() {
    setAdminMenuOpen(false);
    navigate('/');
  }

  function linkClass(path, startsWith = false) {
    const active = startsWith ? location.pathname.startsWith(path) : location.pathname === path;
    return active ? 'sw-menu-link active' : 'sw-menu-link';
  }

  return (
    <>
      <style>{`
        .sw-nav-desktop { display: flex; gap: 16px; align-items: center; font-size: 14px; font-weight: 500; flex-shrink: 0; }
        .sw-nav-burger { display: none; }
        @media (max-width: 767px) {
          .sw-nav-desktop { display: none; }
          .sw-nav-burger { display: inline-flex; }
        }
        .sw-menu-link {
          display: block; width: 100%; box-sizing: border-box; padding: 12px 8px;
          border-radius: 8px; color: var(--color-ink); font-size: 15px; font-weight: 500;
          text-align: left; text-decoration: none; cursor: pointer;
        }
        .sw-menu-link:active { background: var(--color-surface); }
        .sw-menu-link.active { color: var(--color-teal); font-weight: 700; }

        .sw-admin-grid {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px;
        }
        a.sw-admin-card {
          position: relative; display: flex; flex-direction: column; gap: 14px; min-width: 0;
          padding: 14px; border: 1px solid var(--color-border); border-radius: 12px;
          background: var(--color-card); color: var(--color-ink);
          font-size: 14px; font-weight: 600; line-height: 1.3; text-decoration: none;
          transition: border-color 0.15s, background 0.15s;
        }
        a.sw-admin-card:hover { border-color: var(--color-teal); text-decoration: none; }
        a.sw-admin-card.active {
          border-color: var(--color-teal); color: var(--color-teal);
          background: color-mix(in srgb, var(--color-teal) 10%, var(--color-card));
        }
        .sw-admin-tile {
          width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          background: color-mix(in srgb, var(--color-teal) 14%, var(--color-card)); color: var(--color-teal);
        }
        .sw-admin-badge {
          position: absolute; top: 10px; right: 10px; min-width: 22px; height: 22px; padding: 0 6px;
          border-radius: 999px; display: flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 700; background: var(--color-warning-bg); color: var(--color-warning);
        }
        .sw-admin-foot {
          display: flex; align-items: center; margin-top: 16px; padding-top: 12px;
          border-top: 1px solid var(--color-border);
        }
        button.sw-admin-logout {
          display: inline-flex; align-items: center; gap: 8px; min-width: 0; align-self: auto;
          padding: 6px 4px; border: none; background: transparent;
          color: var(--color-warning); font-size: 14px; font-weight: 600;
        }
        button.sw-admin-logout:hover { background: transparent; color: var(--color-warning); }
      `}</style>

      <nav
        ref={navRef}
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          height: '60px',
          boxSizing: 'border-box',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          borderBottom: '3px solid var(--color-teal)',
          background: 'var(--color-card)',
        }}
      >
        {onAdminPage ? (
          <>
            {/* Back arrow and hamburger are the same width, so "Admin" sits exactly in the middle */}
            <button
              onClick={exitAdmin}
              aria-label="Exit admin"
              style={{ ...iconBtn, display: 'inline-flex', color: 'var(--color-ink)', marginLeft: '-10px' }}
            >
              &larr;
            </button>

            <div style={{ flex: 1, textAlign: 'center', fontWeight: 700, color: 'var(--color-primary)' }}>
              Admin
            </div>

            {/* Bell + theme toggle — always visible on the admin bar too, both desktop and mobile */}
            <NotificationBell />
            <button
              onClick={toggleTheme}
              aria-label="Toggle dark mode"
              style={{ ...iconBtn, width: 36, height: 36, fontSize: 16, color: 'var(--color-ink)' }}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>

            {/* Admin hamburger: plain icon, no border, far right */}
            <button
              onClick={toggleAdminMenu}
              aria-expanded={adminMenuOpen}
              aria-label="Admin menu"
              style={{ ...iconBtn, display: 'inline-flex', color: 'var(--color-teal)', marginRight: '-10px' }}
            >
              {adminMenuOpen ? '✕' : '☰'}
            </button>

            {adminMenuOpen && (
              <div style={adminDropdownStyle}>
                <div className="sw-admin-grid">
                  {ADMIN_LINKS.map((item) => {
                    const active = location.pathname === item.to;
                    const n = badgeCount(item.to, attention);
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        className={active ? 'sw-admin-card active' : 'sw-admin-card'}
                        aria-current={active ? 'page' : undefined}
                      >
                        <span className="sw-admin-tile">
                          <Icon name={item.icon} size={18} />
                        </span>
                        <span>{item.label}</span>
                        {n > 0 && (
                          <span className="sw-admin-badge" aria-label={`${n} waiting`}>
                            {n > 99 ? '99+' : n}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>

                <div className="sw-admin-foot">
                  <button type="button" onClick={askLogout} className="sw-admin-logout">
                    <Icon name="logout" size={18} />
                    Log out
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <Link to="/" style={{ flexShrink: 0 }}>
              <img src="/logo-full.svg" alt="SafeSwap" style={{ height: '32px', display: 'block' }} />
            </Link>

            {/* Spacer: pushes the desktop links / hamburger to the far right */}
            <div style={{ flex: 1 }} />

            {/* Desktop nav (hidden on phones by CSS above) */}
            <div className="sw-nav-desktop">
              <Link to="/browse" className="nav-pill">Browse</Link>
              {user ? (
                <>
                  <Link to="/messages" className="nav-pill">Messages{msgBadge}</Link>
                  {!isAdmin && <Link to="/my-purchases" className="nav-pill">Purchases</Link>}
                  {!isAdmin && <Link to="/saved" className="nav-pill">Saved</Link>}
                  <Link to="/create-listing" className="nav-pill">Create listing</Link>
                  {isAdmin && <Link to="/admin" className="nav-pill">Admin</Link>}
                  <Link to="/profile" className="nav-pill">Profile</Link>
                  <NotificationBell />
                  <button onClick={askLogout} className="btn-outline">Log out</button>
                </>
              ) : (
                <>
                  <Link to="/login" style={{ color: 'var(--color-ink)' }}>Log in</Link>
                  <Link
                    to="/signup"
                    style={{ color: '#fff', background: 'var(--color-primary)', padding: '7px 14px', borderRadius: '6px' }}
                  >
                    Sign up
                  </Link>
                </>
              )}
              <button
                onClick={toggleTheme}
                aria-label="Toggle dark mode"
                style={{ ...iconBtn, width: 36, height: 36, fontSize: 16, color: 'var(--color-ink)' }}
              >
                {theme === 'dark' ? '☀️' : '🌙'}
              </button>
            </div>

            {/* Bell for phones — hidden on desktop (the desktop nav has its own), only when logged in */}
            {user && (
              <span className="sw-nav-burger">
                <NotificationBell />
              </span>
            )}

            {/* Theme toggle for phones — sits next to the hamburger, always visible regardless of menu state */}
            <button
              className="sw-nav-burger"
              onClick={toggleTheme}
              aria-label="Toggle dark mode"
              style={{ ...iconBtn, width: 36, height: 36, fontSize: 16, color: 'var(--color-ink)' }}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>

            {/* Main hamburger (phones only; its display comes from the CSS above) */}
            <button
              className="sw-nav-burger"
              onClick={toggleMenu}
              aria-expanded={menuOpen}
              aria-label="Main menu"
              style={{ ...iconBtn, color: 'var(--color-ink)', marginRight: '-10px' }}
            >
              {menuOpen ? '✕' : '☰'}
            </button>

            {menuOpen && (
              <div style={dropdownStyle}>
                <Link to="/browse" className={linkClass('/browse')}>Browse</Link>
                {user ? (
                  <>
                    <Link to="/messages" className={linkClass('/messages')}>Messages{msgBadge}</Link>
                    {!isAdmin && <Link to="/my-purchases" className={linkClass('/my-purchases')}>My purchases</Link>}
                    {!isAdmin && <Link to="/saved" className={linkClass('/saved')}>Saved items</Link>}
                    <Link to="/create-listing" className={linkClass('/create-listing')}>Create listing</Link>
                    {isAdmin && <Link to="/admin" className={linkClass('/admin', true)}>Admin</Link>}
                    <Link to="/profile" className={linkClass('/profile')}>Profile</Link>
                    {!isAdmin && (
                      <Link to="/my-complaints" className={linkClass('/my-complaints', true)}>My complaints</Link>
                    )}
                    <button
                      onClick={askLogout}
                      className="sw-menu-link"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        borderTop: '1px solid var(--color-border)',
                        borderRadius: 0,
                        marginTop: '4px',
                        color: 'var(--color-warning)',
                      }}
                    >
                      Log out
                    </button>
                  </>
                ) : (
                  <>
                    <Link to="/login" className={linkClass('/login')}>Log in</Link>
                    <Link to="/signup" className={linkClass('/signup')}>Sign up</Link>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </nav>

      {confirmOpen && (
        <div
          onClick={() => setConfirmOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-title"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--color-card)',
              borderRadius: '16px',
              padding: '24px',
              width: '100%',
              maxWidth: '340px',
              boxShadow: '0 8px 40px rgba(0,0,0,0.15)',
            }}
          >
            <h3 id="logout-title" style={{ margin: '0 0 8px', fontSize: '18px', color: 'var(--color-ink)' }}>
              Log out
            </h3>
            <p style={{ margin: '0 0 20px', fontSize: '14px', color: 'var(--color-muted)' }}>
              Are you sure you want to log out?
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                autoFocus
                onClick={() => setConfirmOpen(false)}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-card)',
                  color: 'var(--color-ink)',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmLogout}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'var(--color-warning)',
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Plain icon button: fixed 44px, no border, no background. minWidth 0 overrides the
// 110px minimum that index.css gives every button (that was stretching the menu box).
// `display` is left out on purpose so the main hamburger's show/hide CSS still works.
const iconBtn = {
  flexShrink: 0,
  width: '44px',
  height: '44px',
  minWidth: 0,
  padding: 0,
  alignSelf: 'center',
  alignItems: 'center',
  justifyContent: 'center',
  border: 'none',
  borderRadius: '6px',
  background: 'transparent',
  fontSize: '22px',
  lineHeight: 1,
  cursor: 'pointer',
};

const dropdownStyle = {
  position: 'fixed',
  top: '60px',
  left: 0,
  right: 0,
  zIndex: 60,
  background: 'var(--color-card)',
  borderBottom: '1px solid var(--color-border)',
  boxShadow: '0 4px 10px rgba(0,0,0,0.08)',
  display: 'flex',
  flexDirection: 'column',
  padding: '8px 16px',
  // Never taller than the screen under the bar; scrolls inside if it has to
  maxHeight: 'calc(100dvh - 60px)',
  overflowY: 'auto',
  overscrollBehavior: 'contain',
};

// The admin menu is a grid of cards, so it gets more padding and a plain block layout
const adminDropdownStyle = {
  ...dropdownStyle,
  display: 'block',
  padding: '16px',
};