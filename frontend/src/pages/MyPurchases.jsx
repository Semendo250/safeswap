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

const ICONS = {
  pending: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  held: (
    <>
      <path d="M12 3 4 6v6c0 4.5 3.2 7.8 8 9 4.8-1.2 8-4.5 8-9V6l-8-3z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  released: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12.5 3 3 5-6" />
    </>
  ),
  refunded: (
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
    </>
  ),
  failed: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m9 9 6 6" />
      <path d="m15 9-6 6" />
    </>
  ),
};

function StatusIcon({ status, size = 14 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[status] || ICONS.failed}
    </svg>
  );
}

function describe(p) {
  const l = p.listing;
  if (p.status === 'pending') {
    return {
      key: 'pending',
      label: 'Waiting for M-Pesa',
      tone: 'gold',
      next: true,
      text: 'Enter your PIN on your phone. If it does not complete, it is marked failed after a few minutes.',
    };
  }
  if (p.status === 'held') {
    return {
      key: 'held',
      label: 'Paid, held by SafeSwap',
      tone: 'teal',
      next: true,
      text:
        l && l.meetupSafeZone
          ? `Meet at ${l.meetupSafeZone}. Open the listing and confirm once you have the item.`
          : 'Open the listing, pick a safe zone and arrange the meetup with the seller.',
    };
  }
  if (p.status === 'released') {
    return { key: 'released', label: 'Completed', tone: 'success', next: false, text: 'You confirmed the handover.' };
  }
  if (p.status === 'refunded') {
    return { key: 'refunded', label: 'Refunded', tone: 'muted', next: false, text: 'This payment was refunded.' };
  }
  return { key: 'failed', label: 'Did not go through', tone: 'warning', next: false, text: '' };
}

function Photo({ p }) {
  return p.listing && p.listing.photo ? (
    <img className="mp-photo" src={p.listing.photo} alt="" />
  ) : (
    <div className="mp-photo" />
  );
}

