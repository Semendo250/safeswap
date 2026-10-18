import { useContext, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import BackButton from '../components/BackButton';
import { getListingById } from '../api/listings.api';
import { createReport } from '../api/reports.api';

const REASONS = [
  ['suspected_stolen', 'Looks stolen, or the IMEI does not match'],
  ['price_suspicious', 'The price looks too good to be true'],
  ['fake_listing', 'Fake listing, or the item is not real'],
  ['other', 'Something else'],
];

export default function ReportListing() {
  const { id } = useParams();
  const { user, loading: authLoading } = useContext(AuthContext);
  const [title, setTitle] = useState('');
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    getListingById(id)
      .then((res) => setTitle(res.data.title))
      .catch(() => {});
  }, [id]);

  async function submit(e) {
    e.preventDefault();
    if (!reason) {
      setError('Pick a reason');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await createReport(id, reason, details.trim());
      setDone(true);
    } catch (err) {
      setError(!err.response ? 'Network error. Check your connection.' : err.response.data?.error || 'Could not send the report');
    } finally {
      setBusy(false);
    }
  }

  const box = {
    border: '1px solid var(--color-border)',
    borderRadius: 12,
    padding: 14,
    background: 'var(--color-card)',
    marginTop: 12,
  };

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: '20px 16px 60px' }}>
      <BackButton />
      <h2 style={{ margin: '14px 0 4px', textAlign: 'left' }}>Report listing</h2>
      {title && <p style={{ margin: '0 0 8px', fontSize: 14, color: 'var(--color-muted)' }}>{title}</p>}

      {authLoading ? null : !user ? (
        <div style={box}>
          <p style={{ margin: 0, fontSize: 14 }}>
            <Link to="/login" state={{ from: `/report/${id}` }}>
              Log in
            </Link>{' '}
            to report a listing.
          </p>
        </div>
      ) : done ? (
        <div style={{ ...box, borderColor: 'var(--color-success)', background: 'var(--color-success-bg)' }}>
          <p style={{ margin: '0 0 6px', fontWeight: 700, color: 'var(--color-success)' }}>Thanks, we got your report.</p>
          <p style={{ margin: '0 0 10px', fontSize: 14 }}>An admin will review it. You don't need to do anything else.</p>
          <Link to="/browse">Back to Browse</Link>
        </div>
      ) : (
        <form onSubmit={submit} style={box}>
          <p style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600 }}>What is wrong?</p>
          {REASONS.map(([value, label]) => (
            <label key={value} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '6px 0', fontSize: 14 }}>
              <input
                type="radio"
                name="reason"
                value={value}
                checked={reason === value}
                onChange={() => setReason(value)}
                style={{ width: 'auto', marginTop: 3 }}
              />
              <span>{label}</span>
            </label>
          ))}
          <textarea
            rows={4}
            maxLength={500}
            placeholder="Anything else we should know? (optional)"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            style={{ margin: '10px 0' }}
          />
          {error && <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--color-warning)' }}>{error}</p>}
          <button type="submit" disabled={busy}>
            {busy ? 'Sending...' : 'Send report'}
          </button>
        </form>
      )}
    </div>
  );
}