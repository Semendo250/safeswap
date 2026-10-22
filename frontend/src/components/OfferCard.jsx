import { useState } from 'react';
import FeePreview from './FeePreview';

const fmt = (n) => `KES ${Number(n).toLocaleString()}`;

function timeLeft(date) {
  const ms = new Date(date) - Date.now();
  if (ms <= 0) return 'expired';
  const h = Math.floor(ms / 3600000);
  if (h >= 1) return `${h}h left`;
  return `${Math.max(1, Math.floor(ms / 60000))}m left`;
}

export default function OfferCard({ message, userId, onAccept, onDecline, onCounter, isSeller = false, category }) {
  const offer = message.offer;
  const [busy, setBusy] = useState(false);

  const mine = String(offer.proposedBy) === String(userId);
  const proposer = mine ? 'You offered' : `${message.sender?.fullName || 'They'} offered`;
  const pending = offer.status === 'pending';
  const faded = !['pending', 'accepted', 'paid'].includes(offer.status);
  const sentByMe = String(message.sender?._id) === String(userId);

  async function run(fn) {
    setBusy(true);
    try {
      await fn(offer._id);
    } finally {
      setBusy(false);
    }
  }

  let statusLine = null;
  if (pending && mine) statusLine = `Waiting for reply · ${timeLeft(offer.expiresAt)}`;
  else if (pending) statusLine = `Expires: ${timeLeft(offer.expiresAt)}`;
  else if (offer.status === 'accepted') statusLine = `Agreed: ${fmt(offer.amount)} · ${timeLeft(offer.expiresAt)} to pay`;
  else if (offer.status === 'paid') statusLine = 'Paid';
  else if (offer.status === 'declined') statusLine = 'Declined';
  else if (offer.status === 'replaced') statusLine = 'Replaced';
  else if (offer.status === 'expired') statusLine = 'Expired';
  else if (offer.status === 'closed') statusLine = 'Item no longer available';

  const accent =
    offer.status === 'accepted' || offer.status === 'paid' ? 'var(--color-success)' : 'var(--color-ink)';

  return (
    <div style={{ display: 'flex', justifyContent: sentByMe ? 'flex-end' : 'flex-start', flexShrink: 0 }}>
      <div style={{ ...s.card, opacity: faded ? 0.6 : 1 }}>
        <p style={s.label}>{proposer}</p>
        <p style={{ ...s.amount, color: accent }}>{fmt(offer.amount)}</p>
        <p style={s.asking}>Asking {fmt(offer.askingPrice)}</p>
                {isSeller && ['pending', 'accepted', 'paid'].includes(offer.status) && (
          <FeePreview
            category={category}
            amount={offer.amount}
            lead={offer.status === 'pending' ? "If accepted, you'll receive" : undefined}
            style={{ margin: '6px 0 0' }}
          />
        )}
        {statusLine && <p style={{ ...s.status, color: accent }}>{statusLine}</p>}

        {pending && !mine && (
          <div style={s.actions}>
            <button type="button" disabled={busy} onClick={() => run(onAccept)} style={{ ...s.btn, ...s.accept }}>
              Accept
            </button>
            <button type="button" disabled={busy} onClick={() => onCounter(offer)} style={{ ...s.btn, ...s.counter }}>
              Counter
            </button>
            <button type="button" disabled={busy} onClick={() => run(onDecline)} style={{ ...s.btn, ...s.decline }}>
              Decline
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const s = {
  card: {
    width: 250,
    maxWidth: '85%',
    padding: '12px 14px',
    borderRadius: 14,
    background: 'var(--color-card)',
    border: '1px solid var(--color-border)',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    boxSizing: 'border-box',
  },
  label: { margin: 0, fontSize: 12, color: 'var(--color-muted)' },
  amount: { margin: '2px 0', fontSize: 22, fontWeight: 700 },
  asking: { margin: 0, fontSize: 12, color: 'var(--color-muted)' },
  status: { margin: '8px 0 0', fontSize: 12, fontWeight: 600 },
  actions: { display: 'flex', gap: 6, marginTop: 10 },
  btn: {
    flex: 1,
    minWidth: 0,
    padding: '8px 4px',
    fontSize: 13,
    fontWeight: 600,
    borderRadius: 8,
    cursor: 'pointer',
    border: '1px solid var(--color-border)',
  },
  accept: { background: 'var(--color-primary)', color: '#fff', border: '1px solid var(--color-primary)' },
  counter: { background: 'var(--color-card)', color: 'var(--color-ink)' },
  decline: { background: 'var(--color-card)', color: 'var(--color-warning)' },
};