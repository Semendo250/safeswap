import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getRequests, getMyRequests, createRequest } from '../api/requests.api';

const DAY_MS = 24 * 60 * 60 * 1000;
const STATUS_LABEL = { open: 'Open', fulfilled: 'Fulfilled', closed: 'Closed', removed: 'Removed' };

function errorText(err) {
  if (!err || !err.response) return 'Network error. Check your connection and try again.';
  return (err.response.data && err.response.data.error) || 'Something went wrong. Please try again.';
}

function useDebounced(value, delay = 400) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

function timeAgo(value) {
  const mins = Math.floor((Date.now() - new Date(value).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function daysLeft(value) {
  return Math.max(Math.ceil((new Date(value).getTime() - Date.now()) / DAY_MS), 0);
}

function RequestCard({ r }) {
  const label = r.expired ? 'Expired' : STATUS_LABEL[r.status] || r.status;
  const live = r.status === 'open' && !r.expired;
  return (
    <Link
      to={r.mine && r.status === 'removed' ? `/requests/${r._id}?repost=1` : `/requests/${r._id}`}
      className="rq-card"
    >
      <div className="rq-card-top">
        <strong className="rq-title">{r.title}</strong>
        <span className="rq-budget">Up to KES {Number(r.budget).toLocaleString()}</span>
      </div>
      {r.description && <p className="rq-desc">{r.description}</p>}
      <div className="rq-chips">
        <span className="badge badge-muted">{r.category === 'phone' ? 'Phone' : 'Other item'}</span>
        {r.mine && <span className={live ? 'badge badge-success' : 'badge badge-muted'}>{label}</span>}
        <span className={r.responseCount > 0 ? 'badge badge-gold' : 'badge badge-muted'}>
          {r.responseCount} offer{r.responseCount === 1 ? '' : 's'}
        </span>
        {r.responded && !r.mine && <span className="badge badge-success">You offered</span>}
        {r.mine && r.status === 'removed' && <span className="badge badge-warning">Removed</span>}
      </div>
      <div className="rq-meta">
        {r.buyer ? `${r.buyer.fullName} · ` : ''}
        {timeAgo(r.createdAt)}
        {live ? ` · ${daysLeft(r.expiresAt)} days left` : ''}
      </div>
      {r.mine && r.status === 'removed' && r.canRepost && (
        <span className="rq-repost-cta">
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
        </span>
      )}
    </Link>
  );
}

export default function Requests() {
  const [view, setView] = useState('open');
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ requests: [], total: 0, pages: 1 });
  const [mine, setMine] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [notice, setNotice] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [formCategory, setFormCategory] = useState('phone');
  const [budget, setBudget] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const dSearch = useDebounced(search);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    const request =
      view === 'open'
        ? getRequests({ category, search: dSearch.trim(), sort, page }).then((res) => {
            if (!cancelled) setData(res.data);
          })
        : getMyRequests().then((res) => {
            if (!cancelled) setMine(res.data);
          });
    request
      .catch((err) => {
        if (!cancelled) setError(errorText(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [view, category, dSearch, sort, page, reloadKey]);

  async function submit(e) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setFormError('');
    try {
      await createRequest({ title: title.trim(), category: formCategory, budget, description: description.trim() });
      setTitle('');
      setBudget('');
      setDescription('');
      setShowForm(false);
      setNotice('Your request is live. Sellers who have it will offer a listing.');
      setView('mine');
      setReloadKey((k) => k + 1);
    } catch (err) {
      setFormError(errorText(err));
    } finally {
      setSubmitting(false);
    }
  }

  const list = view === 'open' ? data.requests : mine;
  const filtersActive = !!(dSearch.trim() || category || sort !== 'newest');

  return (
    <div className="rq-page">
      <style>{`
        .rq-page { max-width: 480px; margin: 0 auto; padding: 20px 16px 60px; box-sizing: border-box; }
        @media (min-width: 700px) { .rq-page { max-width: 760px; padding: 28px 24px 70px; } }
        .rq-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 4px; }
        .rq-head h1 { margin: 0; font-size: 26px; }
        .rq-sub { margin: 0 0 14px; font-size: 13px; color: var(--color-muted); }
        .rq-filters { display: grid; gap: 10px; margin: 4px 0 14px; }
        .rq-row { display: flex; gap: 10px; flex-wrap: wrap; }
        .rq-row > * { flex: 1 1 130px; min-width: 0; }
        .rq-card {
          display: block; padding: 14px; margin-bottom: 12px; color: inherit;
          border: 1px solid var(--color-border); border-radius: 12px; background: var(--color-card);
          transition: border-color 0.15s;
        }
        .rq-card:hover { border-color: var(--color-teal); text-decoration: none; }
        .rq-card-top { display: flex; justify-content: space-between; gap: 10px; align-items: flex-start; }
        .rq-title { font-size: 15px; word-break: break-word; }
        .rq-budget { font-size: 13px; font-weight: 700; color: var(--color-primary); white-space: nowrap; }
        .rq-desc { margin: 6px 0 0; font-size: 13px; color: var(--color-muted); word-break: break-word; }
        .rq-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
        .rq-meta { margin-top: 8px; font-size: 12px; color: var(--color-muted); }
        .rq-repost-cta {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          margin-top: 12px; padding: 10px 16px; border-radius: 10px;
          background: var(--color-primary); color: #fff; font-size: 14px; font-weight: 600;
          box-shadow: 0 4px 14px rgba(18, 101, 103, 0.25);
        }
        .rq-form {
          padding: 16px; margin: 4px 0 16px; border: 1px solid var(--color-border);
          border-radius: 12px; background: var(--color-card);
        }
        .rq-notice {
          margin: 0 0 12px; padding: 10px 12px; border-radius: 8px; font-size: 13px;
          background: var(--color-success-bg); color: var(--color-success);
        }
        .rq-empty { padding: 28px 16px; text-align: center; color: var(--color-muted); border: 1px dashed var(--color-border); border-radius: 12px; }
        .rq-pager { display: flex; align-items: center; justify-content: center; gap: 12px; margin: 16px 0; font-size: 13px; color: var(--color-muted); }
      `}</style>

      <div className="rq-head">
        <h1>Requests</h1>
        <button type="button" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancel' : 'Post a request'}
        </button>
      </div>
      <p className="rq-sub">Tell Maseno students what you are looking for. Sellers who have it will offer you a listing.</p>

      {notice && <p className="rq-notice">{notice}</p>}

      {showForm && (
        <form className="rq-form auth-form" onSubmit={submit}>
          <div className="auth-field">
            <label className="auth-label">What are you looking for?</label>
            <input
              type="text"
              placeholder="e.g. Used HP laptop, Samsung A14, scientific calculator"
              value={title}
              maxLength={100}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div className="rq-row">
            <div className="auth-field">
              <label className="auth-label">Category</label>
              <select value={formCategory} onChange={(e) => setFormCategory(e.target.value)}>
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
                placeholder="e.g. 15000"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="auth-field">
            <label className="auth-label">Details (optional)</label>
            <textarea
              rows={3}
              maxLength={500}
              placeholder="Condition, colour, size, anything that helps. No phone numbers or links."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          {formError && <p className="auth-error">{formError}</p>}
          <button type="submit" disabled={submitting || title.trim().length < 3 || !budget}>
            {submitting ? 'Posting...' : 'Post request'}
          </button>
        </form>
      )}

      <div className="tab-group">
        <button
          type="button"
          className={view === 'open' ? 'tab active' : 'tab'}
          onClick={() => {
            setView('open');
            setPage(1);
          }}
        >
          Open requests
        </button>
        <button type="button" className={view === 'mine' ? 'tab active' : 'tab'} onClick={() => setView('mine')}>
          My requests
        </button>
      </div>

      {view === 'open' && (
        <div className="rq-filters">
          <input
            type="search"
            placeholder="Search requests, e.g. laptop, charger"
            value={search}
            maxLength={60}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <div className="rq-row">
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All categories</option>
              <option value="phone">Phones</option>
              <option value="general">Other items</option>
            </select>
            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                setPage(1);
              }}
            >
              <option value="newest">Newest</option>
              <option value="budget">Highest budget</option>
              <option value="unanswered">Fewest offers</option>
            </select>
          </div>
        </div>
      )}

      {loading && <p style={{ color: 'var(--color-muted)' }}>Loading...</p>}
      {!loading && error && (
        <div style={{ color: 'var(--color-muted)' }}>
          <p>{error}</p>
          <button type="button" onClick={() => setReloadKey((k) => k + 1)}>
            Try again
          </button>
        </div>
      )}
      {!loading && !error && list.length === 0 && (
        <div className="rq-empty">
          {view === 'mine'
            ? 'You have not posted a request yet.'
            : filtersActive
            ? 'No requests match your search.'
            : 'No open requests right now. Be the first to post one.'}
        </div>
      )}

      {!error && list.map((r) => <RequestCard key={r._id} r={r} />)}

      {view === 'open' && data.pages > 1 && (
        <div className="rq-pager">
          <button type="button" className="btn-outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </button>
          <span>
            Page {page} of {data.pages}
          </span>
          <button type="button" className="btn-outline" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>
            Next
          </button>
        </div>
      )}
    </div>
  );
}