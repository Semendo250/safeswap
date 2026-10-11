import { useContext, useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { submitDispute } from '../api/disputes.api';

export default function ComplaintForm() {
  const { user } = useContext(AuthContext);
  const [subject, setSubject] = useState('');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ref, setRef] = useState('');

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await submitDispute(subject.trim(), details.trim());
      setRef(res.data.ref);
      setSubject('');
      setDetails('');
    } catch (err) {
      if (!err.response) setError('Network error. Check your connection and try again.');
      else setError(err.response.data?.error || 'Could not send your complaint. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const box = {
    border: '1px solid var(--color-border)',
    borderRadius: 10,
    padding: 14,
    background: 'var(--color-card)',
    marginTop: 8,
  };

  return (
    <>
      <h2 id="complaint">Send us a complaint</h2>

      {!user ? (
        <div style={box}>
          <p style={{ margin: 0, fontSize: 14 }}>
            <Link to="/login">Log in</Link> to send a complaint from the app. You can also reach us on WhatsApp or by
            email above.
          </p>
        </div>
      ) : ref ? (
        <div style={{ ...box, borderColor: 'var(--color-success)', background: 'var(--color-success-bg)' }}>
          <p style={{ margin: '0 0 6px', fontWeight: 700, color: 'var(--color-success)' }}>
            Complaint received. Your reference is {ref}.
          </p>
          <p style={{ margin: '0 0 10px', fontSize: 14 }}>
            An admin will look into it, and you will get a notification when it is resolved. Keep the reference if you
            contact us about it.
          </p>
          <button type="button" onClick={() => setRef('')}>
            Send another
          </button>
        </div>
      ) : (
        <form onSubmit={submit} style={box}>
          <p style={{ margin: '0 0 10px', fontSize: 14, color: 'var(--color-muted)' }}>
            Tell us what went wrong. Include the listing name and what you expected.
          </p>
          <input
            placeholder="Subject, e.g. Item not as described"
            value={subject}
            maxLength={120}
            onChange={(e) => setSubject(e.target.value)}
            style={{ marginBottom: 8 }}
          />
          <textarea
            rows={5}
            placeholder="What happened?"
            value={details}
            maxLength={2000}
            onChange={(e) => setDetails(e.target.value)}
            style={{ marginBottom: 8 }}
          />
          {error && <p style={{ color: 'var(--color-warning)', fontSize: 13, margin: '0 0 8px' }}>{error}</p>}
          <button type="submit" disabled={busy || subject.trim().length < 3 || details.trim().length < 3}>
            {busy ? 'Sending...' : 'Send complaint'}
          </button>
        </form>
      )}
    </>
  );
}