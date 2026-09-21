import { useState, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { verifyOtp } from '../api/auth.api';
import { AuthContext } from '../context/AuthContext';

export default function VerifyOtp() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login: loginUser } = useContext(AuthContext);
  const [email] = useState(location.state?.email || '');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      setSubmitting(true);
      const res = await verifyOtp({ email, otp });
      loginUser(res.data.user, res.data.token);
      setSuccess(true);
            setTimeout(() => navigate('/browse'), 2200);
      
    } catch (err) {
      setError(err.response?.data?.error || 'Verification failed');
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div
        style={{
          minHeight: '70vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '20px',
        }}
      >
        <div
          style={{
            width: '72px',
            height: '72px',
            borderRadius: '50%',
            background: 'var(--color-success-bg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '20px',
          }}
        >
          <span style={{ fontSize: '34px', color: 'var(--color-success)' }}>&#10003;</span>
        </div>
        <h2 style={{ fontSize: '22px' }}>Account created successfully</h2>
        <p style={{ color: 'var(--color-muted)', marginTop: '6px' }}>
          Welcome to SafeSwap — taking you to the marketplace...
        </p>
      </div>
    );
  }

  return (
    <div className="container">
      <h2>Verify your email</h2>
      <p style={{ color: 'var(--color-muted)' }}>Enter the code sent to {email}</p>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <input
          placeholder="6-digit code"
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
          maxLength={6}
          required
        />
        {error && <p style={{ color: 'var(--color-warning)' }}>{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Verifying...' : 'Verify'}
        </button>
      </form>
    </div>
  );
}