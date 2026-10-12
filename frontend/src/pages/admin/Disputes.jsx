import { useEffect, useState } from 'react';
import {
  getDisputes,
  createDispute,
  updateDispute,
  addDisputeNote,
  getAdminList,
} from '../../api/admin.api';
import {
  getDisputes,
  createDispute,
  updateDispute,
  addDisputeNote,
  deleteDispute,
  getAdminList,
} from '../../api/admin.api';

const STATUS_TABS = [
  ['all', 'All'],
  ['open', 'Open'],
  ['in_progress', 'In progress'],
  ['resolved', 'Resolved'],
  ['closed', 'Closed'],
];
const SOURCE_TABS = [
  ['all', 'All sources'],
  ['whatsapp', 'WhatsApp'],
  ['email', 'Email'],
  ['in_app', 'In-app'],
  ['other', 'Other'],
];
const ASSIGN_TABS = [
  ['all', 'Everyone'],
  ['me', 'Mine'],
  ['unassigned', 'Unassigned'],
];

const STATUS_LABEL = { open: 'Open', in_progress: 'In progress', resolved: 'Resolved', closed: 'Closed' };
const STATUS_TONE = { open: 'gold', in_progress: 'teal', resolved: 'success', closed: 'muted' };
const PRIORITY_LABEL = { low: 'Low', normal: 'Normal', high: 'High' };
const SOURCE_LABEL = { whatsapp: 'WhatsApp', email: 'Email', in_app: 'In-app', other: 'Other' };

const miniLabel = { fontSize: 11, color: 'var(--color-muted)', display: 'block', marginBottom: 2 };

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
    <span className="dsp-copywrap">
      <span className="dsp-copytext">{value}</span>
      <button type="button" className="dsp-copy" onClick={copy}>
        {copied ? 'Copied' : 'Copy'}
      </button>
    </span>
  );
}

function MetaItem({ label, children, wide = false }) {
  return (
    <div className={wide ? 'dsp-meta-item dsp-wide' : 'dsp-meta-item'}>
      <span className="dsp-meta-label">{label}</span>
      <span className="dsp-meta-value">{children}</span>
    </div>
  );
}

// ---------- log a complaint ----------

