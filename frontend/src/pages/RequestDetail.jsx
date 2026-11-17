import { useContext, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { getRequestById, respondToRequest, setRequestStatus, repostRequest } from '../api/requests.api';
import { getMyListings } from '../api/listings.api';

function errorText(err) {
  if (!err || !err.response) return 'Network error. Check your connection and try again.';
  return (err.response.data && err.response.data.error) || 'Something went wrong. Please try again.';
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

  function openRepost() {
    if (!r) return;
    setRTitle(r.title);
    setRCategory(r.category);
    setRBudget(String(r.budget));
    setRDescription(r.description || '');
    setRepostError('');
    setShowRepost(true);
  }

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

  // Opens the form straight away when the poster comes from the "removed" notification or the My requests list
  useEffect(() => {
    if (r && r.mine && r.status === 'removed' && r.canRepost && searchParams.get('repost') === '1') {
      openRepost();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r && r._id, r && r.status]);

  const live = r && r.status === 'open' && !r.expired;
  const stateLabel = r ? (r.expired ? 'Expired' : r.status.charAt(0).toUpperCase() + r.status.slice(1)) : '';

  return (
    <div className="rqd-page">
      <style>{`
        .rqd-page { max-width: 480px; margin: 0 auto; padding: 20px 16px 60px; box-sizing: border-box; }
        @media (min-width: 700px) { .rqd-page { max-width: 640px; padding: 28px 24px 70px; } }
        .rqd-back { display: inline-block; margin-bottom: 12px; font-size: 14px; }
        .rqd-card { padding: 16px; margin-bottom: 16px; border: 1px solid var(--color-border); border-radius: 12px; background: var(--color-card); }
        .rqd-title { margin: 0 0 4px; font-size: 22px; word-break: break-word; }
        .rqd-budget { font-size: 16px; font-weight: 700; color: var(--color-primary); }
        .rqd-desc { margin: 10px 0 0; font-size: 14px; white-space: pre-wrap; word-break: break-word; }
        .rqd-chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 10px 0 0; }
        .rqd-meta { margin-top: 10px; font-size: 12px; color: var(--color-muted); }
        .rqd-actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 14px; }
        .rqd-notice { margin: 0 0 12px; padding: 10px 12px; border-radius: 8px; font-size: 13px; background: var(--color-success-bg); color: var(--color-success); }
        .rqd-warn { margin: 0 0 12px; padding: 10px 12px; border-radius: 8px; font-size: 13px; background: var(--color-warning-bg); color: var(--color-warning); }
        .rqd-section { margin: 20px 0 10px; font-size: 16px; }
        .rqd-offer { display: flex; gap: 12px; padding: 12px; margin-bottom: 10px; border: 1px solid var(--color-border); border-radius: 12px; background: var(--color-card); color: inherit; }
        .rqd-offer:hover { border-color: var(--color-teal); text-decoration: none; }
        .rqd-offer img { width: 64px; height: 64px; object-fit: cover; border-radius: var(--radius); border: 1px solid var(--color-border); flex-shrink: 0; }
        .rqd-offer-main { min-width: 0; flex: 1; }
        .rqd-offer-note { margin: 4px 0 0; font-size: 13px; word-break: break-word; }
      `}</style>

      <Link to={isAdmin ? '/admin/requests' : '/requests'} className="rqd-back">
        &larr; Back to requests
      </Link>

      {loading && <p style={{ color: 'var(--color-muted)' }}>Loading...</p>}
      {!loading && error && <p className="rqd-warn">{error}</p>}
      {notice && <p className="rqd-notice">{notice}</p>}

      {r && (
        <>
          <div className="rqd-card">
            <h1 className="rqd-title">{r.title}</h1>
            <div className="rqd-budget">Up to KES {Number(r.budget).toLocaleString()}</div>
            {r.description && <p className="rqd-desc">{r.description}</p>}
            <div className="rqd-chips">
              <span className="badge badge-muted">{r.category === 'phone' ? 'Phone' : 'Other item'}</span>
              <span className={live ? 'badge badge-success' : 'badge badge-muted'}>{stateLabel}</span>
              <span className={r.responseCount > 0 ? 'badge badge-gold' : 'badge badge-muted'}>
                {r.responseCount} offer{r.responseCount === 1 ? '' : 's'}
              </span>
            </div>
            <div className="rqd-meta">
              {r.buyer && !r.mine ? `Asked by ${r.buyer.fullName} · ` : ''}
              Posted {new Date(r.createdAt).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}
              {live ? ` · Expires ${new Date(r.expiresAt).toLocaleDateString([], { day: 'numeric', month: 'short' })}` : ''}
            </div>

            {r.mine && r.status === 'removed' && (
              <>
                <p className="rqd-warn" style={{ marginTop: 12 }}>
                  An admin removed this request{r.removedReason ? `: ${r.removedReason}` : '.'}
                </p>

                {r.canRepost ? (
                  !showRepost && (
                    <div className="rqd-actions">
                      <button type="button" onClick={openRepost}>
                        Edit and repost
                      </button>
                    </div>
                  )
                ) : (
                  <p style={{ fontSize: 13, color: 'var(--color-muted)' }}>
                    This request has been reposted the maximum number of times. You can post a new one from the{' '}
                    <Link to="/requests">Requests page</Link>.
                  </p>
                )}

                {showRepost && (
                  <form className="auth-form" onSubmit={submitRepost} style={{ marginTop: 12 }}>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--color-muted)' }}>
                      Fix what the admin pointed out, then repost. Your request goes back on the board for 30 days.
                    </p>
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
                    <div className="rqd-actions">
                      <button type="submit" disabled={reposting || rTitle.trim().length < 3 || !rBudget}>
                        {reposting ? 'Reposting...' : 'Repost request'}
                      </button>
                      <button type="button" className="btn-outline" disabled={reposting} onClick={() => setShowRepost(false)}>
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </>
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

          {(r.mine || isAdmin) && (
            <>
              <h3 className="rqd-section">Offers ({r.responses ? r.responses.length : 0})</h3>
              {r.responses && r.responses.length === 0 && (
                <p style={{ color: 'var(--color-muted)', fontSize: 14 }}>
                  No offers yet. You will get a notification when a seller offers a listing.
                </p>
              )}
              {(r.responses || []).map((x) =>
                x.listing ? (
                  <Link key={x._id} to={`/listings/${x.listing._id}`} className="rqd-offer">
                    {x.listing.photo && <img src={x.listing.photo} alt={x.listing.title} />}
                    <div className="rqd-offer-main">
                      <strong style={{ wordBreak: 'break-word' }}>{x.listing.title}</strong>
                      <div style={{ fontSize: 13, color: 'var(--color-muted)' }}>
                        KES {Number(x.listing.price).toLocaleString()} · {x.seller ? x.seller.fullName : 'Deleted user'}
                        {x.seller ? ` · Trust ${x.seller.trustScore}` : ''}
                      </div>
                      {x.note && <p className="rqd-offer-note">{x.note}</p>}
                      {x.listing.status !== 'active' && (
                        <span className="badge badge-muted" style={{ marginTop: 6 }}>
                          No longer available
                        </span>
                      )}
                    </div>
                  </Link>
                ) : null
              )}
              {r.mine && (r.responses || []).length > 0 && (
                <p style={{ fontSize: 12, color: 'var(--color-muted)' }}>
                  Open a listing to chat with the seller and pay safely through SafeSwap.
                </p>
              )}
            </>
          )}

          {canRespond && (
            <>
              <h3 className="rqd-section">I have this</h3>
              {r.responded && (
                <p className="rqd-notice">You already sent an offer for this request. You can offer another listing too.</p>
              )}
              {myListings.length === 0 ? (
                <div className="rqd-card" style={{ fontSize: 14 }}>
                  You need a live listing to offer. <Link to="/create-listing">Create a listing</Link>, then come back
                  and offer it here.
                </div>
              ) : (
                <form className="rqd-card auth-form" onSubmit={sendOffer}>
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
                  <button type="submit" disabled={sending || !listingId}>
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