import { useEffect, useState } from 'react';
import {
  getDisputes,
  createDispute,
  updateDispute,
  addDisputeNote,
  getAdminList,
} from '../../api/admin.api';
import {
  PageShell,
  Chip,
  Pager,
  Notice,
  Tabs,
  Field,
  Modal,
  ConfirmDialog,
  CopyText,
  btn,
  errText,
  fmtDate,
  useDebounced,
} from '../../components/admin/AdminUi';

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

const box = {
  border: '1px solid var(--color-border)',
  borderRadius: 10,
  padding: 12,
  background: 'var(--color-card)',
  marginBottom: 10,
};

const miniLabel = { fontSize: 11, color: 'var(--color-muted)', display: 'block', marginBottom: 2 };

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

function DisputeCard({ d, admins, onStatus, onAssign, onPriority, onNote }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const notes = d.notes || [];

  async function submitNote() {
    const text = note.trim();
    if (!text || busy) return;
    setBusy(true);
    const ok = await onNote(d, text);
    if (ok) setNote('');
    setBusy(false);
  }

  return (
    <div style={box}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <strong style={{ fontSize: 13 }}>{d.ref}</strong>
          <Chip tone={STATUS_TONE[d.status]}>{STATUS_LABEL[d.status]}</Chip>
          <Chip tone="teal">{SOURCE_LABEL[d.source] || d.source}</Chip>
          {d.priority === 'high' && <Chip tone="warning">High priority</Chip>}
          {d.priority === 'low' && <Chip tone="muted">Low priority</Chip>}
        </div>
        <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>{fmtDate(d.createdAt)}</span>
      </div>

      <strong style={{ fontSize: 15, wordBreak: 'break-word' }}>{d.subject}</strong>
      {d.details && (
        <p style={{ margin: '4px 0 8px', fontSize: 13, color: 'var(--color-muted)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {d.details}
        </p>
      )}

      {d.contactName && <Field label="From">{d.contactName}</Field>}
      {d.contactInfo && (
        <Field label="Contact">
          <CopyText value={d.contactInfo} />
        </Field>
      )}
      {d.user && (
        <Field label="Account">
          {d.user.fullName} ({d.user.email})
        </Field>
      )}
      {d.resolution && <Field label="Resolution">{d.resolution}</Field>}
      {d.resolvedAt && <Field label="Closed">{fmtDate(d.resolvedAt)}</Field>}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '10px 0' }}>
        <div style={{ flex: '1 1 110px' }}>
          <label style={miniLabel}>Status</label>
          <select value={d.status} onChange={(e) => onStatus(d, e.target.value)}>
            {Object.keys(STATUS_LABEL).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: '1 1 110px' }}>
          <label style={miniLabel}>Assigned to</label>
          <select value={d.assignedTo ? d.assignedTo._id : ''} onChange={(e) => onAssign(d, e.target.value)}>
            <option value="">Nobody</option>
            {admins.map((a) => (
              <option key={a._id} value={a._id}>
                {a.fullName}
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: '1 1 90px' }}>
          <label style={miniLabel}>Priority</label>
          <select value={d.priority} onChange={(e) => onPriority(d, e.target.value)}>
            {Object.keys(PRIORITY_LABEL).map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button type="button" onClick={() => setShowNotes((v) => !v)} style={btn('outline')}>
        {showNotes ? 'Hide notes' : `Notes (${notes.length})`}
      </button>

      {showNotes && (
        <div style={{ marginTop: 10 }}>
          {notes.length === 0 && <p style={{ fontSize: 13, color: 'var(--color-muted)', margin: '0 0 8px' }}>No notes yet.</p>}
          {notes.map((n) => (
            <div key={n._id} style={{ padding: '6px 0', borderTop: '1px solid var(--color-border)' }}>
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
  const statusTabs = STATUS_TABS.map(([v, label]) => [
    v,
    `${label} (${v === 'all' ? totalAll : counts[v] || 0})`,
  ]);

  return (
    <PageShell title="Complaints" subtitle="Log and follow up complaints from WhatsApp, email and the app.">
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" onClick={() => setCreateOpen(true)} style={btn('primary', { padding: '9px 16px' })}>
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
          style={{ flex: 1, minWidth: 180 }}
        />
      </div>

      <Tabs
        options={statusTabs}
        value={status}
        onChange={(v) => {
          setStatus(v);
          setPage(1);
        }}
      />
      <Tabs
        options={SOURCE_TABS}
        value={source}
        onChange={(v) => {
          setSource(v);
          setPage(1);
        }}
      />
      <Tabs
        options={ASSIGN_TABS}
        value={assigned}
        onChange={(v) => {
          setAssigned(v);
          setPage(1);
        }}
      />

      {notice && <Notice onClose={() => setNotice('')}>{notice}</Notice>}
      {error && <Notice tone="warning">{error}</Notice>}
      {loading && data.disputes.length === 0 && <p style={{ color: 'var(--color-muted)' }}>Loading...</p>}
      {!loading && !error && data.disputes.length === 0 && (
        <p style={{ color: 'var(--color-muted)' }}>No complaints match.</p>
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