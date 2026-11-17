import { useContext, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { getRequestById, respondToRequest, setRequestStatus, repostRequest } from '../api/requests.api';
import { getMyListings } from '../api/listings.api';

const DAY_MS = 24 * 60 * 60 * 1000;

function errorText(err) {
  if (!err || !err.response) return 'Network error. Check your connection and try again.';
  return (err.response.data && err.response.data.error) || 'Something went wrong. Please try again.';
}

function daysLeft(value) {
  return Math.max(Math.ceil((new Date(value).getTime() - Date.now()) / DAY_MS), 0);
}

function fmtDay(value, withYear = true) {
  return new Date(value).toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    ...(withYear ? { year: 'numeric' } : {}),
  });
}

function Avatar({ person, size = 36 }) {
  const initial = person && person.fullName ? person.fullName.trim().charAt(0).toUpperCase() : '?';
  if (person && person.profilePicture) {
    return (
      <img
        src={person.profilePicture}
        alt={person.fullName}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-primary)',
        color: '#fff',
        fontSize: size * 0.42,
        fontWeight: 700,
      }}
    >
      {initial}
    </span>
  );
}

export default function RequestDetail() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { user } = useContext(AuthContext);
  const isAdmin = user?.role === 'admin';

  const [r, setR] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [notice, setNotice] = useState('');

  const [myListings, setMyListings] = useState([]);
  const [listingId, setListingId] = useState('');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  const [showRepost, setShowRepost] = useState(false);
  const [rTitle, setRTitle] = useState('');
  const [rCategory, setRCategory] = useState('phone');
  const [rBudget, setRBudget] = useState('');
  const [rDescription, setRDescription] = useState('');
  const [reposting, setReposting] = useState(false);
  const [repostError, setRepostError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    getRequestById(id)
      .then((res) => {
        if (!cancelled) setR(res.data);
      })
      .catch((err) => {
        if (!cancelled) {
          setR(null);
          setError(err.response && err.response.status === 404 ? 'This request is no longer available.' : errorText(err));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  // The success message clears itself after a few seconds
  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(''), 6000);
    return () => clearTimeout(t);
  }, [notice]);

  const canRespond = !!r && !r.mine && !isAdmin && r.status === 'open' && !r.expired;

  useEffect(() => {
    if (!canRespond) return undefined;
    let cancelled = false;
    getMyListings()
      .then((res) => {
        if (!cancelled) setMyListings((res.data || []).filter((l) => l.status === 'active'));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [canRespond, reloadKey]);

  function openRepost() {
    if (!r) return;
    setRTitle(r.title);
    setRCategory(r.category);
    setRBudget(String(r.budget));
    setRDescription(r.description || '');
    setRepostError('');
    setShowRepost(true);
  }

  // Opens the form straight away when the poster comes from the "removed" notification
  useEffect(() => {
    if (r && r.mine && r.status === 'removed' && r.canRepost && searchParams.get('repost') === '1') {
      openRepost();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r && r._id, r && r.status]);

  async function submitRepost(e) {
    e.preventDefault();
    if (reposting) return;
    setReposting(true);
    setRepostError('');
    try {
      await repostRequest(id, {
        title: rTitle.trim(),
        category: rCategory,
        budget: rBudget,
        description: rDescription.trim(),
      });
      setShowRepost(false);
      setNotice('Your request is live again.');
      setReloadKey((k) => k + 1);
    } catch (err) {
      setRepostError(errorText(err));
    } finally {
      setReposting(false);
    }
  }

  async function sendOffer(e) {
    e.preventDefault();
    if (sending || !listingId) return;
    setSending(true);
    setFormError('');
    try {
      await respondToRequest(id, { listingId, note: note.trim() });
      setNote('');
      setListingId('');
      setNotice('Your offer was sent. The buyer will contact you through chat if interested.');
      setReloadKey((k) => k + 1);
    } catch (err) {
      setFormError(errorText(err));
    } finally {
      setSending(false);
    }
  }

  async function changeStatus(status) {
    const text = status === 'fulfilled' ? 'Mark this request as fulfilled?' : 'Close this request?';
    if (!window.confirm(text)) return;
    setBusy(true);
    try {
      await setRequestStatus(id, status);
      setNotice(status === 'fulfilled' ? 'Marked as fulfilled.' : 'Request closed.');
      setReloadKey((k) => k + 1);
    } catch (err) {
      setNotice(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  const live = r && r.status === 'open' && !r.expired;
  const stateLabel = r ? (r.expired ? 'Expired' : r.status.charAt(0).toUpperCase() + r.status.slice(1)) : '';
  const stateBadge = live ? 'badge badge-success' : r && r.status === 'removed' ? 'badge badge-warning' : 'badge badge-muted';
  const left = r && live ? daysLeft(r.expiresAt) : 0;
  const offerCount = r && r.responses ? r.responses.length : r ? r.responseCount : 0;

  return (
    <div className="rqd-page">
      <style>{`
        .rqd-page { max-width: 560px; margin: 0 auto; padding: 20px 16px 60px; box-sizing: border-box; }
        @media (min-width: 700px) { .rqd-page { max-width: 720px; padding: 28px 24px 70px; } }

        .rqd-back {
          display: inline-flex; align-items: center; gap: 6px; margin-bottom: 14px;
          font-size: 14px; font-weight: 600; color: var(--color-teal);
        }
        .rqd-back:hover { text-decoration: none; opacity: 0.85; }

        .rqd-toast {
          display: flex; align-items: center; gap: 10px; margin: 0 0 14px; padding: 11px 14px;
          border-radius: 10px; font-size: 13.5px; font-weight: 500;
          background: var(--color-success-bg); color: var(--color-success);
          border: 1px solid color-mix(in srgb, var(--color-success) 30%, transparent);
        }
        .rqd-toast-dot {
          flex: 0 0 18px; width: 18px; height: 18px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          background: var(--color-success); color: #fff; font-size: 11px;
        }
        .rqd-warn { margin: 0 0 14px; padding: 11px 14px; border-radius: 10px; font-size: 13.5px; background: var(--color-warning-bg); color: var(--color-warning); }

        .rqd-hero {
          position: relative; overflow: hidden; margin-bottom: 18px; padding: 26px 20px 20px;
          border: 1px solid var(--color-border); border-radius: 16px; background: var(--color-card);
          box-shadow: 0 10px 32px rgba(18, 101, 103, 0.08);
        }
        .rqd-hero::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 4px;
          background: linear-gradient(90deg, var(--color-primary), var(--color-accent), var(--color-gold-bright));
        }
        .rqd-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
        .rqd-title { margin: 0; font-size: 24px; line-height: 1.25; letter-spacing: -0.01em; word-break: break-word; }
        .rqd-desc { margin: 10px 0 0; font-size: 14.5px; line-height: 1.6; color: var(--color-ink); white-space: pre-wrap; word-break: break-word; }

        .rqd-poster {
          display: flex; align-items: center; gap: 10px; margin-top: 16px; padding: 10px 12px;
          border-radius: 12px; background: var(--color-surface);
        }
        .rqd-poster-name { font-size: 14px; font-weight: 600; word-break: break-word; }
        .rqd-poster-sub { font-size: 12px; color: var(--color-muted); }

        .rqd-stats {
          display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0; margin-top: 18px;
          border: 1px solid var(--color-border); border-radius: 12px; overflow: hidden;
        }
        .rqd-stat { padding: 12px 10px; text-align: center; border-left: 1px solid var(--color-border); min-width: 0; }
        .rqd-stat:first-child { border-left: none; }
        .rqd-stat-label {
          display: block; margin-bottom: 3px; font-size: 11px; font-weight: 700;
          letter-spacing: 0.05em; text-transform: uppercase; color: var(--color-muted);
        }
        .rqd-stat-value { display: block; font-size: 16px; font-weight: 700; color: var(--color-ink); word-break: break-word; }
        .rqd-stat-value.money { color: var(--color-primary); }
        .rqd-stat-value.warn { color: var(--color-warning); }

        .rqd-meta { margin-top: 12px; font-size: 12.5px; color: var(--color-muted); }

        .rqd-actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 18px; padding-top: 16px; border-top: 1px solid var(--color-border); }
        .rqd-actions > button { flex: 1 1 150px; align-self: auto; padding: 11px 16px; border-radius: 10px; font-size: 14px; }
        .rqd-actions-plain { margin-top: 0; padding-top: 0; border-top: none; }

        .rqd-removed { margin-top: 18px; padding: 14px; border: 1px solid var(--color-warning); border-radius: 12px; background: var(--color-warning-bg); }
        .rqd-removed-head { display: flex; gap: 10px; align-items: flex-start; }
        .rqd-removed-icon {
          flex: 0 0 28px; width: 28px; height: 28px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          background: var(--color-warning); color: #fff; font-size: 15px; font-weight: 700;
        }
        .rqd-removed-title { margin: 0; font-size: 14px; font-weight: 700; color: var(--color-warning); }
        .rqd-removed-reason { margin: 2px 0 0; font-size: 13px; color: var(--color-ink); word-break: break-word; }
        .rqd-removed-note { margin: 12px 0 0; font-size: 13px; color: var(--color-muted); }
        button.rqd-repost-btn {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          width: 100%; align-self: stretch; margin-top: 12px; padding: 12px 20px;
          font-size: 14.5px; border-radius: 10px; box-shadow: 0 4px 14px rgba(18, 101, 103, 0.25);
        }

        .rqd-form-card { margin-bottom: 18px; padding: 18px; border: 1px solid var(--color-border); border-radius: 16px; background: var(--color-card); }
        .rqd-form-title { margin: 0 0 4px; font-size: 16px; }
        .rqd-form-sub { margin: 0 0 4px; font-size: 13px; color: var(--color-muted); line-height: 1.5; }

        .rqd-section { display: flex; align-items: center; gap: 8px; margin: 26px 0 12px; }
        .rqd-section h3 { margin: 0; font-size: 17px; }
        .rqd-count {
          min-width: 24px; padding: 2px 8px; border-radius: 999px; text-align: center;
          font-size: 12px; font-weight: 700; background: var(--color-gold-bg); color: var(--color-gold);
        }
        .rqd-count.zero { background: var(--color-border); color: var(--color-muted); }

        .rqd-empty {
          padding: 28px 16px; text-align: center; border: 1px dashed var(--color-border);
          border-radius: 14px; background: var(--color-card);
        }
        .rqd-empty-icon {
          width: 46px; height: 46px; margin: 0 auto 10px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          background: color-mix(in srgb, var(--color-teal) 12%, var(--color-card)); color: var(--color-teal);
        }
        .rqd-empty-title { margin: 0 0 4px; font-size: 15px; font-weight: 600; }
        .rqd-empty-text { margin: 0 auto; max-width: 320px; font-size: 13px; line-height: 1.55; color: var(--color-muted); }

        .rqd-offer {
          display: flex; align-items: center; gap: 12px; padding: 12px; margin-bottom: 10px;
          border: 1px solid var(--color-border); border-radius: 14px; background: var(--color-card);
          color: inherit; transition: border-color 0.15s, transform 0.1s;
        }
        .rqd-offer:hover { border-color: var(--color-teal); text-decoration: none; }
        .rqd-offer:active { transform: scale(0.99); }
        .rqd-offer img.rqd-offer-img {
          width: 64px; height: 64px; object-fit: cover; border-radius: var(--radius);
          border: 1px solid var(--color-border); flex-shrink: 0;
        }
        .rqd-offer-main { min-width: 0; flex: 1; }
        .rqd-offer-title { display: block; font-size: 14.5px; font-weight: 600; word-break: break-word; }
        .rqd-offer-price { font-size: 14px; font-weight: 700; color: var(--color-primary); }
        .rqd-offer-seller { font-size: 12.5px; color: var(--color-muted); }
        .rqd-offer-note { margin: 6px 0 0; padding: 6px 10px; border-radius: 8px; font-size: 13px; background: var(--color-surface); word-break: break-word; }
        .rqd-chevron { color: var(--color-muted); font-size: 20px; line-height: 1; flex-shrink: 0; }
        .rqd-hint { margin: 4px 0 0; font-size: 12px; color: var(--color-muted); }

        @media (max-width: 480px) {
          .rqd-title { font-size: 21px; }
          .rqd-stat-value { font-size: 14.5px; }
        }
      `}</style>

      <Link to={isAdmin ? '/admin/requests' : '/requests'} className="rqd-back">
        <span aria-hidden="true">&larr;</span> Back to requests
      </Link>

      {loading && !r && <p style={{ color: 'var(--color-muted)' }}>Loading...</p>}
      {!loading && error && <p className="rqd-warn">{error}</p>}
      {notice && (
        <div className="rqd-toast" role="status">
          <span className="rqd-toast-dot" aria-hidden="true">
            ✓
          </span>
          <span>{notice}</span>
        </div>
      )}

      {r && (
        <>
          <div className="rqd-hero">
            <div className="rqd-tags">
              <span className={stateBadge}>{stateLabel}</span>
              <span className="badge badge-muted">{r.category === 'phone' ? 'Phone' : 'Other item'}</span>
              {r.mine && <span className="badge badge-gold">Your request</span>}
            </div>

            <h1 className="rqd-title">{r.title}</h1>
            {r.description && <p className="rqd-desc">{r.description}</p>}

            {r.buyer && !r.mine && (
              <div className="rqd-poster">
                <Avatar person={r.buyer} />
                <div style={{ minWidth: 0 }}>
                  <div className="rqd-poster-name">{r.buyer.fullName}</div>
                  <div className="rqd-poster-sub">
                    Trust score {r.buyer.trustScore}
                    {r.buyer.completedSales > 0 ? ` · ${r.buyer.completedSales} sale${r.buyer.completedSales === 1 ? '' : 's'}` : ''}
                  </div>
                </div>
              </div>
            )}

            <div className="rqd-stats">
              <div className="rqd-stat">
                <span className="rqd-stat-label">Budget</span>
                <span className="rqd-stat-value money">KES {Number(r.budget).toLocaleString()}</span>
              </div>
              <div className="rqd-stat">
                <span className="rqd-stat-label">Offers</span>
                <span className="rqd-stat-value">{r.responseCount}</span>
              </div>
              <div className="rqd-stat">
                <span className="rqd-stat-label">{live ? 'Time left' : 'Status'}</span>
                <span className={live && left <= 3 ? 'rqd-stat-value warn' : 'rqd-stat-value'}>
                  {live ? `${left} day${left === 1 ? '' : 's'}` : stateLabel}
                </span>
              </div>
            </div>

            <div className="rqd-meta">
              Posted {fmtDay(r.createdAt)}
              {live ? ` · Expires ${fmtDay(r.expiresAt, false)}` : ''}
            </div>

            {r.mine && r.status === 'removed' && (
              <div className="rqd-removed">
                <div className="rqd-removed-head">
                  <span className="rqd-removed-icon" aria-hidden="true">!</span>
                  <div style={{ minWidth: 0 }}>
                    <p className="rqd-removed-title">An admin removed this request</p>
                    {r.removedReason && <p className="rqd-removed-reason">{r.removedReason}</p>}
                  </div>
                </div>

                {r.canRepost ? (
                  !showRepost && (
                    <button type="button" className="rqd-repost-btn" onClick={openRepost}>
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
                      </svg>
                      Edit and repost
                    </button>
                  )
                ) : (
                  <p className="rqd-removed-note">
                    This request has been reposted the maximum number of times. You can post a new one from the{' '}
                    <Link to="/requests">Requests page</Link>.
                  </p>
                )}
              </div>
            )}

            {r.mine && live && (
              <div className="rqd-actions">
                <button type="button" disabled={busy} onClick={() => changeStatus('fulfilled')}>
                  Mark as fulfilled
                </button>
                <button type="button" className="btn-outline" disabled={busy} onClick={() => changeStatus('closed')}>
                  Close request
                </button>
              </div>
            )}
          </div>

          {r.mine && r.status === 'removed' && r.canRepost && showRepost && (
            <form className="rqd-form-card auth-form" onSubmit={submitRepost}>
              <div>
                <h3 className="rqd-form-title">Edit your request</h3>
                <p className="rqd-form-sub">
                  Fix what the admin pointed out, then repost. Your request goes back on the board for 30 days.
                </p>
              </div>
              <div className="auth-field">
                <label className="auth-label">What are you looking for?</label>
                <input
                  type="text"
                  value={rTitle}
                  maxLength={100}
                  onChange={(e) => setRTitle(e.target.value)}
                  required
                />
              </div>
              <div className="auth-field">
                <label className="auth-label">Category</label>
                <select value={rCategory} onChange={(e) => setRCategory(e.target.value)}>
                  <option value="phone">Phone</option>
                  <option value="general">Other item</option>
                </select>
              </div>
              <div className="auth-field">
                <label className="auth-label">Your budget (KES)</label>
                <input
                  type="number"
                  inputMode="numeric"
                  min="1"
                  max="250000"
                  value={rBudget}
                  onChange={(e) => setRBudget(e.target.value)}
                  required
                />
              </div>
              <div className="auth-field">
                <label className="auth-label">Details (optional)</label>
                <textarea
                  rows={3}
                  maxLength={500}
                  placeholder="No phone numbers, emails or links."
                  value={rDescription}
                  onChange={(e) => setRDescription(e.target.value)}
                />
              </div>
              {repostError && <p className="auth-error">{repostError}</p>}
              <div className="rqd-actions rqd-actions-plain">
                <button type="submit" disabled={reposting || rTitle.trim().length < 3 || !rBudget}>
                  {reposting ? 'Reposting...' : 'Repost request'}
                </button>
                <button type="button" className="btn-outline" disabled={reposting} onClick={() => setShowRepost(false)}>
                  Cancel
                </button>
              </div>
            </form>
          )}

          {(r.mine || isAdmin) && (
            <>
              <div className="rqd-section">
                <h3>Offers</h3>
                <span className={offerCount > 0 ? 'rqd-count' : 'rqd-count zero'}>{offerCount}</span>
              </div>

              {r.responses && r.responses.length === 0 && (
                <div className="rqd-empty">
                  <div className="rqd-empty-icon" aria-hidden="true">
                    <svg
                      width="22"
                      height="22"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="11" cy="11" r="7" />
                      <path d="m21 21-4.3-4.3" />
                    </svg>
                  </div>
                  <p className="rqd-empty-title">No offers yet</p>
                  <p className="rqd-empty-text">
                    {r.mine
                      ? 'Sellers who have what you need can offer a listing. You will get a notification as soon as one does.'
                      : 'Nobody has offered a listing for this request yet.'}
                  </p>
                </div>
              )}

              {(r.responses || []).map((x) =>
                x.listing ? (
                  <Link key={x._id} to={`/listings/${x.listing._id}`} className="rqd-offer">
                    {x.listing.photo && <img className="rqd-offer-img" src={x.listing.photo} alt={x.listing.title} />}
                    <div className="rqd-offer-main">
                      <span className="rqd-offer-title">{x.listing.title}</span>
                      <span className="rqd-offer-price">KES {Number(x.listing.price).toLocaleString()}</span>
                      <div className="rqd-offer-seller">
                        {x.seller ? x.seller.fullName : 'Deleted user'}
                        {x.seller ? ` · Trust ${x.seller.trustScore}` : ''}
                      </div>
                      {x.note && <p className="rqd-offer-note">{x.note}</p>}
                      {x.listing.status !== 'active' && (
                        <span className="badge badge-muted" style={{ marginTop: 6 }}>
                          No longer available
                        </span>
                      )}
                    </div>
                    <span className="rqd-chevron" aria-hidden="true">
                      ›
                    </span>
                  </Link>
                ) : null
              )}
              {r.mine && (r.responses || []).length > 0 && (
                <p className="rqd-hint">Open a listing to chat with the seller and pay safely through SafeSwap.</p>
              )}
            </>
          )}

          {canRespond && (
            <>
              <div className="rqd-section">
                <h3>I have this</h3>
              </div>
              {r.responded && (
                <div className="rqd-toast">
                  <span className="rqd-toast-dot" aria-hidden="true">
                    ✓
                  </span>
                  <span>You already sent an offer for this request. You can offer another listing too.</span>
                </div>
              )}
              {myListings.length === 0 ? (
                <div className="rqd-empty">
                  <p className="rqd-empty-title">You need a live listing to offer</p>
                  <p className="rqd-empty-text">
                    <Link to="/create-listing">Create a listing</Link>, then come back and offer it here.
                  </p>
                </div>
              ) : (
                <form className="rqd-form-card auth-form" onSubmit={sendOffer}>
                  <p className="rqd-form-sub">
                    Pick one of your live listings that matches. The buyer will see it and can chat with you.
                  </p>
                  <div className="auth-field">
                    <label className="auth-label">Which of your listings matches?</label>
                    <select value={listingId} onChange={(e) => setListingId(e.target.value)} required>
                      <option value="">Choose one of your listings</option>
                      {myListings.map((l) => (
                        <option key={l._id} value={l._id}>
                          {l.title} (KES {Number(l.price).toLocaleString()})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="auth-field">
                    <label className="auth-label">Note to the buyer (optional)</label>
                    <textarea
                      rows={3}
                      maxLength={300}
                      placeholder="Tell them why it fits. No phone numbers or links."
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </div>
                  {formError && <p className="auth-error">{formError}</p>}
                  <button
                    type="submit"
                    disabled={sending || !listingId}
                    style={{ width: '100%', alignSelf: 'stretch', padding: '12px 20px', borderRadius: 10, fontSize: 14.5 }}
                  >
                    {sending ? 'Sending...' : 'Send offer'}
                  </button>
                </form>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}