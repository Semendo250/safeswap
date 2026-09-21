import { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { login } from '../api/auth.api';
import { AuthContext } from '../context/AuthContext';
import PasswordInput from '../components/PasswordInput';
import BackButton from '../components/BackButton';

export default function Login() {
  const navigate = useNavigate();
  const { login: loginUser } = useContext(AuthContext);
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      setSubmitting(true);
      const res = await login(form);
      loginUser(res.data.user, res.data.token);

    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }      navigate('/browse');

  return (
    <div className="container">
      <BackButton />
      <h2>Log in</h2>
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