import { useState } from 'react';
import FeePreview from './FeePreview';

export default function OfferSheet({ title, askingPrice, initial, onSubmit, onClose, showFee = false, category }) {
  const [value, setValue] = useState(initial ? String(initial) : '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    const amount = Number(value);
    if (!Number.isInteger(amount) || amount < 1) {
      setError('Enter a whole number above zero');
      return;
    }
    if (amount > askingPrice) {
      setError(`Can't be higher than the asking price (KES ${Number(askingPrice).toLocaleString()})`);
      return;
    }
    setBusy(true);
    setError('');
    const problem = await onSubmit(amount);
    setBusy(false);
    if (problem) setError(problem);
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <form style={s.sheet} onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <p style={s.title}>{title}</p>
        <p style={s.asking}>Asking price: KES {Number(askingPrice).toLocaleString()}</p>
        <input
          autoFocus
          type="number"
          inputMode="numeric"
          min="1"
          step="1"
          placeholder="Amount in KES"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          style={s.input}
        />
        {error && <p style={s.error}>{error}</p>}
                        {showFee && <FeePreview category={category} amount={value} lead="If accepted, you'll receive" />}
        <p style={s.hint}>Agree the price here so payment matches.</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={onClose} style={{ ...s.btn, ...s.cancel }}>
            Cancel
          </button>
          <button type="submit" disabled={busy} style={{ ...s.btn, ...s.send }}>
            {busy ? 'Sending...' : 'Send offer'}
          </button>
        </div>
      </form>
    </div>
  );
}

const s = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.4)',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    zIndex: 1000,
    padding: 20,
  },
  sheet: {
    background: 'var(--color-card)',
    borderRadius: 16,
    padding: '20px 24px',
    width: '100%',
    maxWidth: 360,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    boxSizing: 'border-box',
    boxShadow: '0 -4px 24px rgba(0,0,0,0.1)',
  },
  title: { margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--color-ink)', textAlign: 'center' },
  asking: { margin: 0, fontSize: 13, color: 'var(--color-muted)', textAlign: 'center' },
  input: { width: '100%', boxSizing: 'border-box', height: 46, fontSize: 16, padding: '0 12px' },
  error: { margin: 0, fontSize: 13, color: 'var(--color-warning)' },
  hint: { margin: 0, fontSize: 12, color: 'var(--color-muted)' },
  btn: { flex: 1, minWidth: 0, padding: 11, borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  cancel: { background: 'var(--color-card)', border: '0.5px solid var(--color-border)', color: 'var(--color-muted)' },
  send: { background: 'var(--color-primary)', border: 'none', color: '#fff' },
};