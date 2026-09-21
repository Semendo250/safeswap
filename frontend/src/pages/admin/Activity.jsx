import { useEffect, useState } from 'react';
import { getAuditLog } from '../../api/admin.api';
import { PageShell, Chip, Pager, Notice, errText, fmtDate } from '../../components/admin/AdminUi';

export default function Activity() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ entries: [], total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    getAuditLog({ page })
      .then((res) => {
        if (!cancelled) setData(res.data);
      })
      .catch((err) => {
        if (!cancelled) setError(errText(err, 'Could not load the activity log.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page]);

  return (
    <PageShell title="Activity log" subtitle="Everything admins have changed, newest first">
      {error && <Notice tone="warning">{error}</Notice>}
      {loading && data.entries.length === 0 && <p style={{ color: 'var(--color-muted)' }}>Loading...</p>}
      {!loading && !error && data.entries.length === 0 && <p style={{ color: 'var(--color-muted)' }}>Nothing recorded yet.</p>}

      {data.entries.map((e) => (
        <div
          key={e._id}
          style={{ border: '1px solid var(--color-border)', borderRadius: 10, padding: 12, marginBottom: 8, background: '#fff' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginBottom: 4 }}>
            <Chip tone="teal">{e.action}</Chip>
            <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>{fmtDate(e.createdAt)}</span>
          </div>
          <p style={{ margin: '4px 0', fontSize: 14, wordBreak: 'break-word' }}>{e.summary}</p>
          {e.reason && (
            <p style={{ margin: '2px 0', fontSize: 13, color: 'var(--color-muted)', wordBreak: 'break-word' }}>
              Reason: {e.reason}
            </p>
          )}
          <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--color-muted)' }}>By {e.adminName || 'admin'}</p>
        </div>
      ))}

      <Pager page={page} pages={data.pages} onPage={setPage} />
    </PageShell>
  );
}