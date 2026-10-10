import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { signup } from '../api/auth.api';
import PasswordInput from '../components/PasswordInput';
import PasswordRequirements from '../components/PasswordRequirements';
import { isPasswordValid } from '../utils/password';
import BackButton from '../components/BackButton';
import Avatar from '../components/Avatar';
import { normalizeKenyanPhone } from '../utils/phone';

const MAX_PICTURE_BYTES = 5 * 1024 * 1024;

export default function Signup() {
  const [form, setForm] = useState({ fullName: '', email: '', password: '', phone: '' });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const [picture, setPicture] = useState(null);
  const [preview, setPreview] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

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
      setSuccessMessage(
        res.data.message || 'Your details have been submitted successfully. Kindly wait for approval.'
      );
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Signup failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="container">
        <div
          style={{
            minHeight: '60vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
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
          <h2 style={{ fontSize: '20px', margin: '0 0 10px' }}>Submitted for review</h2>
          <p style={{ color: 'var(--color-muted)', maxWidth: '320px', lineHeight: 1.5 }}>{successMessage}</p>
          <p style={{ marginTop: '18px', fontSize: '13px' }}>
            Already approved? <Link to="/login">Log in</Link>
          </p>
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