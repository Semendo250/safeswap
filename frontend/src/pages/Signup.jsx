import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signup, getApprovalStatus } from '../api/auth.api';
import PasswordInput from '../components/PasswordInput';
import PasswordRequirements from '../components/PasswordRequirements';
import { isPasswordValid } from '../utils/password';
import BackButton from '../components/BackButton';
import Avatar from '../components/Avatar';
import { normalizeKenyanPhone } from '../utils/phone';

const MAX_PICTURE_BYTES = 5 * 1024 * 1024;
const PENDING_KEY = 'safeswap_pending_signup';
const POLL_MS = 10000;

function savePending(id) {
  try {
    localStorage.setItem(PENDING_KEY, id);
  } catch (err) {
    // storage blocked, the screen still works without it
  }
}

function clearPending() {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch (err) {
    // ignore
  }
}

const ICON_PATHS = {
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  cross: <path d="M6 6l12 12M18 6L6 18" />,
};

function StatusIcon({ name }) {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICON_PATHS[name]}
    </svg>
  );
}

export default function Signup() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: '', email: '', password: '', phone: '' });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Waiting-for-approval state: 'pending' | 'approved' | 'rejected' | 'not_found'
  const [signupId, setSignupId] = useState(null);
  const [approval, setApproval] = useState('pending');

  const [picture, setPicture] = useState(null);
  const [preview, setPreview] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  // While the success screen is open, check every 10 seconds (and whenever the tab
  // comes back into view) whether an admin has approved the account
  useEffect(() => {
    if (!submitted || !signupId || approval !== 'pending') return undefined;
    let cancelled = false;

    async function check() {
      try {
        const res = await getApprovalStatus(signupId);
        if (cancelled) return;
        const status = res.data.status;
        if (status === 'approved' || status === 'rejected' || status === 'not_found') {
          clearPending();
          setApproval(status);
        }
      } catch (err) {
        // network hiccup: keep waiting and try again on the next check
      }
    }

    const timer = setInterval(check, POLL_MS);
    function onVisible() {
      if (document.visibilityState === 'visible') check();
    }
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [submitted, signupId, approval]);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function handlePick(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      setError('Please choose a JPG, PNG or WebP image');
      return;
    }
    if (file.size > MAX_PICTURE_BYTES) {
      setError('Profile picture must be 5 MB or smaller');
      return;
    }
    setError('');
    setPicture(file);
    setPreview(URL.createObjectURL(file));
  }

  function removePicture() {
    setPicture(null);
    setPreview(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!isPasswordValid(form.password)) {
      setError('Password does not meet all requirements');
      return;
    }
    if (form.password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (!normalizeKenyanPhone(form.phone)) {
      setError('Enter a valid Kenyan phone number, e.g. 0712 345 678');
      return;
    }

    const data = new FormData();
    data.append('fullName', form.fullName);
    data.append('email', form.email);
    data.append('password', form.password);
    data.append('phone', form.phone.trim());
    if (picture) data.append('profilePicture', picture);

    try {
      setSubmitting(true);
      const res = await signup(data);
      const id = res.data.userId ? String(res.data.userId) : null;
      setSignupId(id);
      setApproval('pending');
      if (id) savePending(id);
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Signup failed');
    } finally {
      setSubmitting(false);
    }
  }

  function startOver() {
    clearPending();
    setSignupId(null);
    setApproval('pending');
    setSubmitted(false);
  }

  if (submitted) {
    const views = {
      pending: {
        tone: 'gold',
        icon: 'clock',
        pill: 'In review',
        title: 'Submitted for review',
        text: 'Your details have been submitted. This page updates by itself the moment an admin approves your account, so you can keep it open. You can also close it and try logging in later.',
      },
      approved: {
        tone: 'success',
        icon: 'check',
        pill: 'All set',
        title: "You're approved!",
        text: 'Your account is ready. You can log in now.',
      },
      rejected: {
        tone: 'warning',
        icon: 'cross',
        pill: 'Action needed',
        title: 'Not approved',
        text: "Your account wasn't approved. You can sign up again with the correct details, or contact support.",
      },
      not_found: {
        tone: 'warning',
        icon: 'cross',
        pill: 'Action needed',
        title: 'Signup not found',
        text: "We couldn't find this signup. Please sign up again.",
      },
    };
    const view = views[approval] || views.pending;

    return (
      <div className="container">
        <div className="status-page">
          <div className={`status-card tone-${view.tone}`} role="status" aria-live="polite">
            <div className={`status-icon ${approval === 'pending' ? 'pulse' : ''}`}>
              <StatusIcon name={view.icon} />
            </div>
            <span className="status-pill">{view.pill}</span>
            <h2 className="status-title">{view.title}</h2>
            <p className="status-text">{view.text}</p>

            {approval === 'pending' && (
              <>
                <ol className="status-steps">
                  <li className="done">
                    <span className="dot">&#10003;</span>
                    Details submitted
                  </li>
                  <li className="current">
                    <span className="dot" />
                    Admin review
                  </li>
                  <li>
                    <span className="dot" />
                    Account approved
                  </li>
                </ol>
                <div className="status-actions">
                  <Link to="/login" className="status-btn-outline">
                    Already approved? Log in
                  </Link>
                </div>
              </>
            )}

            {approval === 'approved' && (
              <div className="status-actions">
                <button type="button" className="status-btn" onClick={() => navigate('/login')}>
                  Log in now
                </button>
              </div>
            )}

            {(approval === 'rejected' || approval === 'not_found') && (
              <div className="status-actions">
                <button type="button" className="status-btn" onClick={startOver}>
                  Sign up again
                </button>
                <Link to="/login" className="status-btn-outline">
                  Back to log in
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <BackButton />
      <h2>Sign up</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <Avatar src={preview} name={form.fullName} size={96} style={{ border: '2px solid var(--color-border)' }} />
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handlePick}
            style={{ display: 'none' }}
          />
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" className="btn-outline" onClick={() => fileRef.current?.click()}>
              {picture ? 'Change photo' : 'Add profile photo'}
            </button>
            {picture && (
              <button type="button" className="btn-outline" onClick={removePicture}>
                Remove
              </button>
            )}
          </div>
          <span style={{ fontSize: '12px', color: 'var(--color-muted)' }}>Optional. JPG, PNG or WebP, up to 5 MB.</span>
        </div>

        <input name="fullName" placeholder="Full name" value={form.fullName} onChange={handleChange} required />
        <input name="email" type="email" placeholder="Email" value={form.email} onChange={handleChange} required />
        <input
          name="phone"
          type="tel"
          inputMode="tel"
          placeholder="Phone number e.g. 0712 345 678"
          value={form.phone}
          onChange={handleChange}
          required
        />

        <div>
          <PasswordInput
            name="password"
            placeholder="Password"
            value={form.password}
            onChange={handleChange}
            onFocus={() => setPasswordFocused(true)}
            onBlur={() => setPasswordFocused(false)}
          />
          <div className={`password-requirements ${passwordFocused ? 'open' : ''}`}>
            <PasswordRequirements password={form.password} />
          </div>
        </div>

        <PasswordInput
          name="confirmPassword"
          placeholder="Confirm password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />

        {error && <p style={{ color: 'var(--color-warning)' }}>{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Submitting...' : 'Sign up'}
        </button>
      </form>
    </div>
  );
}