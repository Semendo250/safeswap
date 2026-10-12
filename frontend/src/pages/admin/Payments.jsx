import { useEffect, useState } from 'react';
import { getPayments, updatePaymentStatus, getStalePayments, expireStalePayments } from '../../api/admin.api';
import ExportButton from '../../components/admin/ExportButton';
import {
  PageShell,
  Chip,
  Pager,
  Notice,
  Tabs,
  Modal,
  ConfirmDialog,
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

// A value with a quiet "Copy" link next to it (long-press copying is switched off app-wide)
function CopyValue({ value, mono = false }) {
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
    <span className="pay-copywrap">
      <span className={mono ? 'pay-copytext pay-mono' : 'pay-copytext'}>{value}</span>
      <button type="button" className="pay-copy" onClick={copy}>
        {copied ? 'Copied' : 'Copy'}
      </button>
    </span>
  );
}

function MetaItem({ label, children, wide = false }) {
  return (
    <div className={wide ? 'pay-meta-item pay-wide' : 'pay-meta-item'}>
      <span className="pay-meta-label">{label}</span>
      <span className="pay-meta-value">{children}</span>
    </div>
  );
}

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

function PaymentCard({ p, onEdit }) {
  const changed = p.updatedAt && p.updatedAt !== p.createdAt;

  return (
    <div className="pay-card">
      <div className="pay-top">
        <div className="pay-main">
          <strong style={{ fontSize: 15, wordBreak: 'break-word' }}>
            {p.listing ? p.listing.title : 'Deleted listing'}
          </strong>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-primary)', marginTop: 3 }}>
            {money(p.amount)}
          </div>
        </div>

        <div className="pay-side">
          <Chip tone={PAYMENT_TONE[p.status] || 'muted'}>{p.status}</Chip>
          <button type="button" onClick={onEdit} style={btn('outline')}>
            Change status
          </button>
        </div>
      </div>

      <div className="pay-meta">
        <MetaItem label="Buyer">{p.buyer ? p.buyer.fullName : 'Deleted user'}</MetaItem>
        <MetaItem label="Seller">{p.seller ? p.seller.fullName : 'Unknown'}</MetaItem>
        {p.buyer && (
          <MetaItem label="Buyer email">
            <CopyValue value={p.buyer.email} />
          </MetaItem>
        )}
        {p.seller && p.seller.phone && (
          <MetaItem label="Seller phone">
            <CopyValue value={p.seller.phone} />
          </MetaItem>
        )}
        <MetaItem label="Paid from">{p.phone ? <CopyValue value={p.phone} /> : 'Not recorded'}</MetaItem>
        <MetaItem label="M-Pesa receipt">
          {p.mpesaReceipt ? <CopyValue value={p.mpesaReceipt} /> : 'None yet'}
        </MetaItem>
        <MetaItem label="Started">{fmtDate(p.createdAt)}</MetaItem>
        {changed && <MetaItem label="Last change">{fmtDate(p.updatedAt)}</MetaItem>}
        <MetaItem label="Checkout ID" wide>
          <CopyValue value={p.checkoutRequestId} mono />
        </MetaItem>
      </div>
    </div>
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
    const [dialog, setDialog] = useState(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

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
    async function askCleanUp() {
    setError('');
    setNotice('');
    try {
      const res = await getStalePayments(24);
      const n = res.data.count;
      if (!n) {
        setNotice('Nothing to clean up. No payment has been pending for more than 24 hours.');
        return;
      }
      setDialog({
        title: `Clean up ${n} old pending payment${n === 1 ? '' : 's'}?`,
                message:
          'These payments have been pending for over 24 hours, so the buyer never completed them. They will be marked failed and each buyer gets a notification. No money moves. You can still change any of them back with Change status.',
        confirmLabel: 'Mark as failed',
        danger: true,
        onConfirm: async () => {
          const r = await expireStalePayments(24);
          setDialog(null);
                    setNotice(`${r.data.expired} old pending payment${r.data.expired === 1 ? '' : 's'} marked as failed. The buyers are being notified.`);
          setReloadKey((k) => k + 1);
        },
      });
    } catch (err) {
      setError(errText(err, 'Could not check for old payments.'));
    }
  }

  const counts = data.counts || {};
  const allCount = Object.values(counts).reduce((a, b) => a + b, 0);
  const tabs = [['all', `All (${allCount})`], ...STATUSES.map((s) => [s, `${cap(s)} (${counts[s] || 0})`])];

  return (
    <PageShell title="Payments" subtitle="Changing a status updates the record only. It never moves money.">
      <style>{`
        .pay-filter { display: flex; align-items: center; gap: 10px; }
        .pay-filter-label {
          width: 52px; flex-shrink: 0; font-size: 11px; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.04em; color: var(--color-muted);
        }
        .pay-filter > div:last-child { min-width: 0; flex: 1; }

        .pay-export { display: flex; align-items: flex-end; gap: 10px; flex-wrap: wrap; margin: 4px 0 14px; }
        .pay-export-label {
          width: 52px; flex-shrink: 0; align-self: center; font-size: 11px; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.04em; color: var(--color-muted);
        }
        .pay-date-label { display: block; margin-bottom: 2px; font-size: 11px; color: var(--color-muted); }
        .pay-export input[type="date"] { width: auto; padding: 7px 10px; font-size: 13px; }

        .pay-card {
          border: 1px solid var(--color-border); border-radius: 12px; padding: 14px;
          margin-bottom: 14px; background: var(--color-card);
        }
        .pay-top { display: flex; gap: 12px; align-items: flex-start; justify-content: space-between; }
        .pay-main { min-width: 0; flex: 1; }
        .pay-side { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }

        .pay-meta {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
          gap: 10px 20px; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--color-border);
        }
        .pay-meta-item { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .pay-meta-item.pay-wide { grid-column: 1 / -1; }
        .pay-meta-label {
          font-size: 11px; font-weight: 600; text-transform: uppercase;
          letter-spacing: 0.04em; color: var(--color-muted);
        }
        .pay-meta-value { font-size: 13px; color: var(--color-ink); word-break: break-word; }

        .pay-copywrap { display: inline-flex; align-items: baseline; gap: 6px; flex-wrap: wrap; }
        .pay-copytext { word-break: break-all; }
        .pay-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; }
        button.pay-copy {
          min-width: 0; padding: 0 2px; border: none; background: transparent; color: var(--color-teal);
          font-size: 11px; font-weight: 600; cursor: pointer; align-self: auto;
        }
        button.pay-copy:hover { background: transparent; color: var(--color-teal); text-decoration: underline; }

        @media (max-width: 600px) {
          .pay-filter { flex-direction: column; align-items: stretch; gap: 0; }
          .pay-filter-label, .pay-export-label { width: auto; margin-top: 6px; }
          .pay-top { flex-wrap: wrap; }
          .pay-side { flex-basis: 100%; justify-content: space-between; }
        }
      `}</style>

      <input
        type="search"
        placeholder="Search buyer, listing, phone, receipt or checkout ID"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
      />

      <div className="pay-filter">
        <span className="pay-filter-label">Status</span>
        <Tabs
          options={tabs}
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
        />
      </div>

      <div className="pay-export">
        <span className="pay-export-label">Export</span>
        <div>
          <label className="pay-date-label">From</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="pay-date-label">To</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <ExportButton
          kind="payments"
          label="Export payments CSV"
          params={{ status, from, to }}
          onDone={setNotice}
          onError={setError}
        />
      </div>
            <div style={{ margin: '0 0 10px' }}>
        <button type="button" onClick={askCleanUp} style={btn('outline')}>
          Clean up old pending
        </button>
      </div>

      {notice && <Notice onClose={() => setNotice('')}>{notice}</Notice>}
      {error && <Notice tone="warning">{error}</Notice>}
      {loading && data.payments.length === 0 && <p style={{ color: 'var(--color-muted)' }}>Loading...</p>}
      {!loading && !error && data.payments.length === 0 && <p style={{ color: 'var(--color-muted)' }}>No payments match.</p>}

      {data.payments.map((p) => (
        <PaymentCard key={p._id} p={p} onEdit={() => setEditing(p)} />
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
            {dialog && <ConfirmDialog {...dialog} onCancel={() => setDialog(null)} />}
    </PageShell>
  );
}