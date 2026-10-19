import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getReviews, deleteReview } from '../../api/admin.api';
import {
  PageShell,
  Pager,
  Notice,
  Tabs,
  ConfirmDialog,
  btn,
  errText,
  fmtDate,
  useDebounced,
} from '../../components/admin/AdminUi';

function Stars({ value }) {
  return (
    <span aria-label={`${value} out of 5`} style={{ color: 'var(--color-gold)', fontSize: 16, letterSpacing: 1 }}>
      {'★'.repeat(value)}
      <span style={{ color: 'var(--color-border)' }}>{'★'.repeat(5 - value)}</span>
    </span>
  );
}

function MetaItem({ label, children }) {
  return (
    <div className="rev-meta-item">
      <span className="rev-meta-label">{label}</span>
      <span className="rev-meta-value">{children}</span>
    </div>
  );
}

export default function Reviews() {
  const [rating, setRating] = useState('all');
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [data, setData] = useState({ reviews: [], counts: {}, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [dialog, setDialog] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    getReviews({ rating, search: debounced, page })
      .then((res) => {
        if (!cancelled) setData(res.data);
      })
      .catch((err) => {
        if (!cancelled) setError(errText(err, 'Could not load reviews.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [rating, debounced, page, reloadKey]);

  function askDelete(r) {
    setDialog({
      title: 'Delete this review?',
      message: `${r.rating}-star review of ${r.sellerName} by ${r.reviewerName}. The seller's average rating is recalculated. Use this for abusive or fake reviews only.`,
      confirmLabel: 'Delete review',
      danger: true,
      askReason: 'required',
      onConfirm: async (reason) => {
        await deleteReview(r._id, reason);
        setDialog(null);
        setNotice('Review deleted.');
        setReloadKey((k) => k + 1);
      },
    });
  }

  const counts = data.counts || {};
  const tabs = [
    ['all', `All (${counts.all || 0})`],
    ...[5, 4, 3, 2, 1].map((n) => [String(n), `${n} ★ (${counts[n] || 0})`]),
  ];
  const filtersActive = !!debounced.trim() || rating !== 'all';

  return (
    <PageShell title="Reviews" subtitle="Ratings buyers leave after a completed deal. Delete abusive or fake ones.">
      <style>{`
        .rev-filter { display: flex; align-items: center; gap: 10px; }
        .rev-filter-label {
          width: 52px; flex-shrink: 0; font-size: 11px; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.04em; color: var(--color-muted);
        }
        .rev-filter > div:last-child { min-width: 0; flex: 1; }

        .rev-card {
          border: 1px solid var(--color-border); border-radius: 12px; padding: 14px;
          margin-bottom: 14px; background: var(--color-card);
        }
        .rev-top { display: flex; gap: 12px; align-items: flex-start; justify-content: space-between; }
        .rev-comment { margin: 8px 0 0; font-size: 14px; white-space: pre-wrap; word-break: break-word; }
        .rev-none { margin: 8px 0 0; font-size: 13px; color: var(--color-muted); }

        .rev-meta {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
          gap: 10px 20px; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--color-border);
        }
        .rev-meta-item { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .rev-meta-label {
          font-size: 11px; font-weight: 600; text-transform: uppercase;
          letter-spacing: 0.04em; color: var(--color-muted);
        }
        .rev-meta-value { font-size: 13px; color: var(--color-ink); word-break: break-word; }

        .rev-empty {
          text-align: center; padding: 32px 16px; border: 1px dashed var(--color-border);
          border-radius: 12px; color: var(--color-muted);
        }
        .rev-empty-icon { font-size: 30px; margin-bottom: 6px; }
        .rev-empty-title { margin: 0 0 4px; font-size: 14px; font-weight: 600; color: var(--color-ink); }
        .rev-empty-text { margin: 0; font-size: 13px; }

        @media (max-width: 600px) {
          .rev-filter { flex-direction: column; align-items: stretch; gap: 0; }
          .rev-filter-label { width: auto; margin-top: 6px; }
        }
      `}</style>

      <input
        type="search"
        placeholder="Search seller, buyer, listing or comment"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
      />

      <div className="rev-filter">
        <span className="rev-filter-label">Rating</span>
        <Tabs
          options={tabs}
          value={rating}
          onChange={(v) => {
            setRating(v);
            setPage(1);
          }}
        />
      </div>

      {notice && <Notice onClose={() => setNotice('')}>{notice}</Notice>}
      {error && <Notice tone="warning">{error}</Notice>}
      {loading && data.reviews.length === 0 && <p style={{ color: 'var(--color-muted)' }}>Loading...</p>}

      {!loading && !error && data.reviews.length === 0 && (
        <div className="rev-empty">
          <div className="rev-empty-icon">⭐</div>
          <p className="rev-empty-title">{filtersActive ? 'No reviews match' : 'No reviews yet'}</p>
          <p className="rev-empty-text">
            {filtersActive ? 'Try a different filter or search.' : 'Reviews appear after buyers confirm a handover.'}
          </p>
        </div>
      )}

      {data.reviews.map((r) => (
        <div key={r._id} className="rev-card">
          <div className="rev-top">
            <Stars value={r.rating} />
            <button type="button" onClick={() => askDelete(r)} style={btn('danger')}>
              Delete
            </button>
          </div>
          {r.comment ? <p className="rev-comment">{r.comment}</p> : <p className="rev-none">No comment</p>}
          <div className="rev-meta">
            <MetaItem label="Seller">{r.sellerName}</MetaItem>
            <MetaItem label="Written by">{r.reviewerName}</MetaItem>
            <MetaItem label="Listing">
              {r.listing ? <Link to={`/listings/${r.listing._id}`}>{r.listing.title}</Link> : 'Deleted listing'}
            </MetaItem>
            <MetaItem label="Date">{fmtDate(r.createdAt)}</MetaItem>
          </div>
        </div>
      ))}

      <Pager page={page} pages={data.pages} onPage={setPage} />

      {dialog && <ConfirmDialog {...dialog} onCancel={() => setDialog(null)} />}
    </PageShell>
  );
}