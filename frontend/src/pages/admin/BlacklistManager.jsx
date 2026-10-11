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
  ConfirmDialog,
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

function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function effectText(d) {
  if (!d.flaggedListings) return '';
  const pulled = d.pulledListings ? `, ${plural(d.pulledListings, 'live listing')} pulled back to review` : '';
  return ` ${plural(d.flaggedListings, 'existing listing')} with this IMEI marked blacklisted${pulled}.`;
}

// A value with a quiet "Copy" link next to it (long-press copying is switched off app-wide)
function CopyValue({ value }) {
  const [copied, setCopied] = useState(false);
  if (!value) return <span style={{ color: 'var(--color-muted)' }}>-</span>;

  async function copy() {
    try {
      await navigator.clipboard.writeText(String(value));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      // clipboard blocked by the browser
    }
  }

  return (
    <span className="bl-copywrap">
      <span className="bl-mono">{value}</span>
      <button type="button" className="bl-copy" onClick={copy}>
        {copied ? 'Copied' : 'Copy'}
      </button>
    </span>
  );
}

function MetaItem({ label, children, wide = false }) {
  return (
    <div className={wide ? 'bl-meta-item bl-wide' : 'bl-meta-item'}>
      <span className="bl-meta-label">{label}</span>
      <span className="bl-meta-value">{children}</span>
    </div>
  );
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

  const submitDisabled = busy || (mode === 'single' ? imei.length !== 15 : !text.trim());
  const hasFilters = !!debounced.trim() || sourceFilter !== 'all';

  return (
    <PageShell
      title="IMEI blacklist"
      subtitle={`${plural(data.total, 'IMEI')} blocked. Simulated registry for demo purposes.`}
    >
      <style>{`
        .bl-card {
          border: 1px solid var(--color-border); border-radius: 12px; padding: 16px;
          background: var(--color-card); margin-bottom: 14px;
        }
        .bl-section-label {
          margin-bottom: 12px; font-size: 12px; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.04em; color: var(--color-teal);
        }
        .bl-modes { display: flex; gap: 6px; margin-bottom: 14px; }

        .bl-fields { display: grid; grid-template-columns: 230px 1fr; gap: 10px; align-items: start; }
        .bl-hint { margin-top: 4px; font-size: 11px; color: var(--color-muted); }
        .bl-hint.bl-ready { color: var(--color-success); font-weight: 600; }

        .bl-row { display: flex; align-items: center; gap: 10px; margin-top: 12px; }
        .bl-row select { width: auto; flex: 1 1 auto; max-width: 280px; min-height: 40px; }
        button.bl-submit {
          min-width: 140px; height: 40px; padding: 0 20px; align-self: auto; margin-left: auto;
          background: var(--color-primary); border: 1px solid var(--color-primary); color: #fff;
        }
        button.bl-submit:hover:not(:disabled) {
          background: var(--color-primary-dark); border-color: var(--color-primary-dark);
        }
        button.bl-submit:disabled {
          opacity: 1; cursor: not-allowed; background: var(--color-surface);
          border: 1px solid var(--color-border); color: var(--color-muted);
        }

        .bl-list-head { display: flex; align-items: baseline; gap: 8px; margin: 18px 0 10px; }
        .bl-list-head h3 { margin: 0; font-size: 16px; }
        .bl-list-count { font-size: 13px; color: var(--color-muted); }

        .bl-filter { display: flex; align-items: center; gap: 10px; }
        .bl-filter-label {
          width: 52px; flex-shrink: 0; font-size: 11px; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.04em; color: var(--color-muted);
        }
        .bl-filter > div:last-child { min-width: 0; flex: 1; }

        .bl-entry {
          border: 1px solid var(--color-border); border-radius: 12px; padding: 14px;
          margin-bottom: 14px; background: var(--color-card);
        }
        .bl-top { display: flex; gap: 12px; align-items: flex-start; justify-content: space-between; }
        .bl-main { min-width: 0; flex: 1; }
        .bl-imei { font-size: 15px; font-weight: 700; }

        .bl-meta {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 10px 20px; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--color-border);
        }
        .bl-meta-item { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .bl-meta-item.bl-wide { grid-column: 1 / -1; }
        .bl-meta-label {
          font-size: 11px; font-weight: 600; text-transform: uppercase;
          letter-spacing: 0.04em; color: var(--color-muted);
        }
        .bl-meta-value { font-size: 13px; color: var(--color-ink); word-break: break-word; }

        .bl-copywrap { display: inline-flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
        .bl-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; letter-spacing: 0.02em; }
        button.bl-copy {
          min-width: 0; padding: 0 2px; border: none; background: transparent; color: var(--color-teal);
          font-size: 11px; font-weight: 600; cursor: pointer; align-self: auto;
        }
        button.bl-copy:hover { background: transparent; color: var(--color-teal); text-decoration: underline; }

        .bl-empty {
          text-align: center; padding: 32px 16px; border: 1px dashed var(--color-border);
          border-radius: 12px; color: var(--color-muted);
        }
        .bl-empty-icon { font-size: 30px; margin-bottom: 6px; }
        .bl-empty-title { margin: 0 0 4px; font-size: 14px; font-weight: 600; color: var(--color-ink); }
        .bl-empty-text { margin: 0; font-size: 13px; }

        @media (max-width: 600px) {
          .bl-fields { grid-template-columns: 1fr; }
          .bl-row { flex-direction: column; align-items: stretch; }
          .bl-row select { max-width: none; }
          button.bl-submit { width: 100%; margin-left: 0; }
          .bl-filter { flex-direction: column; align-items: stretch; gap: 0; }
          .bl-filter-label { width: auto; margin-top: 6px; }
        }
      `}</style>

      <form onSubmit={submit} className="bl-card">
        <div className="bl-section-label">Add to blacklist</div>

        <div className="bl-modes">
          {MODE_TABS.map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setMode(v)}
              style={btn(mode === v ? 'primary' : 'outline', { borderRadius: 999, whiteSpace: 'nowrap' })}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === 'single' ? (
          <div className="bl-fields">
            <div>
              <input
                placeholder="15-digit IMEI"
                value={imei}
                onChange={(e) => setImei(e.target.value.replace(/\D/g, ''))}
                maxLength={15}
                inputMode="numeric"
              />
              <div className={imei.length === 15 ? 'bl-hint bl-ready' : 'bl-hint'}>
                {imei.length === 15 ? 'Ready to add' : `${imei.length}/15 digits`}
              </div>
            </div>
            <input
              placeholder="Reason (optional), e.g. stolen at campus gate"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={200}
            />
          </div>
        ) : (
          <>
            <textarea
              rows={5}
              placeholder="Paste IMEIs separated by new lines, spaces or commas (up to 500)"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <input
              placeholder="Reason (optional), e.g. stolen at campus gate"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={200}
              style={{ marginTop: 10 }}
            />
          </>
        )}

        <div className="bl-row">
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="manual">Source: Added by admin</option>
            <option value="police_report">Source: Police report</option>
            <option value="user_report">Source: User report</option>
            <option value="other">Source: Other</option>
          </select>
          <button type="submit" className="bl-submit" disabled={submitDisabled}>
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

      <div className="bl-list-head">
        <h3>Blocked IMEIs</h3>
        <span className="bl-list-count">{data.total}</span>
      </div>

      <input
        type="search"
        placeholder="Search IMEI or reason"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
      />

      <div className="bl-filter">
        <span className="bl-filter-label">Source</span>
        <Tabs
          options={SOURCE_TABS}
          value={sourceFilter}
          onChange={(v) => {
            setSourceFilter(v);
            setPage(1);
          }}
        />
      </div>

      {loading && data.entries.length === 0 && <p style={{ color: 'var(--color-muted)' }}>Loading...</p>}

      {!loading && !error && data.entries.length === 0 && (
        <div className="bl-empty">
          <div className="bl-empty-icon">🛡️</div>
          <p className="bl-empty-title">{hasFilters ? 'No blacklisted IMEIs match' : 'No blocked IMEIs yet'}</p>
          <p className="bl-empty-text">
            {hasFilters ? 'Try a different search or source.' : 'Add one above to start blocking stolen phones.'}
          </p>
        </div>
      )}

      {data.entries.map((entry) => (
        <div key={entry._id} className="bl-entry">
          <div className="bl-top">
            <div className="bl-main">
              <div className="bl-imei">
                <CopyValue value={entry.imei} />
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
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

          <div className="bl-meta">
            {entry.reason && (
              <MetaItem label="Reason" wide>
                {entry.reason}
              </MetaItem>
            )}
            <MetaItem label="Added">
              {fmtDate(entry.createdAt)}
              {entry.addedBy && entry.addedBy.fullName ? ` by ${entry.addedBy.fullName}` : ''}
            </MetaItem>
          </div>
        </div>
      ))}

      <Pager page={page} pages={data.pages} onPage={setPage} />

      {dialog && <ConfirmDialog {...dialog} onCancel={() => setDialog(null)} />}
    </PageShell>
  );
}