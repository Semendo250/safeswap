import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signup } from '../api/auth.api';
import PasswordInput from '../components/PasswordInput';
import PasswordRequirements from '../components/PasswordRequirements';
import { isPasswordValid } from '../utils/password';
import BackButton from '../components/BackButton';

export default function Signup() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: '', studentRegNo: '', email: '', password: '', phone: '' });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
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

    try {
      setSubmitting(true);
      await signup(form);
      navigate('/verify-otp', { state: { email: form.email } });
    } catch (err) {
      setError(err.response?.data?.error || 'Signup failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container">
      <BackButton />
      <h2>Sign up</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <input name="fullName" placeholder="Full name" value={form.fullName} onChange={handleChange} required />
        <input name="studentRegNo" placeholder="Student reg no." value={form.studentRegNo} onChange={handleChange} required />
        <input name="email" type="email" placeholder="Email" value={form.email} onChange={handleChange} required />
        <input name="phone" placeholder="Phone (optional)" value={form.phone} onChange={handleChange} />

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
          {submitting ? 'Signing up...' : 'Sign up'}
        </button>
      </form>
    </div>
  );
}