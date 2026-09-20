import { useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/');
  }

  return (
    <nav
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 20px',
        borderBottom: '3px solid var(--color-teal)',
        background: '#fff',
      }}
    >
      <Link to="/">
        <img src="/logo-full.svg" alt="SafeSwap" style={{ height: '42px' }} />
      </Link>
      <div style={{ display: 'flex', gap: '18px', alignItems: 'center', fontSize: '14px', fontWeight: 500 }}>
        {user ? (
          <>
            <Link to="/messages" className="nav-pill">Messages</Link>
<Link to="/create-listing" className="nav-pill">Sell</Link>
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
    </nav>
  );
}