import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getReports, resolveReport } from '../../api/admin.api';
import {
  PageShell,
  Chip,
  Pager,
  Notice,
  Tabs,
  ConfirmDialog,
  btn,
  errText,
  fmtDate,
  money,
  useDebounced,
  LISTING_TONE,
} from '../../components/admin/AdminUi';

const FILTERS = [
  ['pending', 'Waiting'],
  ['upheld', 'Upheld'],
  ['dismissed', 'Dismissed'],
  ['all', 'All'],
];
const REASON_LABEL = {
  suspected_stolen: 'Looks stolen',
  price_suspicious: 'Price looks suspicious',
  fake_listing: 'Fake listing',
  other: 'Other',
};
const STATUS_LABEL = { pending: 'Waiting', reviewed_upheld: 'Upheld', reviewed_dismissed: 'Dismissed' };
const STATUS_TONE = { pending: 'gold', reviewed_upheld: 'warning', reviewed_dismissed: 'muted' };

function MetaItem({ label, children }) {
  return (
    <div className="rep-meta-item">
      <span className="rep-meta-label">{label}</span>
      <span className="rep-meta-value">{children}</span>
    </div>
  );
}

export default function Reports() {
  const [status, setStatus] = useState('pending');
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [data, setData] = useState({ reports: [], counts: {}, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [dialog, setDialog] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    getReports({ status, search: debounced, page })
      .then((res) => {
        if (!cancelled) setData(res.data);
      })
      .catch((err) => {
        if (!cancelled) setError(errText(err, 'Could not load reports.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [status, debounced, page, reloadKey]);

  function decide(r, decision) {
    const title = r.listing ? r.listing.title : 'this listing';
    setDialog({
      title: decision === 'uphold' ? `Uphold the report on "${title}"?` : `Dismiss the report on "${title}"?`,
      message:
        decision === 'uphold'
          ? "The report is confirmed. The seller's report count goes up and their trust score drops. This does not remove the listing: use Flagged queue or All listings for that."
          : 'The report was not justified. The listing keeps its place, and its report count goes down by one. If it was pulled back for review, approve it in the Flagged queue.',
      confirmLabel: decision === 'uphold' ? 'Uphold report' : 'Dismiss report',
      danger: decision === 'uphold',
      askReason: 'required',
      onConfirm: async (reason) => {
        await resolveReport(r._id, decision, reason);
        setDialog(null);
        setNotice(decision === 'uphold' ? 'Report upheld.' : 'Report dismissed.');
        setReloadKey((k) => k + 1);
      },
    });
  }

  const counts = data.counts || {};
  const tabs = FILTERS.map(([v, label]) => [v, `${label} (${counts[v] || 0})`]);
  const filtersActive = !!debounced.trim() || status !== 'pending';

  return (
    <PageShell title="Reports" subtitle="Reports from students about suspicious listings. Decide each one and say why.">
      <style>{`
        .rep-filter { display: flex; align-items: center; gap: 10px; }
        .rep-filter-label {
          width: 52px; flex-shrink: 0; font-size: 11px; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.04em; color: var(--color-muted);
        }
        .rep-filter > div:last-child { min-width: 0; flex: 1; }

        .rep-card {
          border: 1px solid var(--color-border); border-radius: 12px; padding: 14px;
          margin-bottom: 14px; background: var(--color-card);
        }
        .rep-top { display: flex; gap: 12px; align-items: flex-start; justify-content: space-between; }
        .rep-main { min-width: 0; flex: 1; }
        a.rep-title, strong.rep-title {
          display: block; font-size: 15px; font-weight: 600; word-break: break-word; color: var(--color-ink);
        }
        a.rep-title:hover { color: var(--color-teal); }
        .rep-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
        .rep-actions { display: flex; flex-direction: column; gap: 8px; flex-shrink: 0; }
        .rep-details {
          margin: 10px 0 0; padding: 10px 12px; border-radius: 8px; font-size: 13px;
          background: var(--color-surface); white-space: pre-wrap; word-break: break-word;
        }

        .rep-meta {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
          gap: 10px 20px; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--color-border);
        }
        .rep-meta-item { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .rep-meta-label {
          font-size: 11px; font-weight: 600; text-transform: uppercase;
          letter-spacing: 0.04em; color: var(--color-muted);
        }
        .rep-meta-value { font-size: 13px; color: var(--color-ink); word-break: break-word; }

        .rep-empty {
          text-align: center; padding: 32px 16px; border: 1px dashed var(--color-border);
          border-radius: 12px; color: var(--color-muted);
        }
        .rep-empty-icon { font-size: 30px; margin-bottom: 6px; }
        .rep-empty-title { margin: 0 0 4px; font-size: 14px; font-weight: 600; color: var(--color-ink); }
        .rep-empty-text { margin: 0; font-size: 13px; }

        @media (max-width: 600px) {
          .rep-filter { flex-direction: column; align-items: stretch; gap: 0; }
          .rep-filter-label { width: auto; margin-top: 6px; }
          .rep-top { flex-wrap: wrap; }
          .rep-actions { flex-direction: row; flex-basis: 100%; }
        }
      `}</style>

      <input
        type="search"
        placeholder="Search listing, reporter or details"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
      />

      <div className="rep-filter">
        <span className="rep-filter-label">Status</span>
        <Tabs
          options={tabs}
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
        />
      </div>

      {notice && <Notice onClose={() => setNotice('')}>{notice}</Notice>}
      {error && <Notice tone="warning">{error}</Notice>}
      {loading && data.reports.length === 0 && <p style={{ color: 'var(--color-muted)' }}>Loading...</p>}

      {!loading && !error && data.reports.length === 0 && (
        <div className="rep-empty">
          <div className="rep-empty-icon">✅</div>
          <p className="rep-empty-title">{filtersActive ? 'No reports match' : 'No reports waiting'}</p>
          <p className="rep-empty-text">
            {filtersActive ? 'Try a different filter or search.' : 'New reports from students will show up here.'}
          </p>
        </div>
      )}

      {data.reports.map((r) => (
        <div key={r._id} className="rep-card">
          <div className="rep-top">
            <div className="rep-main">
              {r.listing ? (
                <Link to={`/listings/${r.listing._id}`} className="rep-title">
                  {r.listing.title}
                </Link>
              ) : (
                <strong className="rep-title">Deleted listing</strong>
              )}
              <div className="rep-chips">
                <Chip tone="warning">{REASON_LABEL[r.reason] || r.reason}</Chip>
                <Chip tone={STATUS_TONE[r.status] || 'muted'}>{STATUS_LABEL[r.status] || r.status}</Chip>
                {r.listing && (
                  <Chip tone={LISTING_TONE[r.listing.status] || 'muted'}>{r.listing.status.replace('_', ' ')}</Chip>
                )}
                {r.listing && r.listing.reportCount > 1 && (
                  <Chip tone="gold">{r.listing.reportCount} reports on this listing</Chip>
                )}
              </div>
            </div>

            {r.status === 'pending' && (
              <div className="rep-actions">
                <button type="button" onClick={() => decide(r, 'uphold')} style={btn('danger', { minWidth: 96 })}>
                  Uphold
                </button>
                <button type="button" onClick={() => decide(r, 'dismiss')} style={btn('outline', { minWidth: 96 })}>
                  Dismiss
                </button>
              </div>
            )}
          </div>

          {r.details && <p className="rep-details">{r.details}</p>}

          <div className="rep-meta">
            <MetaItem label="Reported by">{r.reporter ? `${r.reporter.fullName} (${r.reporter.email})` : 'Deleted user'}</MetaItem>
            <MetaItem label="Seller">{r.listing ? r.listing.sellerName : '-'}</MetaItem>
            {r.listing && <MetaItem label="Price">{money(r.listing.price)}</MetaItem>}
            <MetaItem label="Reported">{fmtDate(r.createdAt)}</MetaItem>
            {r.status !== 'pending' && <MetaItem label="Decided">{fmtDate(r.updatedAt)}</MetaItem>}
          </div>
        </div>
      ))}

      <Pager page={page} pages={data.pages} onPage={setPage} />

      {dialog && <ConfirmDialog {...dialog} onCancel={() => setDialog(null)} />}
    </PageShell>
  );
}