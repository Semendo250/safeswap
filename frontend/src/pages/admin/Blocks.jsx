import { useEffect, useState } from 'react';
import { getBlocks } from '../../api/admin.api';
import { PageShell, Chip, Pager, Notice, Tabs, errText, fmtDate } from '../../components/admin/AdminUi';

function MetaItem({ label, children }) {
  return (
    <div className="blk-meta-item">
      <span className="blk-meta-label">{label}</span>
      <span className="blk-meta-value">{children}</span>
    </div>
  );
}

export default function Blocks() {
  const [view, setView] = useState('multi');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], counts: {}, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    getBlocks({ view, page })
      .then((res) => {
        if (!cancelled) setData(res.data);
      })
      .catch((err) => {
        if (!cancelled) setError(errText(err, 'Could not load blocks.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [view, page]);

  const counts = data.counts || {};
  const tabs = [
    ['multi', `Blocked by 3+ people (${counts.multi || 0})`],
    ['all', `Everyone blocked (${counts.all || 0})`],
    ['recent', `Recent blocks (${counts.recent || 0})`],
  ];

  return (
    <PageShell
      title="Blocks"
      subtitle="Students block people who bother them. A user blocked by many people is often a harassment signal. View only: find them on the Users page to message or ban."
    >
      <style>{`
        .blk-filter { display: flex; align-items: center; gap: 10px; }
        .blk-filter-label {
          width: 52px; flex-shrink: 0; font-size: 11px; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.04em; color: var(--color-muted);
        }
        .blk-filter > div:last-child { min-width: 0; flex: 1; }

        .blk-card {
          border: 1px solid var(--color-border); border-radius: 12px; padding: 14px;
          margin-bottom: 14px; background: var(--color-card);
        }
        .blk-top { display: flex; gap: 12px; align-items: flex-start; justify-content: space-between; }
        .blk-name { font-size: 15px; font-weight: 600; word-break: break-word; }
        .blk-email { margin: 2px 0 0; font-size: 12px; color: var(--color-muted); word-break: break-all; }
        .blk-chips { display: flex; flex-wrap: wrap; gap: 6px; justify-content: flex-end; flex-shrink: 0; }

        .blk-meta {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 10px 20px; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--color-border);
        }
        .blk-meta-item { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .blk-meta-label {
          font-size: 11px; font-weight: 600; text-transform: uppercase;
          letter-spacing: 0.04em; color: var(--color-muted);
        }
        .blk-meta-value { font-size: 13px; color: var(--color-ink); word-break: break-word; }

        .blk-empty {
          text-align: center; padding: 32px 16px; border: 1px dashed var(--color-border);
          border-radius: 12px; color: var(--color-muted);
        }
        .blk-empty-icon { font-size: 30px; margin-bottom: 6px; }
        .blk-empty-title { margin: 0 0 4px; font-size: 14px; font-weight: 600; color: var(--color-ink); }
        .blk-empty-text { margin: 0; font-size: 13px; }

        @media (max-width: 600px) {
          .blk-filter { flex-direction: column; align-items: stretch; gap: 0; }
          .blk-filter-label { width: auto; margin-top: 6px; }
          .blk-top { flex-wrap: wrap; }
          .blk-chips { justify-content: flex-start; }
        }
      `}</style>

      <div className="blk-filter">
        <span className="blk-filter-label">Show</span>
        <Tabs
          options={tabs}
          value={view}
          onChange={(v) => {
            setView(v);
            setPage(1);
          }}
        />
      </div>

      {error && <Notice tone="warning">{error}</Notice>}
      {loading && data.items.length === 0 && <p style={{ color: 'var(--color-muted)' }}>Loading...</p>}

      {!loading && !error && data.items.length === 0 && (
        <div className="blk-empty">
          <div className="blk-empty-icon">🚫</div>
          <p className="blk-empty-title">{view === 'multi' ? 'Nobody is blocked by 3 or more people' : 'No blocks yet'}</p>
          <p className="blk-empty-text">Blocks made in chat will be listed here.</p>
        </div>
      )}

      {view === 'recent'
        ? data.items.map((b) => (
            <div key={b._id} className="blk-card">
              <div className="blk-top">
                <span className="blk-name">
                  {b.blockerName} blocked {b.blockedName}
                </span>
                <span style={{ fontSize: 12, color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>{fmtDate(b.createdAt)}</span>
              </div>
            </div>
          ))
        : data.items.map((u) => (
            <div key={u.userId} className="blk-card">
              <div className="blk-top">
                <div style={{ minWidth: 0 }}>
                  <div className="blk-name">{u.name}</div>
                  {u.email && <div className="blk-email">{u.email}</div>}
                </div>
                <div className="blk-chips">
                  {u.isBanned && <Chip tone="warning">Banned</Chip>}
                  <Chip tone={u.count >= 3 ? 'warning' : 'muted'}>
                    Blocked by {u.count}
                  </Chip>
                </div>
              </div>
              <div className="blk-meta">
                <MetaItem label="Blocked by">
                  {u.blockers.join(', ')}
                  {u.more > 0 ? ` and ${u.more} more` : ''}
                </MetaItem>
                <MetaItem label="Last blocked">{fmtDate(u.last)}</MetaItem>
              </div>
            </div>
          ))}

      <Pager page={page} pages={data.pages} onPage={setPage} />
    </PageShell>
  );
}