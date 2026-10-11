import { useState, useEffect } from 'react';
import {
  getBlacklist,
  addBlacklistImei,
  bulkAddBlacklist,
  removeBlacklistImei,
} from '../../api/admin.api';
import {
  PageShell,
  Chip,
  Pager,
  Notice,
  Tabs,
  Field,
  ConfirmDialog,
  CopyText,
  btn,
  errText,
  fmtDate,
  useDebounced,
} from '../../components/admin/AdminUi';

const SOURCE_LABEL = {
  manual: 'Added by admin',
  police_report: 'Police report',
  user_report: 'User report',
  other: 'Other',
  simulated: 'Simulated',
};

const SOURCE_TABS = [
  ['all', 'All'],
  ['manual', 'Admin'],
  ['police_report', 'Police'],
  ['user_report', 'User report'],
  ['other', 'Other'],
];

const MODE_TABS = [
  ['single', 'Add one'],
  ['bulk', 'Add many'],
];

const box = {
  border: '1px solid var(--color-border)',
  borderRadius: 10,
  padding: 12,
  background: 'var(--color-card)',
  marginBottom: 10,
};

function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function effectText(d) {
  if (!d.flaggedListings) return '';
  const pulled = d.pulledListings ? `, ${plural(d.pulledListings, 'live listing')} pulled back to review` : '';
  return ` ${plural(d.flaggedListings, 'existing listing')} with this IMEI marked blacklisted${pulled}.`;
}

export default function BlacklistManager() {
  const [mode, setMode] = useState('single');
  const [imei, setImei] = useState('');
  const [text, setText] = useState('');
  const [reason, setReason] = useState('');
  const [source, setSource] = useState('manual');
  const [busy, setBusy] = useState(false);
  const [invalidList, setInvalidList] = useState([]);

  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const [sourceFilter, setSourceFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [data, setData] = useState({ entries: [], total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [dialog, setDialog] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    getBlacklist({ search: debounced, source: sourceFilter, page })
      .then((res) => {
        if (!cancelled) setData(res.data);
      })
      .catch((err) => {
        if (!cancelled) setError(errText(err, 'Could not load the blacklist.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debounced, sourceFilter, page, reloadKey]);

  function reload() {
    setReloadKey((k) => k + 1);
  }

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    setInvalidList([]);
    try {
      if (mode === 'single') {
        const res = await addBlacklistImei(imei.trim(), reason.trim(), source);
        setNotice(`IMEI added.${effectText(res.data)}`);
        setImei('');
      } else {
        const res = await bulkAddBlacklist(text, reason.trim(), source);
        const d = res.data;
        const parts = [`${plural(d.added, 'IMEI')} added`];
        if (d.duplicateCount) parts.push(`${d.duplicateCount} already on the list`);
        if (d.invalidCount) parts.push(`${d.invalidCount} invalid`);
        setNotice(`${parts.join(', ')}.${effectText(d)}`);
        setInvalidList(d.invalid || []);
        setText('');
      }
      setReason('');
      setPage(1);
      reload();
    } catch (err) {
      setError(errText(err, 'Could not add.'));
    } finally {
      setBusy(false);
    }
  }

  function askRemove(entry) {
    setDialog({
      title: 'Remove from blacklist?',
      message: `IMEI ${entry.imei} will no longer be blocked. Listings that were marked blacklisted because of it go back to clean.`,
      confirmLabel: 'Remove',
      danger: true,
      onConfirm: async () => {
        await removeBlacklistImei(entry._id);
        setDialog(null);
        setNotice('Removed from the blacklist.');
        reload();
      },
    });
  }

  return (
    <PageShell
      title="IMEI blacklist"
      subtitle={`${plural(data.total, 'IMEI')} blocked. Simulated registry for demo purposes.`}
    >
      <form onSubmit={submit} style={box}>
        <Tabs options={MODE_TABS} value={mode} onChange={setMode} />

        {mode === 'single' ? (
          <input
            placeholder="15-digit IMEI"
            value={imei}
            onChange={(e) => setImei(e.target.value.replace(/\D/g, ''))}
            maxLength={15}
            inputMode="numeric"
            style={{ marginBottom: 8 }}
          />
        ) : (
          <textarea
            rows={5}
            placeholder="Paste IMEIs separated by new lines, spaces or commas (up to 500)"
            value={text}
            onChange={(e) => setText(e.target.value)}
            style={{ marginBottom: 8 }}
          />
        )}

        <input
          placeholder="Reason (optional), e.g. stolen at campus gate"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={200}
          style={{ marginBottom: 8 }}
        />

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={source} onChange={(e) => setSource(e.target.value)} style={{ width: 'auto' }}>
            <option value="manual">Source: Added by admin</option>
            <option value="police_report">Source: Police report</option>
            <option value="user_report">Source: User report</option>
            <option value="other">Source: Other</option>
          </select>
          <button
            type="submit"
            disabled={busy || (mode === 'single' ? imei.length !== 15 : !text.trim())}
            style={btn('primary', { padding: '9px 16px' })}
          >
            {busy ? 'Adding...' : mode === 'single' ? 'Add to blacklist' : 'Add all'}
          </button>
        </div>
      </form>

      {notice && <Notice onClose={() => setNotice('')}>{notice}</Notice>}
      {error && <Notice tone="warning">{error}</Notice>}
      {invalidList.length > 0 && (
        <p style={{ fontSize: 12, color: 'var(--color-muted)', wordBreak: 'break-all', margin: '0 0 10px' }}>
          Skipped as invalid (not 15 digits or fails the checksum): {invalidList.join(', ')}
        </p>
      )}

      <input
        type="search"
        placeholder="Search IMEI or reason"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
      />
      <Tabs
        options={SOURCE_TABS}
        value={sourceFilter}
        onChange={(v) => {
          setSourceFilter(v);
          setPage(1);
        }}
      />

      {loading && data.entries.length === 0 && <p style={{ color: 'var(--color-muted)' }}>Loading...</p>}
      {!loading && !error && data.entries.length === 0 && (
        <p style={{ color: 'var(--color-muted)' }}>No blacklisted IMEIs match.</p>
      )}

      {data.entries.map((entry) => (
        <div key={entry._id} style={box}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
            <div style={{ minWidth: 0 }}>
              <strong style={{ fontSize: 15 }}>
                <CopyText value={entry.imei} />
              </strong>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                <Chip tone="muted">{SOURCE_LABEL[entry.source] || entry.source}</Chip>
                {entry.listingCount > 0 && (
                  <Chip tone="warning">Used on {plural(entry.listingCount, 'listing')}</Chip>
                )}
              </div>
            </div>
            <button type="button" onClick={() => askRemove(entry)} style={btn('danger')}>
              Remove
            </button>
          </div>
          {entry.reason && <Field label="Reason">{entry.reason}</Field>}
          <Field label="Added">
            {fmtDate(entry.createdAt)}
            {entry.addedBy && entry.addedBy.fullName ? ` by ${entry.addedBy.fullName}` : ''}
          </Field>
        </div>
      ))}

      <Pager page={page} pages={data.pages} onPage={setPage} />

      {dialog && <ConfirmDialog {...dialog} onCancel={() => setDialog(null)} />}
    </PageShell>
  );
}