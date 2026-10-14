import { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import BackButton from '../components/BackButton';
import { getMyDisputes } from '../api/disputes.api';

const STATUS_LABEL = { open: 'Open', in_progress: 'In progress', resolved: 'Resolved', closed: 'Closed' };
const STATUS_TONE = { open: 'gold', in_progress: 'teal', resolved: 'success', closed: 'muted' };

function fmt(value) {
  if (!value) return '';
  return new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

export default function MyComplaints() {
  const { user, loading: authLoading } = useContext(AuthContext);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    getMyDisputes()
      .then((res) => {
        if (!cancelled) setItems(res.data.disputes || []);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          !err.response
            ? 'Network error. Check your connection and try again.'
            : err.response.data?.error || 'Could not load your complaints.'
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authLoading, user?.id]);

  return (
    <div className="mc-page">
      <style>{`
        .mc-page { max-width: 640px; margin: 0 auto; padding: 20px 16px 60px; }
        .mc-page, .mc-page * { -webkit-user-select: text; user-select: text; }
        .mc-title { margin: 14px 0 4px; font-size: 24px; text-align: left; }
        .mc-sub { margin: 0 0 18px; font-size: 14px; color: var(--color-muted); }

        a.mc-card {
          display: block; padding: 14px; margin-bottom: 12px; border-radius: 12px;
          border: 1px solid var(--color-border); background: var(--color-card);
          color: var(--color-ink); text-decoration: none; transition: border-color 0.15s;
        }
        a.mc-card:hover { border-color: var(--color-teal); text-decoration: none; }
        .mc-head { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; }
        .mc-chips { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
        .mc-ref { font-size: 13px; font-weight: 700; }
        .mc-date { font-size: 12px; color: var(--color-muted); }
        .mc-subject { display: block; margin-top: 8px; font-size: 15px; font-weight: 600; word-break: break-word; }
        .mc-preview { margin: 4px 0 0; font-size: 13px; color: var(--color-muted); word-break: break-word; }

        .mc-chip { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; white-space: nowrap; }
        .mc-gold { background: var(--color-gold-bg); color: var(--color-gold); }
        .mc-teal { background: color-mix(in srgb, var(--color-teal) 14%, var(--color-card)); color: var(--color-teal); }
        .mc-success { background: var(--color-success-bg); color: var(--color-success); }
        .mc-muted { background: var(--color-border); color: var(--color-muted); }
        .mc-warning { background: var(--color-warning-bg); color: var(--color-warning); }

        .mc-empty {
          text-align: center; padding: 32px 16px; border: 1px dashed var(--color-border);
          border-radius: 12px; color: var(--color-muted);
        }
        .mc-empty p { margin: 0 0 12px; font-size: 14px; }
        .mc-error { color: var(--color-warning); font-size: 14px; }
      `}</style>

      <BackButton />
      <h2 className="mc-title">My complaints</h2>
      <p className="mc-sub">Your messages to SafeSwap support, and their replies.</p>

      {authLoading || (user && loading) ? (
        <p style={{ color: 'var(--color-muted)' }}>Loading...</p>
      ) : !user ? (
        <div className="mc-empty">
          <p>Log in to see your complaints.</p>
          <Link to="/login" state={{ from: '/my-complaints' }}>
            Log in
          </Link>
        </div>
      ) : error ? (
        <p className="mc-error">{error}</p>
      ) : items.length === 0 ? (
        <div className="mc-empty">
          <p>You haven't sent any messages to support yet.</p>
          <Link to="/support">Contact support</Link>
        </div>
      ) : (
        items.map((d) => (
          <Link key={d._id} to={`/my-complaints/${d._id}`} className="mc-card">
            <div className="mc-head">
              <div className="mc-chips">
                <span className="mc-ref">{d.ref}</span>
                <span className={`mc-chip mc-${STATUS_TONE[d.status] || 'muted'}`}>{STATUS_LABEL[d.status] || d.status}</span>
                {d.newReply && <span className="mc-chip mc-warning">Support replied</span>}
              </div>
              <span className="mc-date">{fmt(d.lastMessageAt)}</span>
            </div>
            <span className="mc-subject">{d.subject}</span>
            {d.preview && <p className="mc-preview">{d.preview}</p>}
          </Link>
        ))
      )}
    </div>
  );
}