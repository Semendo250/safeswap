import { useState, useContext, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { login, getApprovalStatus } from '../api/auth.api';
import { AuthContext } from '../context/AuthContext';
import PasswordInput from '../components/PasswordInput';
import BackButton from '../components/BackButton';

const PENDING_KEY = 'safeswap_pending_signup';

function readPending() {
  try {
    return localStorage.getItem(PENDING_KEY);
  } catch (err) {
    return null;
  }
}

function clearPending() {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch (err) {
    // ignore
  }
}

const BANNER_COLORS = {
  success: { bg: 'var(--color-success-bg)', fg: 'var(--color-success)' },
  warning: { bg: 'var(--color-warning-bg)', fg: 'var(--color-warning)' },
  muted: { bg: 'var(--color-surface)', fg: 'var(--color-muted)' },
};

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login: loginUser } = useContext(AuthContext);
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [banner, setBanner] = useState(null);

  // If this browser has a signup waiting for approval, tell the person where it stands
  useEffect(() => {
    const id = readPending();
    if (!id) return undefined;
    let cancelled = false;

    getApprovalStatus(id)
      .then((res) => {
        if (cancelled) return;
        const status = res.data.status;
        if (status === 'approved') {
          clearPending();
          setBanner({ tone: 'success', text: 'Good news, your account has been approved. Log in below.' });
        } else if (status === 'pending') {
          setBanner({ tone: 'muted', text: 'Your account is still waiting for admin approval. Check back soon.' });
        } else if (status === 'rejected') {
          clearPending();
          setBanner({
            tone: 'warning',
            text: "Your account wasn't approved. You can sign up again or contact support.",
          });
        } else {
          clearPending();
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      setSubmitting(true);
      const res = await login(form);
      clearPending();
      loginUser(res.data.user, res.data.token);
      // Back to where the visitor came from (e.g. a listing), otherwise the marketplace
      const from = location.state?.from;
      const target = typeof from === 'string' && from.startsWith('/') ? from : '/browse';
      navigate(target, { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  const bannerColors = banner ? BANNER_COLORS[banner.tone] : null;

  return (
    <div className="container">
      <BackButton />
      <h2>Log in</h2>

      {banner && (
        <div
          role="status"
          style={{
            margin: '0 0 12px',
            padding: '10px 12px',
            borderRadius: '8px',
            fontSize: '13px',
            background: bannerColors.bg,
            color: bannerColors.fg,
          }}
        >
          {banner.text}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <input name="email" type="email" placeholder="Email" value={form.email} onChange={handleChange} required />
        <PasswordInput name="password" placeholder="Password" value={form.password} onChange={handleChange} />
        {error && <p style={{ color: 'var(--color-warning)' }}>{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Logging in...' : 'Log in'}
        </button>
      </form>
      <p style={{ marginTop: '10px', fontSize: '13px' }}>
        <Link to="/forgot-password">Forgot password?</Link>
      </p>
      <p style={{ fontSize: '13px' }}>No account? <Link to="/signup">Sign up</Link></p>
    </div>
  );
}