function CreateModal({ admins, onClose, onCreated }) {
  const [form, setForm] = useState({
    source: 'whatsapp',
    subject: '',
    details: '',
    contactName: '',
    contactInfo: '',
    userEmail: '',
    priority: 'normal',
    assignedTo: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function set(key) {
    return (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await createDispute(form);
      onCreated(res.data.dispute);
    } catch (err) {
      setError(errText(err, 'Could not save the complaint.'));
      setBusy(false);
    }
  }

  return (
    <Modal title="Log a complaint" onClose={onClose} busy={busy}>
      <form onSubmit={submit}>
        <label style={miniLabel}>Where did it come from?</label>
        <select value={form.source} onChange={set('source')} style={{ marginBottom: 8 }}>
          <option value="whatsapp">WhatsApp</option>
          <option value="email">Email</option>
          <option value="in_app">In-app</option>
          <option value="other">Other</option>
        </select>
        <input placeholder="Subject" value={form.subject} maxLength={120} onChange={set('subject')} style={{ marginBottom: 8 }} />
        <textarea rows={4} placeholder="What happened?" value={form.details} maxLength={2000} onChange={set('details')} style={{ marginBottom: 8 }} />
        <input placeholder="Their name (optional)" value={form.contactName} maxLength={80} onChange={set('contactName')} style={{ marginBottom: 8 }} />
        <input placeholder="Phone or email they used (optional)" value={form.contactInfo} maxLength={120} onChange={set('contactInfo')} style={{ marginBottom: 8 }} />
        <input placeholder="SafeSwap account email, to link them (optional)" value={form.userEmail} onChange={set('userEmail')} style={{ marginBottom: 8 }} />

        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <div style={{ flex: 1 }}>
            <label style={miniLabel}>Priority</label>
            <select value={form.priority} onChange={set('priority')}>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={miniLabel}>Assign to</label>
            <select value={form.assignedTo} onChange={set('assignedTo')}>
              <option value="">Nobody yet</option>
              {admins.map((a) => (
                <option key={a._id} value={a._id}>
                  {a.fullName}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && <p style={{ color: 'var(--color-warning)', fontSize: 13, margin: '0 0 10px' }}>{error}</p>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} disabled={busy} style={btn('outline', { padding: '9px 16px' })}>
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || form.subject.trim().length < 3}
            style={btn('primary', { padding: '9px 16px' })}
          >
            {busy ? 'Saving...' : 'Save complaint'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ---------- one complaint ----------

function DisputeCard({ d, admins, onStatus, onAssign, onPriority, onNote, onDelete }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const notes = d.notes || [];

  const hasMeta = d.contactName || d.contactInfo || d.user || d.resolution || d.resolvedAt;

  async function submitNote() {
    const text = note.trim();
    if (!text || busy) return;
    setBusy(true);
    const ok = await onNote(d, text);
    if (ok) setNote('');
    setBusy(false);
  }

  return (
    <div className="dsp-card">
      <div className="dsp-head">
        <div className="dsp-chips">
          <strong className="dsp-ref">{d.ref}</strong>
          <Chip tone={STATUS_TONE[d.status]}>{STATUS_LABEL[d.status]}</Chip>
          <Chip tone="teal">{SOURCE_LABEL[d.source] || d.source}</Chip>
          {d.priority === 'high' && <Chip tone="warning">High priority</Chip>}
          {d.priority === 'low' && <Chip tone="muted">Low priority</Chip>}
        </div>
        <span className="dsp-date">{fmtDate(d.createdAt)}</span>
      </div>

      <strong className="dsp-subject">{d.subject}</strong>
      {d.details && <p className="dsp-details">{d.details}</p>}

      {hasMeta && (
        <div className="dsp-meta">
          {d.contactName && <MetaItem label="From">{d.contactName}</MetaItem>}
          {d.contactInfo && (
            <MetaItem label="Contact">
              <CopyValue value={d.contactInfo} />
            </MetaItem>
          )}
          {d.user && (
            <MetaItem label="Account">
              {d.user.fullName} ({d.user.email})
            </MetaItem>
          )}
          {d.resolvedAt && <MetaItem label="Closed">{fmtDate(d.resolvedAt)}</MetaItem>}
          {d.resolution && (
            <MetaItem label="Resolution" wide>
              {d.resolution}
            </MetaItem>
          )}
        </div>
      )}

      <div className="dsp-controls">
        <div className="dsp-control">
          <label className="dsp-meta-label">Status</label>
          <select className="dsp-select" value={d.status} onChange={(e) => onStatus(d, e.target.value)}>
            {Object.keys(STATUS_LABEL).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="dsp-control">
          <label className="dsp-meta-label">Assigned to</label>
          <select
            className="dsp-select"
            value={d.assignedTo ? d.assignedTo._id : ''}
            onChange={(e) => onAssign(d, e.target.value)}
          >
            <option value="">Nobody</option>
            {admins.map((a) => (
              <option key={a._id} value={a._id}>
                {a.fullName}
              </option>
            ))}
          </select>
        </div>
        <div className="dsp-control">
          <label className="dsp-meta-label">Priority</label>
          <select className="dsp-select" value={d.priority} onChange={(e) => onPriority(d, e.target.value)}>
            {Object.keys(PRIORITY_LABEL).map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </select>
        </div>
      </div>

            <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => setShowNotes((v) => !v)} style={btn('outline')}>
          {showNotes ? 'Hide notes' : `Notes (${notes.length})`}
        </button>
        {(d.status === 'resolved' || d.status === 'closed') && (
          <button type="button" onClick={() => onDelete(d)} style={btn('danger')}>
            Delete
          </button>
        )}
      </div>

      {showNotes && (
        <div className="dsp-notes">
          {notes.length === 0 && (
            <p style={{ fontSize: 13, color: 'var(--color-muted)', margin: '0 0 8px' }}>No notes yet.</p>
          )}
          {notes.map((n, i) => (
            <div key={n._id} className={i === 0 ? 'dsp-note dsp-note-first' : 'dsp-note'}>
              <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>
                {n.adminName || 'Admin'} on {fmtDate(n.createdAt)}
              </div>
              <div style={{ fontSize: 13, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{n.text}</div>
            </div>
          ))}
          <textarea
            rows={2}
            placeholder="Add a note (only admins see this)"
            value={note}
            maxLength={1000}
            onChange={(e) => setNote(e.target.value)}
            style={{ margin: '8px 0' }}
          />
          <button type="button" onClick={submitNote} disabled={busy || !note.trim()} style={btn('primary')}>
            {busy ? 'Saving...' : 'Add note'}
          </button>
        </div>
      )}
    </div>
  );
}

// ---------- page ----------

export default function Disputes() {
  const [status, setStatus] = useState('open');
  const [source, setSource] = useState('all');
  const [assigned, setAssigned] = useState('all');
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);

  const [data, setData] = useState({ disputes: [], counts: {}, total: 0, pages: 1 });
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [dialog, setDialog] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    getAdminList()
      .then((res) => setAdmins(res.data.admins || []))
      .catch(() => setAdmins([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    getDisputes({ status, source, assigned, search: debounced, page })
      .then((res) => {
        if (!cancelled) setData(res.data);
      })
      .catch((err) => {
        if (!cancelled) setError(errText(err, 'Could not load complaints.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [status, source, assigned, debounced, page, reloadKey]);

  function reload() {
    setReloadKey((k) => k + 1);
  }

  async function patch(d, body, okMessage) {
    setError('');
    try {
      await updateDispute(d._id, body);
      if (okMessage) setNotice(okMessage);
      reload();
    } catch (err) {
      setError(errText(err, 'Could not update the complaint.'));
      reload();
    }
  }

  function changeStatus(d, next) {
    if (next === d.status) return;
    const closing = next === 'resolved' || next === 'closed';
    if (closing && !(d.resolution || '').trim()) {
      setDialog({
        title: `Mark ${d.ref} as ${STATUS_LABEL[next].toLowerCase()}?`,
        message: 'Write how it was resolved. If the complaint is linked to a user account, they will see this in their notification.',
        confirmLabel: `Mark ${STATUS_LABEL[next].toLowerCase()}`,
        askReason: 'required',
        onConfirm: async (resolution) => {
          await updateDispute(d._id, { status: next, resolution });
          setDialog(null);
          setNotice(`${d.ref} marked ${STATUS_LABEL[next].toLowerCase()}.`);
          reload();
        },
      });
      return;
    }
    patch(d, { status: next }, `${d.ref} is now ${STATUS_LABEL[next].toLowerCase()}.`);
  }

  function changeAssign(d, adminId) {
    patch(d, { assignedTo: adminId }, adminId ? `${d.ref} assigned.` : `${d.ref} unassigned.`);
  }

  function changePriority(d, priority) {
    patch(d, { priority });
  }
    function askDelete(d) {
    setDialog({
      title: `Delete ${d.ref}?`,
      message: 'This removes the complaint and its notes for good. The reference, subject and your reason stay in the activity log.',
      confirmLabel: 'Delete complaint',
      danger: true,
      askReason: 'required',
      onConfirm: async (reason) => {
        await deleteDispute(d._id, reason);
        setDialog(null);
        setNotice(`${d.ref} was deleted.`);
        reload();
      },
    });
  }

  async function addNote(d, text) {
    setError('');
    try {
      await addDisputeNote(d._id, text);
      reload();
      return true;
    } catch (err) {
      setError(errText(err, 'Could not save the note.'));
      return false;
    }
  }

  const counts = data.counts || {};
  const totalAll = Object.values(counts).reduce((a, b) => a + b, 0);
  const filtersActive = !!debounced.trim() || source !== 'all' || assigned !== 'all';

  // What the empty state should say
  let emptyTitle = 'No complaints match';
  let emptyText = 'Try a different filter or search.';
  let canShowAll = false;
  if (!filtersActive && totalAll === 0) {
    emptyTitle = 'No complaints yet';
    emptyText = 'Log one with the button above.';
  } else if (!filtersActive && status !== 'all') {
    emptyTitle = `No ${STATUS_LABEL[status].toLowerCase()} complaints`;
    emptyText = 'Nothing here right now.';
    canShowAll = totalAll > 0;
  }

  return (
    <PageShell title="Complaints" subtitle="Log and follow up complaints from WhatsApp, email and the app.">
      <style>{`
        .dsp-toolbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .dsp-toolbar input[type="search"] { flex: 1; min-width: 180px; height: 40px; }

        .dsp-filter { display: flex; align-items: center; gap: 10px; }
        .dsp-filter-label {
          width: 52px; flex-shrink: 0; font-size: 11px; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.04em; color: var(--color-muted);
        }
        .dsp-pills { display: flex; gap: 6px; overflow-x: auto; padding: 4px 0; margin: 10px 0; min-width: 0; flex: 1; }

        .dsp-selects { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
        .dsp-selects > div { flex: 0 1 200px; min-width: 150px; }

        .dsp-card {
          border: 1px solid var(--color-border); border-radius: 12px; padding: 14px;
          margin-bottom: 14px; background: var(--color-card);
        }
        .dsp-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; flex-wrap: wrap; }
        .dsp-chips { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
        .dsp-ref { font-size: 13px; }
        .dsp-date { font-size: 12px; color: var(--color-muted); }
        .dsp-subject { display: block; margin-top: 10px; font-size: 15px; word-break: break-word; }
        .dsp-details {
          margin: 4px 0 0; font-size: 13px; color: var(--color-muted);
          white-space: pre-wrap; word-break: break-word;
        }

        .dsp-meta {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 10px 20px; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--color-border);
        }
        .dsp-meta-item { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .dsp-meta-item.dsp-wide { grid-column: 1 / -1; }
        .dsp-meta-label {
          display: block; font-size: 11px; font-weight: 600; text-transform: uppercase;
          letter-spacing: 0.04em; color: var(--color-muted); margin-bottom: 2px;
        }
        .dsp-meta-item .dsp-meta-label { margin-bottom: 0; }
        .dsp-meta-value { font-size: 13px; color: var(--color-ink); word-break: break-word; }

        .dsp-controls {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 10px 14px; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--color-border);
        }
        .dsp-control { min-width: 0; }
        select.dsp-select, .dsp-selects select { padding: 7px 10px; font-size: 13px; }

        .dsp-notes {
          margin-top: 12px; padding: 12px; border-radius: 10px;
          background: var(--color-surface); border: 1px solid var(--color-border);
        }
        .dsp-note { padding: 8px 0; border-top: 1px solid var(--color-border); }
        .dsp-note.dsp-note-first { border-top: none; padding-top: 0; }

        .dsp-copywrap { display: inline-flex; align-items: baseline; gap: 6px; flex-wrap: wrap; }
        .dsp-copytext { word-break: break-all; }
        button.dsp-copy {
          min-width: 0; padding: 0 2px; border: none; background: transparent; color: var(--color-teal);
          font-size: 11px; font-weight: 600; cursor: pointer; align-self: auto;
        }
        button.dsp-copy:hover { background: transparent; color: var(--color-teal); text-decoration: underline; }

        .dsp-empty {
          text-align: center; padding: 32px 16px; border: 1px dashed var(--color-border);
          border-radius: 12px; color: var(--color-muted);
        }
        .dsp-empty-icon { font-size: 30px; margin-bottom: 6px; }
        .dsp-empty-title { margin: 0 0 4px; font-size: 14px; font-weight: 600; color: var(--color-ink); }
        .dsp-empty-text { margin: 0; font-size: 13px; }

        @media (max-width: 600px) {
          .dsp-filter { flex-direction: column; align-items: stretch; gap: 0; }
          .dsp-filter-label { width: auto; margin-top: 6px; }
          .dsp-selects > div { flex: 1 1 140px; }
        }
      `}</style>

      <div className="dsp-toolbar">
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          style={btn('primary', { height: 40, padding: '0 18px' })}
        >
          Log a complaint
        </button>
        <input
          type="search"
          placeholder="Search reference, name, contact or subject"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>

      <div className="dsp-filter">
        <span className="dsp-filter-label">Status</span>
        <div className="dsp-pills">
          {STATUS_TABS.map(([v, label]) => {
            const count = v === 'all' ? totalAll : counts[v] || 0;
            const active = status === v;
            return (
              <button
                key={v}
                type="button"
                onClick={() => {
                  setStatus(v);
                  setPage(1);
                }}
                style={btn(active ? 'primary' : 'outline', {
                  borderRadius: 999,
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  opacity: !active && count === 0 ? 0.55 : 1,
                })}
              >
                {label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      <div className="dsp-selects">
        <div>
          <label className="dsp-meta-label">Source</label>
          <select
            value={source}
            onChange={(e) => {
              setSource(e.target.value);
              setPage(1);
            }}
          >
            {SOURCE_TABS.map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="dsp-meta-label">Assigned</label>
          <select
            value={assigned}
            onChange={(e) => {
              setAssigned(e.target.value);
              setPage(1);
            }}
          >
            {ASSIGN_TABS.map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {notice && <Notice onClose={() => setNotice('')}>{notice}</Notice>}
      {error && <Notice tone="warning">{error}</Notice>}
      {loading && data.disputes.length === 0 && <p style={{ color: 'var(--color-muted)' }}>Loading...</p>}

      {!loading && !error && data.disputes.length === 0 && (
        <div className="dsp-empty">
          <div className="dsp-empty-icon">📭</div>
          <p className="dsp-empty-title">{emptyTitle}</p>
          <p className="dsp-empty-text">{emptyText}</p>
          {canShowAll && (
            <button
              type="button"
              onClick={() => {
                setStatus('all');
                setPage(1);
              }}
              style={btn('outline', { marginTop: 12 })}
            >
              Show all complaints
            </button>
          )}
        </div>
      )}

      {data.disputes.map((d) => (
        <DisputeCard
          key={d._id}
          d={d}
          admins={admins}
          onStatus={changeStatus}
          onAssign={changeAssign}
          onPriority={changePriority}
          onNote={addNote}
                    onDelete={askDelete}
        />
      ))}

      <Pager page={page} pages={data.pages} onPage={setPage} />

      {dialog && <ConfirmDialog {...dialog} onCancel={() => setDialog(null)} />}
      {createOpen && (
        <CreateModal
          admins={admins}
          onClose={() => setCreateOpen(false)}
          onCreated={(d) => {
            setCreateOpen(false);
            setNotice(`Complaint ${d.ref} saved.`);
            setStatus('open');
            setPage(1);
            reload();
          }}
        />
      )}
    </PageShell>
  );
}