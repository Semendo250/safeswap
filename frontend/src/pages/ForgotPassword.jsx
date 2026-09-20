import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { forgotPassword } from '../api/auth.api';
import BackButton from '../components/BackButton';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      setSubmitting(true);
      await forgotPassword({ email });
      setMessage('If an account exists for this email, a reset code has been sent.');
      setTimeout(() => navigate('/reset-password', { state: { email } }), 1800);
    } catch (err) {
      setMessage(err.response?.data?.error || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container">
      <BackButton />
      <h2>Forgot password</h2>
      <p style={{ color: 'var(--color-muted)' }}>Enter your email and we'll send a reset code.</p>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        {message && <p style={{ color: 'var(--color-primary)', fontSize: '13px' }}>{message}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Sending...' : 'Send reset code'}
        </button>
      </form>
    </div>
  );
}