import { useContext, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  function handleLogout() {
    logout();
    setMenuOpen(false);
    navigate('/');
  }

  return (
    <nav
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        height: '60px',
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        borderBottom: '3px solid var(--color-teal)',
        background: '#fff',
      }}
    >
      <Link to="/" onClick={() => setMenuOpen(false)}>
        <img src="/logo-full.svg" alt="SafeSwap" style={{ height: '32px', display: 'block' }} />
      </Link>

      {/* Desktop links - hidden on narrow screens via CSS class */}
      <div className="nav-links-desktop" style={{ display: 'flex', gap: '16px', alignItems: 'center', fontSize: '14px', fontWeight: 500 }}>
        {user ? (
          <>
            <Link to="/messages" className="nav-pill">Messages</Link>
            <Link to="/create-listing" className="nav-pill">Create new listing</Link>
            {user.role === 'admin' && <Link to="/admin" className="nav-pill">Admin</Link>}
            <Link to="/profile" className="nav-pill">Profile</Link>
            <button onClick={handleLogout} className="btn-outline">Log out</button>
          </>
        ) : (
          <>
            <Link to="/login" style={{ color: 'var(--color-ink)' }}>Log in</Link>
            <Link to="/signup" style={{ color: '#fff', background: 'var(--color-primary)', padding: '7px 14px', borderRadius: '6px' }}>
              Sign up
            </Link>
          </>
        )}
      </div>

      {/* Mobile hamburger - shown only on narrow screens via CSS class */}
      <button
        className="nav-hamburger"
        onClick={() => setMenuOpen((v) => !v)}
        style={{ display: 'none', background: 'transparent', border: 'none', fontSize: '22px', padding: '4px 8px', color: 'var(--color-ink)' }}
      >
        {menuOpen ? '✕' : '☰'}
      </button>

      {menuOpen && (
        <div
          className="nav-mobile-menu"
          style={{
            position: 'absolute',
            top: '60px',
            left: 0,
            right: 0,
            background: '#fff',
            borderBottom: '1px solid var(--color-border)',
            boxShadow: '0 4px 10px rgba(0,0,0,0.08)',
            display: 'flex',
            flexDirection: 'column',
            padding: '10px 16px',
            gap: '10px',
          }}
        >
          {user ? (
            <>
              <Link to="/messages" onClick={() => setMenuOpen(false)}>Messages</Link>
              <Link to="/create-listing" onClick={() => setMenuOpen(false)}>Sell</Link>
              {user.role === 'admin' && <Link to="/admin" onClick={() => setMenuOpen(false)}>Admin</Link>}
              <Link to="/profile" onClick={() => setMenuOpen(false)}>Profile</Link>
              <button onClick={handleLogout} className="btn-outline" style={{ alignSelf: 'flex-start' }}>Log out</button>
            </>
          ) : (
            <>
              <Link to="/login" onClick={() => setMenuOpen(false)}>Log in</Link>
              <Link to="/signup" onClick={() => setMenuOpen(false)}>Sign up</Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
}