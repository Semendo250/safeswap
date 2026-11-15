import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import RefreshButton from '../../components/admin/RefreshButton';
import { getRequestsAdmin, getTopRequested, removeRequestAdmin, restoreRequestAdmin } from '../../api/admin.api';
import { getRequestById } from '../../api/requests.api';
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
} from '../../components/admin/AdminUi';

const FILTERS = [
  ['open', 'Open'],
  ['expired', 'Expired'],
  ['fulfilled', 'Fulfilled'],
  ['closed', 'Closed'],
  ['removed', 'Removed'],
  ['all', 'All'],
];
const STATUS_TONE = { open: 'success', expired: 'muted', fulfilled: 'teal', closed: 'muted', removed: 'warning' };
const STATUS_LABEL = { open: 'Open', expired: 'Expired', fulfilled: 'Fulfilled', closed: 'Closed', removed: 'Removed' };

function MetaItem({ label, children }) {
  return (
    <div className="arq-meta-item">
      <span className="arq-meta-label">{label}</span>
      <span className="arq-meta-value">{children}</span>
    </div>
  );
}

export default function AdminRequests() {
  const [status, setStatus] = useState('open');
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const [keyword, setKeyword] = useState('');
  const [keywordLabel, setKeywordLabel] = useState('');
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [data, setData] = useState({ requests: [], counts: {}, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [dialog, setDialog] = useState(null);

  const [topDays, setTopDays] = useState(30);
  const [top, setTop] = useState(null);
  const [topError, setTopError] = useState('');

  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    getRequestsAdmin({ status, search: debounced, keyword, page })
      .then((res) => {
        if (!cancelled) setData(res.data);
      })
      .catch((err) => {
        if (!cancelled) setError(errText(err, 'Could not load requests.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [status, debounced, keyword, page, reloadKey]);

  useEffect(() => {
    let cancelled = false;
    setTopError('');
    getTopRequested(topDays)
      .then((res) => {
        if (!cancelled) setTop(res.data);
      })
      .catch((err) => {
        if (!cancelled) setTopError(errText(err, 'Could not load the most requested items.'));
      });
    return () => {
      cancelled = true;
    };
  }, [topDays, reloadKey]);

  function pickItem(item) {
    setKeyword(item.keyword);
    setKeywordLabel(item.title);
    setStatus('all');
    setPage(1);
    setSearch('');
    const el = document.getElementById('arq-list');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function clearKeyword() {
    setKeyword('');
    setKeywordLabel('');
    setPage(1);
  }

  async function toggleOffers(r) {
    if (expanded[r._id]) {
      setExpanded((prev) => {
        const next = { ...prev };
        delete next[r._id];
        return next;
      });
      return;
    }
    setExpanded((prev) => ({ ...prev, [r._id]: { loading: true, responses: [], error: '' } }));
    try {
      const res = await getRequestById(r._id);
      setExpanded((prev) => ({ ...prev, [r._id]: { loading: false, responses: res.data.responses || [], error: '' } }));
    } catch (err) {
      setExpanded((prev) => ({
        ...prev,
        [r._id]: { loading: false, responses: [], error: errText(err, 'Could not load offers.') },
      }));
    }
  }

  function removeDialog(r) {
    setDialog({
      title: `Remove "${r.title}"?`,
      message: 'The request disappears from the board and the student is told it was removed, with your reason.',
      confirmLabel: 'Remove request',
      danger: true,
      askReason: 'required',
      onConfirm: async (reason) => {
        await removeRequestAdmin(r._id, reason);
        setDialog(null);
        setNotice('Request removed.');
        setReloadKey((k) => k + 1);
      },
    });
  }

  function restoreDialog(r) {
    setDialog({
      title: `Restore "${r.title}"?`,
      message: 'The request goes back on the board for another 30 days.',
      confirmLabel: 'Restore request',
      askReason: 'required',
      onConfirm: async (reason) => {
        await restoreRequestAdmin(r._id, reason);
        setDialog(null);
        setNotice('Request restored.');
        setReloadKey((k) => k + 1);
      },
    });
  }

  const counts = data.counts || {};
  const tabs = FILTERS.map(([v, label]) => [v, `${label} (${counts[v] || 0})`]);
  const filtersActive = !!(debounced.trim() || keyword || status !== 'open');

  return (
    <PageShell
      title="Requests"
      subtitle="What students are asking for. See what is most wanted, check offers, and remove anything that should not be there."
    >
      <style>{`
        .arq-toolbar { display: flex; justify-content: flex-end; margin-bottom: 4px; }
        .arq-section { display: flex; align-items: baseline; gap: 8px; margin: 22px 0 10px; }
        .arq-section h3 { margin: 0; font-size: 16px; text-align: left; }
        .arq-hint { font-size: 12px; color: var(--color-muted); }
        .arq-filter { display: flex; align-items: center; gap: 10px; }
        .arq-filter-label {
          width: 52px; flex-shrink: 0; font-size: 11px; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.04em; color: var(--color-muted);
        }
        .arq-filter > div:last-child { min-width: 0; flex: 1; }

        .arq-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; margin-bottom: 12px; }
        .arq-stat { padding: 12px; border: 1px solid var(--color-border); border-radius: 12px; background: var(--color-card); }
        .arq-stat-label { margin: 0; font-size: 12px; color: var(--color-muted); }
        .arq-stat-value { margin: 4px 0 0; font-size: 22px; font-weight: 700; color: var(--color-primary); }

        .arq-top { border: 1px solid var(--color-border); border-radius: 12px; background: var(--color-card); overflow: hidden; }
        button.arq-top-row {
          display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%;
          min-width: 0; align-self: auto; padding: 12px 14px; border: none; border-radius: 0;
          border-top: 1px solid var(--color-border); background: transparent; color: var(--color-ink);
          text-align: left; font-weight: 400;
        }
        button.arq-top-row:first-child { border-top: none; }
        button.arq-top-row:hover { background: var(--color-surface); color: var(--color-ink); }
        .arq-top-main { min-width: 0; flex: 1; }
        .arq-top-name { display: block; font-size: 14px; font-weight: 600; word-break: break-word; }
        .arq-top-sub { display: block; margin-top: 2px; font-size: 12px; color: var(--color-muted); }
        .arq-top-count {
          flex-shrink: 0; min-width: 34px; padding: 3px 10px; border-radius: 999px; text-align: center;
          font-size: 14px; font-weight: 700; background: var(--color-gold-bg); color: var(--color-gold);
        }

        .arq-card { border: 1px solid var(--color-border); border-radius: 12px; padding: 14px; margin-bottom: 14px; background: var(--color-card); }
        .arq-card-top { display: flex; gap: 12px; align-items: flex-start; justify-content: space-between; }
        .arq-main { min-width: 0; flex: 1; }
        a.arq-title { display: block; font-size: 15px; font-weight: 600; word-break: break-word; color: var(--color-ink); }
        a.arq-title:hover { color: var(--color-teal); }
        .arq-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
        .arq-actions { display: flex; flex-direction: column; gap: 8px; flex-shrink: 0; }
        .arq-desc {
          margin: 10px 0 0; padding: 10px 12px; border-radius: 8px; font-size: 13px;
          background: var(--color-surface); white-space: pre-wrap; word-break: break-word;
        }
        .arq-warn {
          margin: 10px 0 0; padding: 8px 10px; border-radius: 8px; font-size: 12px;
          background: var(--color-warning-bg); color: var(--color-warning);
        }
        .arq-meta {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
          gap: 10px 20px; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--color-border);
        }
        .arq-meta-item { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .arq-meta-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--color-muted); }
        .arq-meta-value { font-size: 13px; word-break: break-word; }
        .arq-offers { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--color-border); }
        .arq-offer { padding: 8px 0; border-top: 1px solid var(--color-border); font-size: 13px; }
        .arq-offer:first-of-type { border-top: none; }
        .arq-empty { text-align: center; padding: 32px 16px; border: 1px dashed var(--color-border); border-radius: 12px; color: var(--color-muted); }

        @media (max-width: 600px) {
          .arq-filter { flex-direction: column; align-items: stretch; gap: 0; }
          .arq-filter-label { width: auto; margin-top: 6px; }
          .arq-card-top { flex-wrap: wrap; }
          .arq-actions { flex-direction: row; flex-basis: 100%; }
        }
      `}</style>

      <div className="arq-toolbar">
        <RefreshButton onClick={() => setReloadKey((k) => k + 1)} busy={loading} />
      </div>

      {/* Most requested */}
      <div className="arq-section">
        <h3>Most requested</h3>
        <span className="arq-hint">Tap an item to see its requests</span>
      </div>
      <div className="arq-filter">
        <span className="arq-filter-label">Period</span>
        <Tabs
          options={[
            [7, 'Last 7 days'],
            [30, 'Last 30 days'],
            [90, 'Last 90 days'],
          ]}
          value={topDays}
          onChange={setTopDays}
        />
      </div>
      {topError && <Notice tone="warning">{topError}</Notice>}
      {top && (
        <>
          <div className="arq-stats">
            <div className="arq-stat">
              <p className="arq-stat-label">Requests posted</p>
              <p className="arq-stat-value">{top.totals.requests}</p>
            </div>
            <div className="arq-stat">
              <p className="arq-stat-label">Offers sent</p>
              <p className="arq-stat-value">{top.totals.responses}</p>
            </div>
            <div className="arq-stat">
              <p className="arq-stat-label">Fulfilled</p>
              <p className="arq-stat-value">{top.totals.fulfilled}</p>
            </div>
            <div className="arq-stat">
              <p className="arq-stat-label">Phones / other</p>
              <p className="arq-stat-value">
                {top.categories.phone} / {top.categories.general}
              </p>
            </div>
          </div>

          {top.items.length === 0 ? (
            <p style={{ color: 'var(--color-muted)', fontSize: 13 }}>No requests in this period yet.</p>
          ) : (
            <div className="arq-top">
              {top.items.map((item) => (
                <button key={item.keyword || item.title} type="button" className="arq-top-row" onClick={() => pickItem(item)}>
                  <span className="arq-top-main">
                    <span className="arq-top-name">{item.title}</span>
                    <span className="arq-top-sub">
                      {item.category === 'phone' ? 'Phone' : 'Other item'} · avg budget {money(item.avgBudget)} ·{' '}
                      {item.responses} offer{item.responses === 1 ? '' : 's'}
                      {item.unanswered > 0 ? ` · ${item.unanswered} unanswered` : ''}
                    </span>
                  </span>
                  <span className="arq-top-count">{item.requests}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* List */}
      <div id="arq-list" />
      <div className="arq-section">
        <h3>All requests</h3>
      </div>
      <input
        type="search"
        placeholder="Search title, details, student name or email"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
      />
      <div className="arq-filter">
        <span className="arq-filter-label">Status</span>
        <Tabs
          options={tabs}
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
        />
      </div>

      {keyword && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0 10px', flexWrap: 'wrap' }}>
          <Chip tone="gold">Showing: {keywordLabel}</Chip>
          <button type="button" onClick={clearKeyword} style={btn('outline')}>
            Clear
          </button>
        </div>
      )}

      {notice && <Notice onClose={() => setNotice('')}>{notice}</Notice>}
      {error && <Notice tone="warning">{error}</Notice>}
      {loading && data.requests.length === 0 && <p style={{ color: 'var(--color-muted)' }}>Loading...</p>}

      {!loading && !error && data.requests.length === 0 && (
        <div className="arq-empty">
          {filtersActive ? 'No requests match. Try a different filter or search.' : 'No open requests right now.'}
        </div>
      )}

      {data.requests.map((r) => {
        const open = expanded[r._id];
        return (
          <div key={r._id} className="arq-card">
            <div className="arq-card-top">
              <div className="arq-main">
                <Link to={`/requests/${r._id}`} className="arq-title">
                  {r.title}
                </Link>
                <div className="arq-chips">
                  <Chip tone={STATUS_TONE[r.effectiveStatus] || 'muted'}>{STATUS_LABEL[r.effectiveStatus] || r.effectiveStatus}</Chip>
                  <Chip tone="muted">{r.category === 'phone' ? 'Phone' : 'Other item'}</Chip>
                  <Chip tone={r.responseCount > 0 ? 'gold' : 'muted'}>
                    {r.responseCount} offer{r.responseCount === 1 ? '' : 's'}
                  </Chip>
                  {r.effectiveStatus === 'open' && r.responseCount === 0 && <Chip tone="warning">Unanswered</Chip>}
                  {r.buyer && r.buyer.isBanned && <Chip tone="warning">Poster banned</Chip>}
                </div>
              </div>
              <div className="arq-actions">
                <button type="button" onClick={() => toggleOffers(r)} style={btn('outline', { minWidth: 96 })}>
                  {open ? 'Hide offers' : 'View offers'}
                </button>
                {r.status === 'removed' ? (
                  <button type="button" onClick={() => restoreDialog(r)} style={btn('primary', { minWidth: 96 })}>
                    Restore
                  </button>
                ) : (
                  <button type="button" onClick={() => removeDialog(r)} style={btn('danger', { minWidth: 96 })}>
                    Remove
                  </button>
                )}
              </div>
            </div>

            {r.description && <p className="arq-desc">{r.description}</p>}
            {r.status === 'removed' && r.removedReason && (
              <p className="arq-warn">Removed: {r.removedReason}</p>
            )}

            <div className="arq-meta">
              <MetaItem label="Posted by">
                {r.buyer ? `${r.buyer.fullName} (${r.buyer.email})` : 'Deleted user'}
              </MetaItem>
              {r.buyer && <MetaItem label="Trust score">{r.buyer.trustScore}</MetaItem>}
              <MetaItem label="Budget">{money(r.budget)}</MetaItem>
              <MetaItem label="Posted">{fmtDate(r.createdAt)}</MetaItem>
              <MetaItem label="Expires">{fmtDate(r.expiresAt)}</MetaItem>
            </div>

            {open && (
              <div className="arq-offers">
                {open.loading && <span style={{ fontSize: 13, color: 'var(--color-muted)' }}>Loading offers...</span>}
                {open.error && <span style={{ fontSize: 13, color: 'var(--color-warning)' }}>{open.error}</span>}
                {!open.loading && !open.error && open.responses.length === 0 && (
                  <span style={{ fontSize: 13, color: 'var(--color-muted)' }}>No offers on this request.</span>
                )}
                {open.responses.map((x) => (
                  <div key={x._id} className="arq-offer">
                    <strong>{x.seller ? x.seller.fullName : 'Deleted user'}</strong>
                    {x.seller ? ` (trust ${x.seller.trustScore})` : ''} offered{' '}
                    {x.listing ? (
                      <Link to={`/listings/${x.listing._id}`}>
                        {x.listing.title} · {money(x.listing.price)}
                      </Link>
                    ) : (
                      'a deleted listing'
                    )}
                    {x.note && <div style={{ color: 'var(--color-muted)', marginTop: 2 }}>{x.note}</div>}
                    <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>{fmtDate(x.createdAt)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <Pager page={page} pages={data.pages} onPage={setPage} />

      {dialog && <ConfirmDialog {...dialog} onCancel={() => setDialog(null)} />}
    </PageShell>
  );
}