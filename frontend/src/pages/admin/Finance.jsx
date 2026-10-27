import { Fragment, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import RefreshButton from '../../components/admin/RefreshButton';
import {
  getFinanceOverview,
  getFinanceSettlements,
  getFinanceHeld,
  getFinanceTrends,
  markSettlementPaid,
  undoSettlement,
  setFeeRate,
  sendSettlement,
  resetTransfer,
} from '../../api/finance.api';
import ExportButton from '../../components/admin/ExportButton';
import {
  PageShell,
  Chip,
  Pager,
  Notice,
  Tabs,
  Modal,
  ConfirmDialog,
  CopyText,
  btn,
  errText,
  fmtDate,
  money,
  useDebounced,
} from '../../components/admin/AdminUi';

const TAB_QUERY = {
  'payout-due': { type: 'payout', status: 'due' },
  'refund-due': { type: 'refund', status: 'due' },
  paid: { status: 'paid' },
};
const VALID_TABS = ['payout-due', 'refund-due', 'held', 'paid'];
const REFERENCE_RX = /^[A-Z0-9][A-Z0-9\-_.]{3,29}$/;
const DAY_MS = 24 * 60 * 60 * 1000;
const CATEGORY_LABEL = { phone: 'Phones', general: 'Other items' };
function rangeText(list) {
  const lo = Math.min(...list);
  const hi = Math.max(...list);
  return lo === hi ? `${lo}%` : `${lo}% to ${hi}%`;
}

function daysSince(value) {
  if (!value) return 0;
  return Math.max(Math.floor((Date.now() - new Date(value).getTime()) / DAY_MS), 0);
}

function shortDate(key) {
  return new Date(`${key}T00:00:00`).toLocaleDateString([], { day: 'numeric', month: 'short' });
}

function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function scrollToId(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function SectionTitle({ children, hint }) {
  return (
    <div className="fin-section">
      <h3>{children}</h3>
      {hint && <span className="fin-hint">{hint}</span>}
    </div>
  );
}

function Muted({ children }) {
  return <p style={{ color: 'var(--color-muted)', fontSize: 13, margin: '8px 0' }}>{children}</p>;
}

// A card that behaves like the dashboard cards: teal border on hover, a small press effect,
// and a click that either opens another page (to) or does something on this page (onClick)
function Clickable({ to, onClick, children }) {
  if (to) {
    return (
      <Link to={to} className="fin-link">
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className="fin-link">
      {children}
    </button>
  );
}

// ---------- charts (plain SVG) ----------

function BarChart({ data, color, format }) {
  const W = 300;
  const H = 90;
  const max = Math.max(1, ...data.map((d) => d.value));
  const gap = data.length > 40 ? 0.5 : data.length > 14 ? 1.5 : 4;
  const bw = (W - gap * (data.length - 1)) / data.length;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }} role="img">
      {data.map((d, i) => {
        const h = d.value ? Math.max(2, (d.value / max) * (H - 4)) : 1;
        return (
          <rect
            key={d.date}
            x={i * (bw + gap)}
            y={H - h}
            width={bw}
            height={h}
            rx={1.5}
            fill={color}
            opacity={d.value ? 1 : 0.25}
          >
            <title>{`${shortDate(d.date)}: ${format(d.value)}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}

function ChartCard({ title, series, pick, color, to, onClick }) {
  const data = series.map((s) => ({ date: s.date, value: pick(s) }));
  if (data.length === 0) return null;
  const total = data.reduce((n, d) => n + d.value, 0);
  return (
    <Clickable to={to} onClick={onClick}>
      <div className="fin-card">
        <div className="fin-chart-head">
          <span className="fin-chart-title">{title}</span>
          <span className="fin-chart-total" style={{ color }}>
            {money(total)}
          </span>
        </div>
        <div style={{ margin: '12px 0 6px' }}>
          <BarChart data={data} color={color} format={money} />
        </div>
        <div className="fin-chart-range">
          <span>{shortDate(data[0].date)}</span>
          <span>{shortDate(data[data.length - 1].date)}</span>
        </div>
      </div>
    </Clickable>
  );
}

// ---------- small pieces ----------

function StatCard({ label, amount, sub, color, onClick }) {
  return (
    <Clickable onClick={onClick}>
      <div className="fin-card fin-accent" style={{ '--accent': color }}>
        <div className="fin-stat-label">{label}</div>
        <div className="fin-stat-amount" style={{ color }}>
          {money(amount)}
        </div>
        {sub && <div className="fin-stat-sub">{sub}</div>}
      </div>
    </Clickable>
  );
}

function AttentionRow({ icon, label, count, to, onClick }) {
  const inner = (
    <>
      <span className="fin-attn-icon">{icon}</span>
      <span className="fin-attn-label">{label}</span>
      <span className="fin-attn-count">{count}</span>
      <span className="fin-attn-arrow">›</span>
    </>
  );
  if (to) {
    return (
      <Link to={to} className="fin-attn">
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className="fin-attn">
      {inner}
    </button>
  );
}

function Meta({ label, children, wide = false }) {
  return (
    <div className={wide ? 'fin-meta-item fin-wide' : 'fin-meta-item'}>
      <span className="fin-meta-label">{label}</span>
      <span className="fin-meta-value">{children}</span>
    </div>
  );
}

// ---------- dialogs ----------

function PayDialog({ s, onCancel, onDone }) {
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
  const isRefund = s.type === 'refund';
  const clean = reference.trim().toUpperCase();
  const valid = REFERENCE_RX.test(clean);

  async function submit() {
    if (busy || !valid) return;
    setBusy(true);
    setError('');
    try {
      const res = await markSettlementPaid(s._id, clean, note.trim());
      onDone(res.data);
    } catch (err) {
      setError(errText(err));
      setBusy(false);
    }
  }

  return (
    <Modal title={isRefund ? 'Mark refund as sent' : 'Mark payout as sent'} onClose={onCancel} busy={busy}>
      <p style={{ margin: '0 0 8px', fontSize: 14, lineHeight: 1.5 }}>
        Send <strong>{money(s.net)}</strong> to <strong>{s.sendTo.name}</strong>
        {s.sendTo.phone ? ` on ${s.sendTo.phone}` : ''} in M-Pesa first. Then paste the confirmation code below.
      </p>
      {!s.sendTo.phone && (
        <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--color-warning)' }}>
          There is no phone number on file for this person.
        </p>
      )}

      <input
        type="text"
        placeholder="M-Pesa confirmation code"
        value={reference}
        maxLength={30}
        autoCapitalize="characters"
        onChange={(e) => setReference(e.target.value)}
        style={{ marginBottom: 8 }}
      />
      <textarea
        rows={2}
        maxLength={300}
        placeholder="Note (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        style={{ marginBottom: 10 }}
      />
      {error && <p style={{ color: 'var(--color-warning)', fontSize: 13, margin: '0 0 10px' }}>{error}</p>}

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onCancel} disabled={busy} style={btn('outline', { padding: '9px 16px' })}>
          Cancel
        </button>
        <button type="button" onClick={submit} disabled={busy || !valid} style={btn('primary', { padding: '9px 16px' })}>
          {busy ? 'Saving...' : 'Mark as sent'}
        </button>
      </div>
    </Modal>
  );
}
function SendDialog({ s, env, onCancel, onDone }) {
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const isRefund = s.type === 'refund';
  const live = env === 'production';
  const noPhone = !s.sendTo.phone;

  async function submit() {
    if (busy || !confirmed || noPhone) return;
    setBusy(true);
    setError('');
    try {
      const res = await sendSettlement(s._id, s.net);
      onDone(res.data);
    } catch (err) {
      setError(errText(err));
      setBusy(false);
    }
  }

  const row = (label, value) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', fontSize: 14 }}>
      <span style={{ color: 'var(--color-muted)' }}>{label}</span>
      <strong style={{ textAlign: 'right', wordBreak: 'break-word' }}>{value}</strong>
    </div>
  );

  return (
    <Modal title={isRefund ? 'Send refund now' : 'Send payout now'} onClose={onCancel} busy={busy}>
      <div
        style={{
          borderTop: '1px solid var(--color-border)',
          borderBottom: '1px solid var(--color-border)',
          margin: '8px 0 12px',
          padding: '4px 0',
        }}
      >
        {row('Amount', money(s.net))}
        {row(isRefund ? 'Refund to' : 'Pay to', s.sendTo.name)}
        {row('M-Pesa number', s.sendTo.phone || 'None on file')}
        {row('Item', s.listing ? s.listing.title : 'Deleted listing')}
      </div>

      <p
        style={{
          margin: '0 0 10px',
          padding: '8px 10px',
          borderRadius: 8,
          fontSize: 12,
          lineHeight: 1.5,
          background: live ? 'var(--color-warning-bg)' : 'var(--color-gold-bg)',
          color: live ? 'var(--color-warning)' : 'var(--color-gold)',
        }}
      >
        {live
          ? 'This sends real money from your M-Pesa business account and cannot be undone.'
          : 'Test mode: no real money moves.'}
      </p>
      {noPhone && (
        <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--color-warning)' }}>
          There is no phone number on file for this person, so it cannot be sent automatically.
        </p>
      )}

      <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, margin: '0 0 12px' }}>
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          style={{ width: 'auto', minWidth: 0, marginTop: 2 }}
        />
        <span>I have checked the name, number and amount.</span>
      </label>

      {error && <p style={{ color: 'var(--color-warning)', fontSize: 13, margin: '0 0 10px' }}>{error}</p>}

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onCancel} disabled={busy} style={btn('outline', { padding: '9px 16px' })}>
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={busy || !confirmed || noPhone}
          style={btn('primary', { padding: '9px 16px' })}
        >
          {busy ? 'Sending...' : `Send ${money(s.net)}`}
        </button>
      </div>
    </Modal>
  );
}

function FeeDialog({ current, buckets, onCancel, onDone }) {
  const [cat, setCat] = useState('phone');
  const [values, setValues] = useState({
    phone: current.phone.map(String),
    general: current.general.map(String),
  });
  const [fillAll, setFillAll] = useState('');
  const [reason, setReason] = useState('');
  const [applyToDue, setApplyToDue] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const isValid = (v) => {
    const n = Number(v);
    return String(v).trim() !== '' && Number.isFinite(n) && n >= 0 && n <= 30;
  };
  const allValid = ['phone', 'general'].every((c) => values[c].every(isValid));
  const ready = allValid && reason.trim().length >= 3;

  function setCell(i, v) {
    setValues((prev) => ({ ...prev, [cat]: prev[cat].map((x, j) => (j === i ? v : x)) }));
  }

  function fill() {
    if (!isValid(fillAll)) return;
    setValues((prev) => ({ ...prev, [cat]: prev[cat].map(() => fillAll) }));
  }

  async function submit() {
    if (busy || !ready) return;
    setBusy(true);
    setError('');
    try {
      const rates = { phone: values.phone.map(Number), general: values.general.map(Number) };
      const res = await setFeeRate(rates, reason.trim(), applyToDue);
      onDone(res.data);
    } catch (err) {
      setError(errText(err));
      setBusy(false);
    }
  }

  return (
    <Modal title="Platform fees" onClose={onCancel} busy={busy}>
      <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--color-muted)', lineHeight: 1.5 }}>
        The fee is a percentage of the agreed price the buyer paid, set per price range for each category. It is
        kept when a payment is released and the seller is paid the rest. Refunds never include a fee.
      </p>

      <Tabs
        options={[
          ['phone', 'Phones'],
          ['general', 'Other items'],
        ]}
        value={cat}
        onChange={setCat}
      />

      {buckets.map((b, i) => (
        <div
          key={b.label}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}
        >
          <span style={{ fontSize: 13 }}>{b.label}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              max="30"
              step="0.5"
              value={values[cat][i]}
              onChange={(e) => setCell(i, e.target.value)}
              style={{ width: 84, textAlign: 'right' }}
            />
            <span style={{ fontSize: 13, color: 'var(--color-muted)' }}>%</span>
          </span>
        </div>
      ))}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '10px 0 12px' }}>
        <span style={{ fontSize: 12, color: 'var(--color-muted)', flex: 1 }}>
          Use the same rate for every range of {cat === 'phone' ? 'phones' : 'other items'}:
        </span>
        <input
          type="number"
          inputMode="decimal"
          min="0"
          max="30"
          step="0.5"
          placeholder="%"
          value={fillAll}
          onChange={(e) => setFillAll(e.target.value)}
          style={{ width: 70, textAlign: 'right' }}
        />
        <button type="button" onClick={fill} disabled={!isValid(fillAll)} style={btn('outline')}>
          Fill
        </button>
      </div>

      {!allValid && (
        <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--color-warning)' }}>
          Every range, in both categories, needs a fee from 0 to 30%.
        </p>
      )}

      <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, margin: '0 0 10px' }}>
        <input
          type="checkbox"
          checked={applyToDue}
          onChange={(e) => setApplyToDue(e.target.checked)}
          style={{ width: 'auto', minWidth: 0, marginTop: 2 }}
        />
        <span>Also apply to payouts that are waiting to be sent. Payouts already sent never change.</span>
      </label>

      <textarea
        rows={2}
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
        <button type="button" onClick={submit} disabled={busy || !ready} style={btn('primary', { padding: '9px 16px' })}>
          {busy ? 'Saving...' : 'Save fees'}
        </button>
      </div>
    </Modal>
  );
}

// ---------- list cards ----------

function SettlementCard({ s, b2c, onSend, onPay, onUndo, onReset }) {
  const isRefund = s.type === 'refund';
  const isDue = s.status === 'due';
  const waiting = isDue ? daysSince(s.eventAt) : 0;

  const t = s.transfer || {};
  const sending = isDue && t.state === 'sending';
  const failed = isDue && t.state === 'failed';
  const sendingMins = sending && t.initiatedAt ? Math.floor((Date.now() - new Date(t.initiatedAt).getTime()) / 60000) : 0;
  const stuck = sending && sendingMins >= 5;
  const canSend = isDue && !sending && b2c && b2c.ready;

  const sale =
    s.askingPrice && s.askingPrice > s.gross
      ? `Agreed price ${money(s.gross)} (asking ${money(s.askingPrice)})`
      : `Sale ${money(s.gross)}`;
  let breakdown;
  if (isRefund) breakdown = `Full refund of the ${money(s.gross)} payment`;
  else if (s.fee > 0) breakdown = `${sale}, minus ${s.feePercent}% fee (${money(s.fee)})`;
  else breakdown = `${sale}, no fee`;

  return (
    <div className="fin-card fin-item">
      <div className="fin-top">
        <div className="fin-main">
          <strong style={{ fontSize: 15, wordBreak: 'break-word' }}>
            {s.listing ? s.listing.title : 'Deleted listing'}
          </strong>
          <div className="fin-amount">
            <CopyText value={String(s.net)}>{money(s.net)}</CopyText>
          </div>
          <div className="fin-sub">{breakdown}</div>
          {sending && !stuck && (
            <div className="fin-sub" style={{ color: 'var(--color-gold)' }}>
              Waiting for M-Pesa to confirm. This page updates by itself.
            </div>
          )}
          {(stuck || failed) && (
            <div className="fin-warnbox">
              <strong>{stuck ? 'Still waiting for M-Pesa.' : 'The last send did not go through.'}</strong>{' '}
              {t.message || 'Check your M-Pesa statement before trying again.'}
            </div>
          )}
          {s.mismatch && (
            <div className="fin-warnbox">
              <strong>Check this one.</strong> The payment is now marked {s.paymentStatus}, but this was already sent.
              Look at it on the Payments page.
            </div>
          )}
        </div>

        <div className="fin-side">
          <Chip tone={isRefund ? 'muted' : 'teal'}>{isRefund ? 'Refund' : 'Payout'}</Chip>
          {isDue && !sending && !failed && <Chip tone="gold">To send</Chip>}
          {sending && <Chip tone="gold">Sending</Chip>}
          {failed && <Chip tone="warning">Failed</Chip>}
          {!isDue && <Chip tone="success">Sent</Chip>}
          {!isDue && s.via === 'mpesa' && <Chip tone="teal">Via M-Pesa</Chip>}
          {waiting >= 3 && !sending && <Chip tone="warning">Waiting {waiting} days</Chip>}

          {canSend && (
            <button type="button" onClick={onSend} style={btn('primary')}>
              {failed ? 'Try again' : 'Send now'}
            </button>
          )}
          {isDue && (!sending || stuck) && (
            <button type="button" onClick={onPay} style={btn('outline')}>
              Mark as sent
            </button>
          )}
          {(stuck || failed) && (
            <button type="button" onClick={onReset} style={btn('outline')}>
              Reset
            </button>
          )}
          {!isDue && s.via !== 'mpesa' && (
            <button type="button" onClick={onUndo} style={btn('outline')}>
              Undo
            </button>
          )}
        </div>
      </div>

      <div className="fin-meta">
        <Meta label={isDue ? 'Send to' : 'Sent to'}>{s.sendTo.name}</Meta>
        <Meta label="Phone">
          <CopyText value={s.sendTo.phone} />
        </Meta>
        {isRefund ? (
          <Meta label="Seller">{s.seller ? s.seller.fullName : 'Unknown'}</Meta>
        ) : (
          <Meta label="Buyer">{s.buyer ? s.buyer.fullName : 'Deleted user'}</Meta>
        )}
        <Meta label="Buyer's M-Pesa receipt">
          {s.mpesaReceipt ? <CopyText value={s.mpesaReceipt} /> : 'None on file'}
        </Meta>
        <Meta label={isRefund ? 'Refunded on' : 'Released on'}>{fmtDate(s.eventAt)}</Meta>
        <Meta label="Category">{s.category === 'phone' ? 'Phone' : s.category ? 'Other item' : '-'}</Meta>
        {!isDue && (
          <>
            <Meta label="Confirmation code">
              <CopyText value={s.reference} />
            </Meta>
            <Meta label="Sent on">{fmtDate(s.paidAt)}</Meta>
            <Meta label="Sent by">{s.paidByName || '-'}</Meta>
            <Meta label="Sent via">{s.via === 'mpesa' ? 'M-Pesa (from this page)' : 'By hand'}</Meta>
            {s.note && (
              <Meta label="Note" wide>
                {s.note}
              </Meta>
            )}
          </>
        )}
      </div>
    </div>
  );
}
function HeldCard({ p }) {
  const late = p.daysHeld >= 3;
  const discounted = p.askingPrice && p.askingPrice > p.amount;
  return (
    <div className="fin-card fin-item">
      <div className="fin-top">
        <div className="fin-main">
          <strong style={{ fontSize: 15, wordBreak: 'break-word' }}>
            {p.listing ? p.listing.title : 'Deleted listing'}
          </strong>
          <div className="fin-amount">{money(p.amount)}</div>
          <div className="fin-sub">
            {discounted ? `Agreed price (asking ${money(p.askingPrice)}). ` : ''}
            {p.fee > 0
              ? `On release: seller gets ${money(p.sellerGets)}, you keep ${money(p.fee)} (${p.feePercent}%)`
              : 'On release: the seller gets the full amount'}
          </div>
        </div>
        <div className="fin-side">
          <Chip tone={late ? 'warning' : 'teal'}>
            {p.daysHeld === 0 ? 'Held today' : `Held ${plural(p.daysHeld, 'day')}`}
          </Chip>
          {p.needsReview && <Chip tone="warning">Needs review</Chip>}
          <Link to="/admin/payments" style={{ ...btn('outline'), textDecoration: 'none' }}>
            Open Payments
          </Link>
        </div>
      </div>

      <div className="fin-meta">
        <Meta label="Buyer">{p.buyerName}</Meta>
        <Meta label="Seller">{p.sellerName}</Meta>
        <Meta label="Seller phone">
          <CopyText value={p.sellerPhone} />
        </Meta>
        <Meta label="Category">{p.category === 'phone' ? 'Phone' : p.category ? 'Other item' : '-'}</Meta>
        <Meta label="M-Pesa receipt">{p.mpesaReceipt ? <CopyText value={p.mpesaReceipt} /> : 'None on file'}</Meta>
        <Meta label="Held since">{fmtDate(p.heldSince)}</Meta>
      </div>
    </div>
  );
}

// ---------- page ----------

export default function Finance() {
  const [overview, setOverview] = useState(null);
  const [overviewError, setOverviewError] = useState('');
  const [updatedAt, setUpdatedAt] = useState(null);

    // A link like /admin/finance?tab=held opens that tab straight away
  const [searchParams] = useSearchParams();
  const urlTab = searchParams.get('tab');
  const [tab, setTab] = useState(VALID_TABS.includes(urlTab) ? urlTab : 'payout-due');
  const [pendingScroll, setPendingScroll] = useState(VALID_TABS.includes(urlTab));

  // If the link changes while the page is already open, follow it
  useEffect(() => {
    if (!VALID_TABS.includes(urlTab)) return;
    setTab(urlTab);
    setPage(1);
    setSearch('');
    setPendingScroll(true);
  }, [urlTab]);

  // Scroll to the list once the numbers above it have loaded, so the page doesn't jump afterwards
  useEffect(() => {
    if (!pendingScroll || !(overview || overviewError)) return;
    scrollToId('fin-work');
    setPendingScroll(false);
  }, [pendingScroll, overview, overviewError]);
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const [page, setPage] = useState(1);
  const [list, setList] = useState({ items: [], total: 0, pages: 1 });
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState('');

  const [days, setDays] = useState(30);
  const [trends, setTrends] = useState(null);
  const [trendsError, setTrendsError] = useState('');

  const [reloadKey, setReloadKey] = useState(0);
  const [listKey, setListKey] = useState(0);
  const [notice, setNotice] = useState('');
  const [paying, setPaying] = useState(null);
  const [undoing, setUndoing] = useState(null);
  const [feeOpen, setFeeOpen] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [sendTarget, setSendTarget] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  // Summary numbers
   useEffect(() => {
    let cancelled = false;
    setRefreshing(true);
    getFinanceOverview()
      .then((res) => {
        if (!cancelled) {
          setOverview(res.data);
          setOverviewError('');
          setUpdatedAt(new Date());
        }
      })
      .catch((err) => {
        if (!cancelled) setOverviewError(errText(err, 'Could not load the finance summary.'));
      })
      .finally(() => {
        if (!cancelled) setRefreshing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);
  // The list under the tabs
  useEffect(() => {
    let cancelled = false;
    setListLoading(true);
    setListError('');
    const request =
      tab === 'held'
        ? getFinanceHeld({ page }).then((res) => ({
            items: res.data.payments,
            total: res.data.total,
            pages: res.data.pages,
          }))
        : getFinanceSettlements({ ...TAB_QUERY[tab], search: debounced, page }).then((res) => ({
            items: res.data.settlements,
            total: res.data.total,
            pages: res.data.pages,
          }));
    request
      .then((data) => {
        if (!cancelled) setList(data);
      })
      .catch((err) => {
        if (!cancelled) setListError(errText(err, 'Could not load this list.'));
      })
      .finally(() => {
        if (!cancelled) setListLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tab, debounced, page, reloadKey, listKey]);

  // Charts
  useEffect(() => {
    let cancelled = false;
    setTrendsError('');
    getFinanceTrends(days)
      .then((res) => {
        if (!cancelled) setTrends(res.data);
      })
      .catch((err) => {
        if (!cancelled) setTrendsError(errText(err, 'Could not load the charts.'));
      });
    return () => {
      cancelled = true;
    };
  }, [days, reloadKey]);

  // While a send is waiting for M-Pesa, refresh every few seconds so the result appears by itself
  const anySending = list.items.some((x) => x.transfer && x.transfer.state === 'sending');
  useEffect(() => {
    if (!anySending) return undefined;
    const timer = setInterval(() => setListKey((k) => k + 1), 6000);
    return () => clearInterval(timer);
  }, [anySending]);

  // Opens a tab of the list below and scrolls to it. term pre-fills the search box.
  function pickTab(next, term = '') {
    setTab(next);
    setPage(1);
    setSearch(term);
    scrollToId('fin-work');
  }

  const o = overview;
    const b2c = o ? o.b2c : null;
  const tabs = [
    ['payout-due', `Payouts to send (${o ? o.payoutsDue.count : 0})`],
    ['refund-due', `Refunds to send (${o ? o.refundsDue.count : 0})`],
    ['held', `Held (${o ? o.held.count : 0})`],
    ['paid', `Sent (${o ? o.payoutsPaid.count + o.refundsPaid.count : 0})`],
  ];

  const attention = o
    ? [
        { key: 'p', icon: '💸', label: 'Payouts waiting over 3 days', count: o.payoutsDue.overdue, tab: 'payout-due' },
        { key: 'r', icon: '↩️', label: 'Refunds waiting over 3 days', count: o.refundsDue.overdue, tab: 'refund-due' },
        { key: 'h', icon: '⏳', label: 'Money held over 3 days', count: o.held.overdue, tab: 'held' },
        { key: 'n', icon: '🧾', label: 'Marked paid but no M-Pesa receipt', count: o.alerts.noReceipt, to: '/admin/payments' },
        { key: 'v', icon: '🔎', label: 'Payments flagged for review', count: o.alerts.needsReview, to: '/admin/payments' },
        { key: 'c', icon: '⚠️', label: 'Status changed after it was sent', count: o.alerts.changedAfterPaid, tab: 'paid' },
                { key: 't', icon: '📡', label: 'Sends waiting on M-Pesa over 5 minutes', count: o.transfers.stuck, tab: 'payout-due' },
        { key: 'f', icon: '❌', label: 'Sends that failed. Try again', count: o.transfers.failed, tab: 'payout-due' },
      ].filter((i) => i.count > 0)
    : [];

  const series = trends ? trends.series : [];
  const emptyText = {
    'payout-due': 'No payouts waiting. Every released sale has been paid out.',
    'refund-due': 'No refunds waiting to be sent.',
    held: 'No money is being held right now.',
    paid: 'Nothing has been marked as sent yet.',
  }[tab];

  const updatedText = updatedAt
    ? updatedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : '';

  return (
    <PageShell
      title="Finance"
      subtitle="Where the money stands: what you hold, what you owe sellers and buyers, and what you have earned in fees."
    >
      <style>{`
        .fin-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
        .fin-updated { font-size: 12px; color: var(--color-muted); }
        .fin-anchor { scroll-margin-top: 76px; }

        .fin-section { display: flex; align-items: baseline; gap: 8px; margin: 26px 0 10px; }
        .fin-section h3 { margin: 0; font-size: 16px; text-align: left; }
        .fin-hint { font-size: 12px; color: var(--color-muted); }

        .fin-card {
          border: 1px solid var(--color-border); border-radius: 12px; padding: 14px;
          background: var(--color-card); box-sizing: border-box;
        }
        .fin-accent { border-left: 3px solid var(--accent, var(--color-teal)); }
        .fin-item { margin-bottom: 14px; }

        /* Clickable cards: same behaviour as the dashboard cards */
        a.fin-link, button.fin-link {
          display: block; width: 100%; min-width: 0; box-sizing: border-box; margin: 0; padding: 0;
          border: none; background: transparent; color: inherit; font: inherit; text-align: left;
          text-decoration: none; cursor: pointer; align-self: auto;
        }
        a.fin-link:hover, button.fin-link:hover {
          background: transparent; color: inherit; text-decoration: none;
        }
        .fin-link .fin-card { transition: border-color 0.15s, transform 0.1s; }
        .fin-link:hover .fin-card { border-color: var(--color-teal); }
        .fin-link:active .fin-card { transform: scale(0.985); }
        .fin-link:focus-visible { outline: none; }
        .fin-link:focus-visible .fin-card { border-color: var(--color-teal); }

        .fin-grid { display: grid; gap: 12px; }
        .fin-grid-hero { grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
        .fin-grid-stats { grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); }
        .fin-grid-charts { grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }

        .fin-hero { padding: 18px; }
        .fin-hero-label { font-size: 13px; color: var(--color-muted); }
        .fin-hero-amount { margin: 6px 0 4px; font-size: 30px; font-weight: 700; line-height: 1.1; }
        .fin-hero-sub { font-size: 12px; font-weight: 400; color: var(--color-muted); line-height: 1.5; }

        .fin-stat-label { font-size: 12px; font-weight: 400; color: var(--color-muted); }
        .fin-stat-amount { margin: 6px 0 2px; font-size: 20px; font-weight: 700; line-height: 1.2; }
        .fin-stat-sub { font-size: 12px; font-weight: 400; color: var(--color-muted); }

        .fin-attn-list { display: grid; gap: 8px; }
        .fin-attn, button.fin-attn {
          display: flex; align-items: center; gap: 12px; width: 100%; min-width: 0; box-sizing: border-box;
          padding: 12px 14px; border: 1px solid var(--color-warning); border-radius: 12px;
          background: var(--color-card); color: var(--color-ink); text-align: left; text-decoration: none;
          font-size: 14px; font-weight: 400; cursor: pointer; align-self: auto; transition: background 0.15s;
        }
        .fin-attn:hover, button.fin-attn:hover { background: var(--color-warning-bg); color: var(--color-ink); text-decoration: none; }
        .fin-attn:active, button.fin-attn:active { transform: scale(0.99); }
        .fin-attn-icon { font-size: 18px; flex-shrink: 0; }
        .fin-attn-label { flex: 1; min-width: 0; }
        .fin-attn-count {
          font-size: 14px; font-weight: 700; color: var(--color-warning);
          background: var(--color-warning-bg); border-radius: 999px; padding: 2px 10px;
        }
        .fin-attn-arrow { color: var(--color-muted); font-size: 18px; line-height: 1; }

        .fin-clear {
          display: flex; align-items: center; gap: 10px; padding: 14px;
          border: 1px solid var(--color-success); border-radius: 12px;
          background: var(--color-success-bg); color: var(--color-success); font-size: 14px; font-weight: 600;
        }

        .fin-owed { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 0; border-top: 1px solid var(--color-border); font-size: 13px; }
        .fin-owed:first-of-type { border-top: none; }
        button.fin-owed-btn {
          display: flex; flex-direction: column; align-items: flex-start; gap: 2px; flex: 1; min-width: 0;
          width: auto; padding: 0; border: none; background: transparent; color: inherit;
          font: inherit; text-align: left; cursor: pointer; align-self: auto;
        }
        button.fin-owed-btn:hover { background: transparent; color: inherit; }
        button.fin-owed-btn:hover .fin-owed-name { color: var(--color-teal); }
        .fin-owed-name { font-weight: 600; word-break: break-word; transition: color 0.15s; }
        .fin-owed-sub { color: var(--color-muted); font-size: 12px; font-weight: 400; }
        .fin-owed-right { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; flex-shrink: 0; }
        .fin-owed-amt { font-weight: 700; color: var(--color-primary); white-space: nowrap; }
                .fin-rates { display: grid; grid-template-columns: 1fr auto auto; gap: 6px 28px; margin-top: 10px; font-size: 13px; }
        .fin-rates-head { font-size: 11px; font-weight: 600; color: var(--color-muted); }
        .fin-rates-num { text-align: right; font-weight: 600; }

        .fin-filter { display: flex; align-items: center; gap: 10px; }
        .fin-filter-label {
          width: 52px; flex-shrink: 0; font-size: 11px; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.04em; color: var(--color-muted);
        }
        .fin-filter > div:last-child { min-width: 0; flex: 1; }

        .fin-export { display: flex; align-items: flex-end; gap: 10px; flex-wrap: wrap; margin: 8px 0 14px; }
        .fin-date-label { display: block; margin-bottom: 2px; font-size: 11px; color: var(--color-muted); }
        .fin-export input[type="date"] { width: auto; padding: 7px 10px; font-size: 13px; }

        .fin-top { display: flex; gap: 12px; align-items: flex-start; justify-content: space-between; }
        .fin-main { min-width: 0; flex: 1; }
        .fin-side { display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: 8px; flex-shrink: 0; max-width: 55%; }
        .fin-amount { margin-top: 3px; font-size: 17px; font-weight: 700; color: var(--color-primary); }
        .fin-sub { margin-top: 2px; font-size: 12px; color: var(--color-muted); }
        .fin-warnbox {
          margin-top: 8px; padding: 8px 10px; border-radius: 8px;
          background: var(--color-warning-bg); color: var(--color-warning); font-size: 12px; line-height: 1.5;
        }

        .fin-meta {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
          gap: 10px 20px; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--color-border);
        }
        .fin-meta-item { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .fin-meta-item.fin-wide { grid-column: 1 / -1; }
        .fin-meta-label { font-size: 11px; font-weight: 600; color: var(--color-muted); }
        .fin-meta-value { font-size: 13px; color: var(--color-ink); word-break: break-word; }

        .fin-chart-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
        .fin-chart-title { font-size: 13px; font-weight: 600; }
        .fin-chart-total { font-size: 16px; font-weight: 700; }
        .fin-chart-range { display: flex; justify-content: space-between; font-size: 11px; font-weight: 400; color: var(--color-muted); }

        @media (max-width: 600px) {
          .fin-filter { flex-direction: column; align-items: stretch; gap: 0; }
          .fin-filter-label { width: auto; margin-top: 6px; }
          .fin-top { flex-wrap: wrap; }
          .fin-side { flex-basis: 100%; max-width: 100%; justify-content: flex-start; }
        }
      `}</style>

            <div className="fin-toolbar">
        <span className="fin-updated">{updatedText ? `Updated ${updatedText}` : ''}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {b2c && b2c.enabled && (
            <Chip tone={b2c.ready ? (b2c.env === 'production' ? 'success' : 'gold') : 'warning'}>
              {b2c.ready
                ? b2c.env === 'production'
                  ? 'M-Pesa sending: live'
                  : 'M-Pesa sending: test mode'
                : 'M-Pesa sending: not set up'}
            </Chip>
          )}
                              <RefreshButton onClick={() => setReloadKey((k) => k + 1)} busy={refreshing} />
        </span>
      </div>

      {b2c && b2c.enabled && !b2c.ready && (
        <Notice tone="warning">
          Automatic sending is turned on but not fully set up. Missing: {b2c.problems.join(', ')}.
        </Notice>
      )}
      {!o && !overviewError && <Muted>Loading...</Muted>}

      {o && (
        <>
          {/* Whose money is it */}
          <div className="fin-grid fin-grid-hero" style={{ marginTop: 10 }}>
            <Clickable onClick={() => scrollToId('fin-balances')}>
              <div className="fin-card fin-hero fin-accent" style={{ '--accent': 'var(--color-teal)' }}>
                <div className="fin-hero-label">Belongs to buyers and sellers</div>
                <div className="fin-hero-amount" style={{ color: 'var(--color-teal)' }}>
                  {money(o.owedToOthers)}
                </div>
                <div className="fin-hero-sub">
                  Held {money(o.held.total)} + payouts to send {money(o.payoutsDue.net)} + refunds to send{' '}
                  {money(o.refundsDue.total)}. This much should be in your M-Pesa account for other people.
                </div>
              </div>
            </Clickable>

            <div id="fin-fees" className="fin-anchor">
              <Clickable onClick={() => setFeeOpen(true)}>
                <div className="fin-card fin-hero fin-accent" style={{ '--accent': 'var(--color-success)' }}>
                  <div className="fin-hero-label">Yours: fees earned</div>
                  <div className="fin-hero-amount" style={{ color: 'var(--color-success)' }}>
                    {money(o.fees.earned)}
                  </div>
                                    <div className="fin-hero-sub">
                    {money(o.fees.last30)} in the last 30 days. Another {money(o.fees.expected)} is expected when the
                    held money is released. Rates: phones {rangeText(o.feeRates.phone)}, other items{' '}
                    {rangeText(o.feeRates.general)}. Tap to change the rates.
                  </div>
                </div>
              </Clickable>
            </div>
          </div>

          {o.byCategory.length > 0 && (
            <div className="fin-card" style={{ marginTop: 12 }}>
              <div className="fin-stat-label">Fees by category (all released sales)</div>
              {o.byCategory.map((c) => (
                <div key={c.category} className="fin-owed">
                  <div style={{ minWidth: 0 }}>
                    <div className="fin-owed-name">{CATEGORY_LABEL[c.category] || 'Older records (no category)'}</div>
                    <div className="fin-owed-sub">
                      {plural(c.count, 'sale')} worth {money(c.gross)}
                    </div>
                  </div>
                  <span className="fin-owed-amt">{money(c.fee)}</span>
                </div>
              ))}
            </div>
          )}
                    <Clickable onClick={() => setFeeOpen(true)}>
            <div className="fin-card" style={{ marginTop: 12 }}>
              <div className="fin-stat-label">Fee rates by agreed price (tap to change)</div>
              <div className="fin-rates">
                <span className="fin-rates-head">Agreed price</span>
                <span className="fin-rates-head fin-rates-num">Phones</span>
                <span className="fin-rates-head fin-rates-num">Other items</span>
                {o.feeBuckets.map((b, i) => (
                  <Fragment key={b.label}>
                    <span>{b.label}</span>
                    <span className="fin-rates-num">{o.feeRates.phone[i]}%</span>
                    <span className="fin-rates-num">{o.feeRates.general[i]}%</span>
                  </Fragment>
                ))}
              </div>
            </div>
          </Clickable>

          {/* Needs attention */}
          <SectionTitle hint={attention.length ? plural(attention.length, 'item') : ''}>Needs your attention</SectionTitle>
          {attention.length === 0 ? (
            <div className="fin-clear">
              <span style={{ fontSize: 18 }}>✅</span>
              <span>All clear. No money is stuck or out of line.</span>
            </div>
          ) : (
            <div className="fin-attn-list">
              {attention.map((i) => (
                <AttentionRow
                  key={i.key}
                  icon={i.icon}
                  label={i.label}
                  count={i.count}
                  to={i.to}
                  onClick={() => pickTab(i.tab)}
                />
              ))}
            </div>
          )}

          {/* Numbers */}
          <SectionTitle hint="Tap a card to see the list behind it">Balances</SectionTitle>
          <div id="fin-balances" className="fin-grid fin-grid-stats fin-anchor">
            <StatCard
              label="Held (waiting for the handover)"
              amount={o.held.total}
              sub={`${plural(o.held.count, 'payment')}, you would keep ${money(o.held.fee)}`}
              color="var(--color-teal)"
              onClick={() => pickTab('held')}
            />
            <StatCard
              label="Owed to sellers"
              amount={o.payoutsDue.net}
              sub={`${plural(o.payoutsDue.count, 'payout')} to send, after ${money(o.payoutsDue.fee)} in fees`}
              color="var(--color-gold)"
              onClick={() => pickTab('payout-due')}
            />
            <StatCard
              label="Refunds to send"
              amount={o.refundsDue.total}
              sub={plural(o.refundsDue.count, 'refund')}
              color="var(--color-warning)"
              onClick={() => pickTab('refund-due')}
            />
            <StatCard
              label="Paid out to sellers"
              amount={o.payoutsPaid.net}
              sub={`${money(o.payoutsPaid.last7)} in 7 days, ${money(o.payoutsPaid.last30)} in 30 days`}
              color="var(--color-success)"
              onClick={() => pickTab('paid')}
            />
            <StatCard
              label="Refunded to buyers"
              amount={o.refundsPaid.total}
              sub={`${plural(o.refundsPaid.count, 'refund')} sent, ${money(o.refundsPaid.last30)} in 30 days`}
              color="var(--color-muted)"
              onClick={() => pickTab('paid')}
            />
          </div>

          {/* Who is owed */}
          {o.owedBySeller.length > 0 && (
            <>
              <SectionTitle hint="Tap a name to see their payouts">Who you owe</SectionTitle>
              <div className="fin-card">
                {o.owedBySeller.map((r) => (
                  <div key={r.sellerId} className="fin-owed">
                    <button type="button" className="fin-owed-btn" onClick={() => pickTab('payout-due', r.name)}>
                      <span className="fin-owed-name">{r.name}</span>
                      <span className="fin-owed-sub">
                        {plural(r.count, 'payout')}, oldest {daysSince(r.oldest)} days ago
                      </span>
                    </button>
                    <div className="fin-owed-right">
                      <span className="fin-owed-amt">{money(r.net)}</span>
                      {r.phone && <CopyText value={r.phone} />}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* Work list */}
      <div id="fin-work" className="fin-anchor" />
      <SectionTitle hint="Send the money in M-Pesa, then mark it as sent here with the code">Money to move</SectionTitle>
      <div className="fin-filter">
        <span className="fin-filter-label">Show</span>
        <Tabs
          options={tabs}
          value={tab}
          onChange={(v) => {
            setTab(v);
            setPage(1);
            setSearch('');
          }}
        />
      </div>

      {tab !== 'held' && (
        <input
          type="search"
          placeholder="Search name, listing, phone, receipt or confirmation code"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          style={{ marginBottom: 10 }}
        />
      )}

      <div className="fin-export">
        <div>
          <label className="fin-date-label">From</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="fin-date-label">To</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <ExportButton
          kind="finance"
          label="Export finance CSV"
          params={{ ...(TAB_QUERY[tab] || {}), from, to }}
          onDone={setNotice}
          onError={setListError}
        />
      </div>

      {listError && <Notice tone="warning">{listError}</Notice>}
      {listLoading && list.items.length === 0 && <Muted>Loading...</Muted>}
      {!listLoading && !listError && list.items.length === 0 && (
        <Muted>{debounced && tab !== 'held' ? 'Nothing matches your search.' : emptyText}</Muted>
      )}

      {tab === 'held'
        ? list.items.map((p) => <HeldCard key={p._id} p={p} />)
        : list.items.map((s) => (
            <SettlementCard
              key={s._id}
              s={s}
              b2c={b2c}
              onSend={() => setSendTarget(s)}
              onPay={() => setPaying(s)}
              onUndo={() => setUndoing(s)}
              onReset={() => setResetTarget(s)}
            />
          ))}

      <Pager page={page} pages={list.pages} onPage={setPage} />

      {/* Trends */}
      <SectionTitle hint="Tap a chart to open what it is made of">Trends</SectionTitle>
      <div className="fin-filter">
        <span className="fin-filter-label">Period</span>
        <Tabs
          options={[
            [7, 'Last 7 days'],
            [30, 'Last 30 days'],
            [90, 'Last 90 days'],
          ]}
          value={days}
          onChange={setDays}
        />
      </div>
      {trendsError ? (
        <Notice tone="warning">{trendsError}</Notice>
      ) : !trends || trends.days !== days ? (
        <Muted>Loading charts...</Muted>
      ) : (
        <div className="fin-grid fin-grid-charts">
          <ChartCard
            title="Money received"
            series={series}
            pick={(s) => s.moneyIn}
            color="var(--color-teal)"
            to="/admin/payments"
          />
          <ChartCard
            title="Fees earned"
            series={series}
            pick={(s) => s.fees}
            color="var(--color-success)"
            onClick={() => scrollToId('fin-fees')}
          />
          <ChartCard
            title="Paid out to sellers"
            series={series}
            pick={(s) => s.paidOut}
            color="var(--color-gold)"
            onClick={() => pickTab('paid')}
          />
          <ChartCard
            title="Refunded to buyers"
            series={series}
            pick={(s) => s.refunded}
            color="var(--color-muted)"
            onClick={() => pickTab('paid')}
          />
        </div>
      )}

      {paying && (
        <PayDialog
          s={paying}
          onCancel={() => setPaying(null)}
          onDone={(result) => {
            setPaying(null);
            setNotice(result.message);
            setReloadKey((k) => k + 1);
          }}
        />
      )}

      {undoing && (
        <ConfirmDialog
          title="Move back to “to send”?"
          message="Use this if the money was not actually sent, or the confirmation code was wrong. The code is cleared."
          confirmLabel="Move back"
          askReason="required"
          danger
          onConfirm={async (reason) => {
            const res = await undoSettlement(undoing._id, reason);
            setUndoing(null);
            setNotice(res.data.message);
            setReloadKey((k) => k + 1);
          }}
          onCancel={() => setUndoing(null)}
        />
      )}
            {sendTarget && (
        <SendDialog
          s={sendTarget}
          env={b2c ? b2c.env : 'sandbox'}
          onCancel={() => setSendTarget(null)}
          onDone={(result) => {
            setSendTarget(null);
            setNotice(result.message);
            setReloadKey((k) => k + 1);
          }}
        />
      )}

      {resetTarget && (
        <ConfirmDialog
          title="Reset this send?"
          message="Only do this after checking your M-Pesa statement and confirming the money did not leave your account. After resetting you can send it again."
          confirmLabel="Reset"
          askReason="required"
          danger
          onConfirm={async (reason) => {
            const res = await resetTransfer(resetTarget._id, reason);
            setResetTarget(null);
            setNotice(res.data.message);
            setReloadKey((k) => k + 1);
          }}
          onCancel={() => setResetTarget(null)}
        />
      )}

      {feeOpen && o && (
        <FeeDialog
                    current={o.feeRates}
          buckets={o.feeBuckets}
          onCancel={() => setFeeOpen(false)}
          onDone={(result) => {
            setFeeOpen(false);
            setNotice(result.message);
            setReloadKey((k) => k + 1);
          }}
        />
      )}
    </PageShell>
  );
}