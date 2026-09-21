import { useContext, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const ADMIN_LINKS = [
  { to: '/admin', label: 'Dashboard' },
  { to: '/admin/users', label: 'Users' },
  { to: '/admin/verification', label: 'Verification queue' },
  { to: '/admin/listings', label: 'All listings' },
  { to: '/admin/flagged', label: 'Flagged queue' },
  { to: '/admin/payments', label: 'Payments' },
  { to: '/admin/blacklist', label: 'IMEI blacklist' },
  { to: '/admin/activity', label: 'Activity log' },
];

export default function Navbar() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const navRef = useRef(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

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
          background: '#fff',
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
              <div style={dropdownStyle}>
                {ADMIN_LINKS.map((item) => (
                  <Link key={item.to} to={item.to} className={linkClass(item.to)}>
                    {item.label}
                  </Link>
                ))}
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

            <div className="sw-nav-desktop">
              <Link to="/browse" className="nav-pill">Browse</Link>
              {user ? (
                <>
                  <Link to="/messages" className="nav-pill">Messages</Link>
                  <Link to="/create-listing" className="nav-pill">Create listing</Link>
                  {isAdmin && <Link to="/admin" className="nav-pill">Admin</Link>}
                  <Link to="/profile" className="nav-pill">Profile</Link>
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
            </div>

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
                    <Link to="/messages" className={linkClass('/messages')}>Messages</Link>
                    <Link to="/create-listing" className={linkClass('/create-listing')}>Create listing</Link>
                    {isAdmin && <Link to="/admin" className={linkClass('/admin', true)}>Admin</Link>}
                    <Link to="/profile" className={linkClass('/profile')}>Profile</Link>
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
              background: '#fff',
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
                  background: '#fff',
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
  background: '#fff',
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