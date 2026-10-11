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
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-back">
            <BackButton />
          </div>

          <img src="/logo-icon.svg" alt="SafeSwap" className="auth-logo" />
          <h2 className="auth-title">Welcome back</h2>
          <p className="auth-subtitle">Log in to buy and sell safely on SafeSwap.</p>

          {banner && (
            <div
              role="status"
              className="auth-banner"
              style={{ background: bannerColors.bg, color: bannerColors.fg }}
            >
              {banner.text}
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="auth-field">
              <label className="auth-label" htmlFor="login-email">
                Email
              </label>
              <input
                id="login-email"
                name="email"
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={handleChange}
                required
              />
            </div>

            <div className="auth-field">
              <label className="auth-label">Password</label>
              <PasswordInput name="password" placeholder="Enter your password" value={form.password} onChange={handleChange} />
            </div>

            <div className="auth-forgot">
              <Link to="/forgot-password">Forgot password?</Link>
            </div>

            {error && <p className="auth-error">{error}</p>}

            <button type="submit" className="auth-submit" disabled={submitting}>
              {submitting ? 'Logging in...' : 'Log in'}
            </button>
          </form>

          <div className="auth-divider">New to SafeSwap?</div>
          <Link to="/signup" className="auth-alt">
            Create an account
          </Link>
        </div>
      </div>
    </div>
  );
}