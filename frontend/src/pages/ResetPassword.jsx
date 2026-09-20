import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { resetPassword } from '../api/auth.api';
import PasswordInput from '../components/PasswordInput';
import PasswordRequirements from '../components/PasswordRequirements';
import { isPasswordValid } from '../utils/password';
import BackButton from '../components/BackButton';

export default function ResetPassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email] = useState(location.state?.email || '');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!isPasswordValid(newPassword)) {
      setError('Password does not meet all requirements');
      return;
    }
    try {
      setSubmitting(true);
      await resetPassword({ email, token, newPassword });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 1800);
    } catch (err) {
      setError(err.response?.data?.error || 'Reset failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--color-success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
          <span style={{ fontSize: '30px', color: 'var(--color-success)' }}>&#10003;</span>
        </div>
        <h2>Password reset</h2>
        <p style={{ color: 'var(--color-muted)' }}>Taking you to log in...</p>
      </div>
    );
  }

  return (
    <div className="container">
      <BackButton />
      <h2>Reset password</h2>
      <p style={{ color: 'var(--color-muted)' }}>Enter the code sent to {email || 'your email'}, and choose a new password.</p>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {!location.state?.email && (
          <input type="email" placeholder="Email" value={email} readOnly />
        )}
        <input placeholder="6-digit reset code" value={token} onChange={(e) => setToken(e.target.value)} maxLength={6} required />
        <div>
          <PasswordInput
            name="newPassword"
            placeholder="New password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            onFocus={() => setPasswordFocused(true)}
            onBlur={() => setPasswordFocused(false)}
          />
          <div className={`password-requirements ${passwordFocused ? 'open' : ''}`}>
            <PasswordRequirements password={newPassword} />
          </div>
        </div>
        {error && <p style={{ color: 'var(--color-warning)' }}>{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Resetting...' : 'Reset password'}
        </button>
      </form>
    </div>
  );
}