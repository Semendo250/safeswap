import { useEffect, useState } from 'react';
import { getSettings, setOfferExpiry } from '../../api/admin.api';
import ExportButton from './ExportButton';
import { Notice, btn, errText } from './AdminUi';

const card = {
  border: '1px solid var(--color-border)',
  borderRadius: 12,
  padding: 14,
  marginTop: 18,
  background: 'var(--color-card)',
};
const label = {
  display: 'block',
  marginBottom: 2,
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: 'var(--color-muted)',
};

export default function OfferSettings() {
  const [hours, setHours] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  useEffect(() => {
    getSettings()
      .then((res) => setHours(String(res.data.offerHours)))
      .catch((err) => setError(errText(err, 'Could not load the setting.')));
  }, []);

  async function save(e) {
    e.preventDefault();
    const n = Number(hours);
    if (!Number.isInteger(n) || n < 1 || n > 168) {
      setError('Enter a whole number of hours from 1 to 168');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await setOfferExpiry(n);
      setNotice(`Offers now expire after ${res.data.offerHours} hours. Offers already sent keep their old deadline.`);
    } catch (err) {
      setError(errText(err, 'Could not save.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <form onSubmit={save} style={card}>
        <strong style={{ fontSize: 14 }}>Offer expiry</strong>
        <p style={{ margin: '4px 0 10px', fontSize: 12, color: 'var(--color-muted)' }}>
          How long an offer, or an agreed price, stays valid before it expires.
        </p>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="number"
            min="1"
            max="168"
            step="1"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            style={{ width: 100 }}
          />
          <span style={{ fontSize: 13 }}>hours</span>
          <button type="submit" disabled={busy} style={btn('primary')}>
            {busy ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>

      <div style={card}>
        <strong style={{ fontSize: 14 }}>Export offers</strong>
        <p style={{ margin: '4px 0 10px', fontSize: 12, color: 'var(--color-muted)' }}>
          Download offers as a CSV file for Excel or Google Sheets.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={label}>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {['all', 'pending', 'accepted', 'declined', 'replaced', 'expired', 'closed', 'paid'].map((s) => (
                <option key={s} value={s}>
                  {s === 'all' ? 'All statuses' : s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={label}>From</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ width: 'auto' }} />
          </div>
          <div>
            <label style={label}>To</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ width: 'auto' }} />
          </div>
          <ExportButton
            kind="offers"
            label="Export offers CSV"
            params={{ status, from, to }}
            onDone={setNotice}
            onError={setError}
          />
        </div>
      </div>

      {notice && <Notice onClose={() => setNotice('')}>{notice}</Notice>}
      {error && <Notice tone="warning">{error}</Notice>}
    </>
  );
}