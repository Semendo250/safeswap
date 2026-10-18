import { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import BackButton from '../components/BackButton';
import { getMyPurchases } from '../api/payments.api';

const fmt = (n) => `KES ${Number(n).toLocaleString()}`;

function when(value) {
  if (!value) return '';
  return new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function describe(p) {
  const l = p.listing;
  if (p.status === 'pending') {
    return {
      label: 'Waiting for M-Pesa',
      tone: 'gold',
      text: 'Enter your PIN on your phone. If it does not complete, it is marked failed after a few minutes.',
    };
  }
  if (p.status === 'held') {
    return {
      label: 'Paid, held by SafeSwap',
      tone: 'teal',
      text:
        l && l.meetupSafeZone
          ? `Meet at ${l.meetupSafeZone}. Open the listing and confirm once you have the item.`
          : 'Open the listing, pick a safe zone and arrange the meetup with the seller.',
    };
  }
  if (p.status === 'released') {
    return { label: 'Completed', tone: 'success', text: 'You confirmed the handover.' };
  }
  if (p.status === 'refunded') {
    return { label: 'Refunded', tone: 'muted', text: 'This payment was refunded.' };
  }
  return {
    label: 'Did not go through',
    tone: 'warning',
    text: 'If you were charged anyway, message support from the Help page and include the M-Pesa receipt.',
  };
}

export default function MyPurchases() {
  const { user, loading: authLoading } = useContext(AuthContext);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    getMyPurchases()
      .then((res) => {
        if (!cancelled) setItems(res.data.purchases || []);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          !err.response
            ? 'Network error. Check your connection and try again.'
            : err.response.data?.error || 'Could not load your purchases.'
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
    <div className="mp-page">
      <style>{`
        .mp-page { max-width: 640px; margin: 0 auto; padding: 20px 16px 60px; }
        .mp-title { margin: 14px 0 4px; font-size: 24px; text-align: left; }
        .mp-sub { margin: 0 0 18px; font-size: 14px; color: var(--color-muted); }

        .mp-card {
          display: flex; gap: 12px; padding: 14px; margin-bottom: 12px; border-radius: 12px;
          border: 1px solid var(--color-border); background: var(--color-card);
        }
        .mp-photo {
          width: 64px; height: 64px; flex-shrink: 0; border-radius: 10px; object-fit: cover;
          background: var(--color-surface);
        }
        .mp-body { min-width: 0; flex: 1; }
        .mp-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
        .mp-name { font-size: 15px; font-weight: 600; word-break: break-word; color: var(--color-ink); }
        .mp-amount { margin-top: 2px; font-size: 15px; font-weight: 700; color: var(--color-primary); }
        .mp-asking { font-size: 12px; font-weight: 400; color: var(--color-muted); margin-left: 6px; }
        .mp-text { margin: 8px 0 0; font-size: 13px; line-height: 1.5; color: var(--color-muted); }
        .mp-meta { margin: 6px 0 0; font-size: 12px; color: var(--color-muted); word-break: break-word; }
        .mp-link { display: inline-block; margin-top: 8px; font-size: 13px; font-weight: 600; color: var(--color-teal); }

        .mp-chip { display: inline-flex; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; white-space: nowrap; }
        .mp-gold { background: var(--color-gold-bg); color: var(--color-gold); }
        .mp-teal { background: color-mix(in srgb, var(--color-teal) 14%, var(--color-card)); color: var(--color-teal); }
        .mp-success { background: var(--color-success-bg); color: var(--color-success); }
        .mp-muted { background: var(--color-border); color: var(--color-muted); }
        .mp-warning { background: var(--color-warning-bg); color: var(--color-warning); }

        .mp-empty {
          text-align: center; padding: 32px 16px; border: 1px dashed var(--color-border);
          border-radius: 12px; color: var(--color-muted);
        }
        .mp-empty p { margin: 0 0 12px; font-size: 14px; }
      `}</style>

      <BackButton />
      <h2 className="mp-title">My purchases</h2>
      <p className="mp-sub">Every payment you have made, and what happens next.</p>

      {authLoading || (user && loading) ? (
        <p style={{ color: 'var(--color-muted)' }}>Loading...</p>
      ) : !user ? (
        <div className="mp-empty">
          <p>Log in to see your purchases.</p>
          <Link to="/login" state={{ from: '/my-purchases' }}>
            Log in
          </Link>
        </div>
      ) : error ? (
        <p style={{ color: 'var(--color-warning)', fontSize: 14 }}>{error}</p>
      ) : items.length === 0 ? (
        <div className="mp-empty">
          <p>You have not paid for anything yet.</p>
          <Link to="/browse">Browse listings</Link>
        </div>
      ) : (
        items.map((p) => {
          const d = describe(p);
          const discount = p.askingPrice != null && p.amount != null && p.askingPrice > p.amount;
          return (
            <div key={p._id} className="mp-card">
              {p.listing && p.listing.photo ? (
                <img className="mp-photo" src={p.listing.photo} alt="" />
              ) : (
                <div className="mp-photo" />
              )}
              <div className="mp-body">
                <div className="mp-head">
                  <span className="mp-name">{p.listing ? p.listing.title : 'Listing no longer available'}</span>
                  <span className={`mp-chip mp-${d.tone}`}>{d.label}</span>
                </div>
                <div className="mp-amount">
                  {p.amount != null ? fmt(p.amount) : '-'}
                  {discount && <span className="mp-asking">asking {fmt(p.askingPrice)}</span>}
                </div>
                <p className="mp-text">{d.text}</p>
                <p className="mp-meta">
                  {p.listing && p.listing.sellerName ? `Seller ${p.listing.sellerName} · ` : ''}
                  {when(p.createdAt)}
                  {p.mpesaReceipt ? ` · Receipt ${p.mpesaReceipt}` : ''}
                </p>
                {p.listing && (p.status === 'held' || p.status === 'pending') && (
                  <Link className="mp-link" to={`/listings/${p.listing._id}`}>
                    Open listing
                  </Link>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}