export default function MyPurchases() {
  const { user, loading: authLoading } = useContext(AuthContext);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showFailed, setShowFailed] = useState(false);

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

  const inProgress = items.filter((p) => p.status === 'pending' || p.status === 'held');
  const history = items.filter((p) => p.status === 'released' || p.status === 'refunded');
  const failed = items.filter((p) => p.status !== 'pending' && p.status !== 'held' && p.status !== 'released' && p.status !== 'refunded');

  const totalPaid = items
    .filter((p) => p.status === 'held' || p.status === 'released')
    .reduce((n, p) => n + (Number(p.amount) || 0), 0);
  const completedCount = items.filter((p) => p.status === 'released').length;

  // With nothing else to show, the failed attempts are shown open
  const failedOpen = showFailed || (inProgress.length === 0 && history.length === 0);

  function renderCard(p) {
    const d = describe(p);
    const discount = p.askingPrice != null && p.amount != null && p.askingPrice > p.amount;
    return (
      <div key={p._id} className={`mp-card mp-tone-${d.tone}`}>
        <div className="mp-photo-wrap">
          <Photo p={p} />
          <span className={`mp-status-icon mp-${d.tone}`}>
            <StatusIcon status={d.key} size={13} />
          </span>
        </div>
        <div className="mp-body">
          <div className="mp-head">
            <span className="mp-name">{p.listing ? p.listing.title : 'Listing no longer available'}</span>
            <span className={`mp-chip mp-${d.tone}`}>{d.label}</span>
          </div>
          <div className="mp-amount">
            {p.amount != null ? fmt(p.amount) : '-'}
            {discount && <span className="mp-asking">asking {fmt(p.askingPrice)}</span>}
          </div>

          {d.next ? (
            <div className={`mp-next mp-${d.tone}`}>
              <strong>{p.status === 'held' ? 'Next step' : 'Waiting'}</strong>
              <span>{d.text}</span>
            </div>
          ) : (
            d.text && <p className="mp-text">{d.text}</p>
          )}

          <p className="mp-meta">
            {p.listing && p.listing.sellerName ? `Seller ${p.listing.sellerName} · ` : ''}
            {when(p.createdAt)}
            {p.mpesaReceipt ? ` · Receipt ${p.mpesaReceipt}` : ''}
          </p>

          {p.listing && d.next && (
            <Link className="mp-cta" to={`/listings/${p.listing._id}`}>
              Open listing
            </Link>
          )}
          {p.listing && !d.next && (
            <Link className="mp-link" to={`/listings/${p.listing._id}`}>
              View listing
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mp-page">
      <style>{`
        .mp-page { max-width: 640px; margin: 0 auto; padding: 20px 16px 60px; }
        @media (min-width: 700px) { .mp-page { max-width: 720px; padding: 28px 24px 70px; } }
        .mp-title { margin: 14px 0 4px; font-size: 26px; text-align: left; letter-spacing: -0.01em; }
        .mp-sub { margin: 0 0 18px; font-size: 14px; color: var(--color-muted); }

        .mp-stats {
          position: relative; overflow: hidden; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr));
          margin-bottom: 8px; border: 1px solid var(--color-border); border-radius: 16px;
          background: var(--color-card); box-shadow: 0 10px 32px rgba(18, 101, 103, 0.08);
        }
        .mp-stats::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 4px;
          background: linear-gradient(90deg, var(--color-primary), var(--color-accent), var(--color-gold-bright));
        }
        .mp-stat { padding: 20px 10px 14px; text-align: center; border-left: 1px solid var(--color-border); min-width: 0; }
        .mp-stat:first-child { border-left: none; }
        .mp-stat-label {
          display: block; margin-bottom: 4px; font-size: 11px; font-weight: 700;
          letter-spacing: 0.05em; text-transform: uppercase; color: var(--color-muted);
        }
        .mp-stat-value { display: block; font-size: 17px; font-weight: 700; color: var(--color-ink); word-break: break-word; }
        .mp-stat-value.money { color: var(--color-primary); }
        .mp-stat-value.gold { color: var(--color-gold); }
        .mp-stat-value.warn { color: var(--color-warning); }
        @media (max-width: 520px) {
          .mp-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .mp-stat:nth-child(3) { border-left: none; }
          .mp-stat:nth-child(n + 3) { border-top: 1px solid var(--color-border); }
        }

        .mp-section { display: flex; align-items: center; gap: 8px; margin: 24px 0 12px; }
        .mp-section h3 { margin: 0; font-size: 17px; }
        .mp-count {
          min-width: 24px; padding: 2px 8px; border-radius: 999px; text-align: center;
          font-size: 12px; font-weight: 700; background: var(--color-gold-bg); color: var(--color-gold);
        }
        .mp-count.plain { background: var(--color-border); color: var(--color-muted); }

        .mp-card {
          --tone: var(--color-muted);
          display: flex; gap: 14px; padding: 14px; margin-bottom: 12px; border-radius: 14px;
          border: 1px solid var(--color-border); border-left: 4px solid var(--tone); background: var(--color-card);
        }
        .mp-tone-gold { --tone: var(--color-gold); }
        .mp-tone-teal { --tone: var(--color-teal); }
        .mp-tone-success { --tone: var(--color-success); }
        .mp-tone-muted { --tone: var(--color-muted); }
        .mp-tone-warning { --tone: var(--color-warning); }

        .mp-photo-wrap { position: relative; width: 72px; height: 72px; flex-shrink: 0; }
        .mp-photo {
          width: 72px; height: 72px; border-radius: 12px; object-fit: cover;
          background: var(--color-surface); border: 1px solid var(--color-border); display: block;
        }
        .mp-status-icon {
          position: absolute; right: -6px; bottom: -6px; width: 24px; height: 24px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center; border: 2px solid var(--color-card);
        }

        .mp-body { min-width: 0; flex: 1; }
        .mp-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; flex-wrap: wrap; }
        .mp-name { font-size: 15px; font-weight: 600; word-break: break-word; color: var(--color-ink); min-width: 0; }
        .mp-amount { margin-top: 2px; font-size: 16px; font-weight: 700; color: var(--color-primary); }
        .mp-asking { font-size: 12px; font-weight: 400; color: var(--color-muted); margin-left: 6px; }
        .mp-text { margin: 8px 0 0; font-size: 13px; line-height: 1.5; color: var(--color-muted); }
        .mp-meta { margin: 8px 0 0; font-size: 12px; color: var(--color-muted); word-break: break-word; }

        .mp-next {
          display: flex; flex-direction: column; gap: 2px; margin-top: 10px; padding: 9px 12px;
          border-radius: 10px; font-size: 13px; line-height: 1.5;
        }
        .mp-next strong { font-size: 12px; letter-spacing: 0.03em; text-transform: uppercase; }
        .mp-next span { color: var(--color-ink); }

        a.mp-cta {
          display: inline-flex; align-items: center; justify-content: center; margin-top: 12px;
          padding: 9px 18px; border-radius: 10px; background: var(--color-primary); color: #fff;
          font-size: 13.5px; font-weight: 600; box-shadow: 0 4px 14px rgba(18, 101, 103, 0.25);
        }
        a.mp-cta:hover { background: var(--color-primary-dark); color: #fff; text-decoration: none; }
        .mp-link { display: inline-block; margin-top: 8px; font-size: 13px; font-weight: 600; color: var(--color-teal); }

        .mp-chip { display: inline-flex; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; white-space: nowrap; }
        .mp-gold { background: var(--color-gold-bg); color: var(--color-gold); }
        .mp-teal { background: color-mix(in srgb, var(--color-teal) 14%, var(--color-card)); color: var(--color-teal); }
        .mp-success { background: var(--color-success-bg); color: var(--color-success); }
        .mp-muted { background: var(--color-border); color: var(--color-muted); }
        .mp-warning { background: var(--color-warning-bg); color: var(--color-warning); }
        .mp-status-icon.mp-gold { background: var(--color-gold); color: #fff; }
        .mp-status-icon.mp-teal { background: var(--color-teal); color: #fff; }
        .mp-status-icon.mp-success { background: var(--color-success); color: #fff; }
        .mp-status-icon.mp-muted { background: var(--color-muted); color: #fff; }
        .mp-status-icon.mp-warning { background: var(--color-warning); color: #fff; }

        .mp-failed { margin-top: 24px; }
        button.mp-failed-toggle {
          display: flex; align-items: center; justify-content: space-between; gap: 10px;
          width: 100%; min-width: 0; align-self: stretch; padding: 12px 14px; border-radius: 12px;
          border: 1px solid var(--color-border); background: var(--color-card); color: var(--color-ink);
          font-size: 14px; font-weight: 600; text-align: left;
        }
        button.mp-failed-toggle:hover { background: var(--color-surface); color: var(--color-ink); border-color: var(--color-border); }
        .mp-failed-label { display: inline-flex; align-items: center; gap: 8px; }
        .mp-chev { font-size: 14px; color: var(--color-muted); }
        .mp-failed-note {
          margin: 12px 0; padding: 10px 12px; border-radius: 10px; font-size: 13px; line-height: 1.55;
          background: var(--color-warning-bg); color: var(--color-ink);
        }
        .mp-row {
          display: flex; align-items: center; gap: 12px; padding: 10px 12px; margin-bottom: 8px;
          border: 1px solid var(--color-border); border-radius: 12px; background: var(--color-card);
        }
        .mp-row .mp-photo-wrap, .mp-row .mp-photo { width: 44px; height: 44px; }
        .mp-row .mp-photo { border-radius: 8px; }
        .mp-row-main { min-width: 0; flex: 1; }
        .mp-row-name { display: block; font-size: 14px; font-weight: 600; word-break: break-word; }
        .mp-row-sub { display: block; font-size: 12px; color: var(--color-muted); }
        .mp-row-amount { font-size: 14px; font-weight: 700; color: var(--color-muted); white-space: nowrap; }

        .mp-empty {
          text-align: center; padding: 32px 16px; border: 1px dashed var(--color-border);
          border-radius: 14px; background: var(--color-card); color: var(--color-muted);
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
        <>
          <div className="mp-stats">
            <div className="mp-stat">
              <span className="mp-stat-label">Total paid</span>
              <span className="mp-stat-value money">{fmt(totalPaid)}</span>
            </div>
            <div className="mp-stat">
              <span className="mp-stat-label">Completed</span>
              <span className="mp-stat-value">{completedCount}</span>
            </div>
            <div className="mp-stat">
              <span className="mp-stat-label">In progress</span>
              <span className={inProgress.length > 0 ? 'mp-stat-value gold' : 'mp-stat-value'}>{inProgress.length}</span>
            </div>
            <div className="mp-stat">
              <span className="mp-stat-label">Failed</span>
              <span className={failed.length > 0 ? 'mp-stat-value warn' : 'mp-stat-value'}>{failed.length}</span>
            </div>
          </div>

          {inProgress.length > 0 && (
            <>
              <div className="mp-section">
                <h3>In progress</h3>
                <span className="mp-count">{inProgress.length}</span>
              </div>
              {inProgress.map(renderCard)}
            </>
          )}

          {history.length > 0 && (
            <>
              <div className="mp-section">
                <h3>History</h3>
                <span className="mp-count plain">{history.length}</span>
              </div>
              {history.map(renderCard)}
            </>
          )}

          {failed.length > 0 && (
            <div className="mp-failed">
              <button
                type="button"
                className="mp-failed-toggle"
                aria-expanded={failedOpen}
                onClick={() => setShowFailed((v) => !v)}
              >
                <span className="mp-failed-label">
                  Failed attempts
                  <span className="mp-count plain">{failed.length}</span>
                </span>
                <span className="mp-chev" aria-hidden="true">
                  {failedOpen ? '▾' : '▸'}
                </span>
              </button>

              {failedOpen && (
                <>
                  <p className="mp-failed-note">
                    These payments did not go through. If you were charged anyway, message support from the{' '}
                    <Link to="/support">Help page</Link> and include the M-Pesa receipt.
                  </p>
                  {failed.map((p) => (
                    <div key={p._id} className="mp-row">
                      <div className="mp-photo-wrap">
                        <Photo p={p} />
                      </div>
                      <div className="mp-row-main">
                        <span className="mp-row-name">{p.listing ? p.listing.title : 'Listing no longer available'}</span>
                        <span className="mp-row-sub">
                          {when(p.createdAt)}
                          {p.mpesaReceipt ? ` · Receipt ${p.mpesaReceipt}` : ''}
                        </span>
                      </div>
                                            <span className="mp-row-amount">{p.amount != null ? fmt(p.amount) : '-'}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}