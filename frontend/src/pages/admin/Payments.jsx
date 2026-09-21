import { useEffect, useState } from 'react';
import { getPayments, updatePaymentStatus } from '../../api/admin.api';
import {
  PageShell,
  Chip,
  Pager,
  Notice,
  Tabs,
  Field,
  Modal,
  CopyText,
  btn,
  errText,
  fmtDate,
  money,
  useDebounced,
  PAYMENT_TONE,
} from '../../components/admin/AdminUi';

const STATUSES = ['pending', 'held', 'released', 'failed', 'refunded'];

const STATUS_INFO = {
  pending: 'Waiting for the M-Pesa result.',
  held: 'Money received and being held until the buyer confirms the handover. If the listing was sold it goes back on sale.',
  released: 'Handover done. The listing is marked as sold. This does NOT send money to the seller.',
  failed: 'The payment did not go through. If the listing was sold it goes back on sale.',
  refunded:
    'The buyer was refunded. If the listing was sold it goes back on sale. This does NOT send money: send the refund in M-Pesa yourself.',
};

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function StatusDialog({ payment, onCancel, onDone }) {
  const options = STATUSES.filter((s) => s !== payment.status);
  const [status, setStatus] = useState(options[0]);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const tooShort = reason.trim().length < 3;

  async function submit() {
    if (busy || tooShort) return;
    setBusy(true);
    setError('');
    try {
      const res = await updatePaymentStatus(payment._id, status, reason.trim());
      onDone(res.data);
    } catch (err) {
      setError(errText(err));
      setBusy(false);
    }
  }

  return (
    <Modal title="Change payment status" onClose={onCancel} busy={busy}>
      <p style={{ margin: '0 0 10px', fontSize: 14, color: 'var(--color-muted)' }}>
        {payment.listing ? payment.listing.title : 'Deleted listing'} · {money(payment.amount)} · now{' '}
        <strong>{payment.status}</strong>
      </p>

      <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>New status</label>
      <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ marginBottom: 8 }}>
        {options.map((s) => (
          <option key={s} value={s}>
            {cap(s)}
          </option>
        ))}
      </select>
      <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--color-muted)', lineHeight: 1.5 }}>
        {STATUS_INFO[status]}
      </p>

      <textarea
        rows={3}
        maxLength={300}
        placeholder="Reason (required, saved in the activity log)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        style={{ marginBottom: 10 }}
      />
      {error && <p style={{ color: 'var(--color-warning)', fontSize: 13, margin: '0 0 10px' }}>{error}</p>}

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onCancel} disabled={busy} style={btn('outline', { padding: '9px 16px' })}>
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={busy || tooShort}
          style={btn('primary', { padding: '9px 16px' })}
        >
          {busy ? 'Saving...' : 'Save change'}
        </button>
      </div>
    </Modal>
  );
}

export default function Payments() {
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [data, setData] = useState({ payments: [], counts: {}, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    getPayments({ search: debounced, status, page })
      .then((res) => {
        if (!cancelled) setData(res.data);
      })
      .catch((err) => {
        if (!cancelled) setError(errText(err, 'Could not load payments.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debounced, status, page, reloadKey]);

  const counts = data.counts || {};
  const allCount = Object.values(counts).reduce((a, b) => a + b, 0);
  const tabs = [['all', `All (${allCount})`], ...STATUSES.map((s) => [s, `${cap(s)} (${counts[s] || 0})`])];

  return (
    <PageShell title="Payments" subtitle="Changing a status updates the record only. It never moves money.">
      <input
        type="search"
        placeholder="Search buyer, listing, phone, receipt or checkout ID"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
      />
      <Tabs
        options={tabs}
        value={status}
        onChange={(v) => {
          setStatus(v);
          setPage(1);
        }}
      />

      {notice && <Notice onClose={() => setNotice('')}>{notice}</Notice>}
      {error && <Notice tone="warning">{error}</Notice>}
      {loading && data.payments.length === 0 && <p style={{ color: 'var(--color-muted)' }}>Loading...</p>}
      {!loading && !error && data.payments.length === 0 && <p style={{ color: 'var(--color-muted)' }}>No payments match.</p>}

      {data.payments.map((p) => (
        <div
          key={p._id}
          style={{ border: '1px solid var(--color-border)', borderRadius: 10, padding: 12, marginBottom: 10, background: '#fff' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start', marginBottom: 6 }}>
            <div style={{ minWidth: 0 }}>
              <strong style={{ fontSize: 15, wordBreak: 'break-word' }}>
                {p.listing ? p.listing.title : 'Deleted listing'}
              </strong>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-primary)' }}>{money(p.amount)}</div>
            </div>
            <Chip tone={PAYMENT_TONE[p.status] || 'muted'}>{p.status}</Chip>
          </div>

          <Field label="Buyer">
            {p.buyer ? `${p.buyer.fullName}` : 'Deleted user'}
          </Field>
          {p.buyer && <Field label="Buyer email"><CopyText value={p.buyer.email} /></Field>}
          <Field label="Seller">{p.seller ? p.seller.fullName : 'Unknown'}</Field>
          {p.seller && p.seller.phone && <Field label="Seller phone"><CopyText value={p.seller.phone} /></Field>}
          <Field label="Paid from">{p.phone ? <CopyText value={p.phone} /> : 'Not recorded'}</Field>
          <Field label="M-Pesa receipt">{p.mpesaReceipt ? <CopyText value={p.mpesaReceipt} /> : 'None yet'}</Field>
          <Field label="Checkout ID"><CopyText value={p.checkoutRequestId} /></Field>
          <Field label="Started">{fmtDate(p.createdAt)}</Field>
          {p.updatedAt && p.updatedAt !== p.createdAt && <Field label="Last change">{fmtDate(p.updatedAt)}</Field>}

          <div style={{ marginTop: 10 }}>
            <button type="button" onClick={() => setEditing(p)} style={btn('outline')}>
              Change status
            </button>
          </div>
        </div>
      ))}

      <Pager page={page} pages={data.pages} onPage={setPage} />

      {editing && (
        <StatusDialog
          payment={editing}
          onCancel={() => setEditing(null)}
          onDone={(result) => {
            setEditing(null);
            setNotice(result.message);
            setReloadKey((k) => k + 1);
          }}
        />
      )}
    </PageShell>
  );
}