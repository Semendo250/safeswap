import { useEffect, useRef, useState } from 'react';

// ---------- helpers ----------

export function errText(err, fallback = 'Something went wrong') {
  if (!err || !err.response) return 'Network error. Check your connection and try again.';
  const data = err.response.data;
  if (data && typeof data.error === 'string' && data.error) return data.error;
  return fallback;
}

export function fmtDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

export function money(n) {
  if (n === null || n === undefined) return '-';
  return `KES ${Number(n).toLocaleString()}`;
}

export function useDebounced(value, delay = 400) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

// ---------- look ----------

const TONES = {
  success: { background: 'var(--color-success-bg)', color: 'var(--color-success)' },
  warning: { background: 'var(--color-warning-bg)', color: 'var(--color-warning)' },
  gold: { background: 'var(--color-gold-bg)', color: 'var(--color-gold)' },
  muted: { background: 'var(--color-border)', color: 'var(--color-muted)' },
  teal: { background: 'color-mix(in srgb, var(--color-teal) 12%, #fff)', color: 'var(--color-teal)' },
};

export const LISTING_TONE = { active: 'success', under_review: 'gold', removed: 'warning', sold: 'teal' };
export const PAYMENT_TONE = { pending: 'gold', held: 'teal', released: 'success', failed: 'warning', refunded: 'muted' };

export function Chip({ tone = 'muted', children }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontSize: 11,
        fontWeight: 600,
        padding: '2px 8px',
        borderRadius: 999,
        whiteSpace: 'nowrap',
        ...TONES[tone],
      }}
    >
      {children}
    </span>
  );
}

// Button styles. minWidth 0 overrides the 110px minimum that index.css gives every button.
export function btn(kind = 'outline', extra) {
  const base = {
    minWidth: 0,
    alignSelf: 'auto',
    padding: '7px 12px',
    fontSize: 13,
    fontWeight: 600,
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    lineHeight: 1.2,
  };
  const kinds = {
    primary: { background: 'var(--color-primary)', color: '#fff', border: '1px solid var(--color-primary)' },
    outline: { background: '#fff', color: 'var(--color-ink)', border: '1px solid var(--color-border)' },
    danger: { background: '#fff', color: 'var(--color-warning)', border: '1px solid var(--color-warning)' },
    dangerSolid: { background: 'var(--color-warning)', color: '#fff', border: '1px solid var(--color-warning)' },
  };
  return { ...base, ...kinds[kind], ...extra };
}

export function PageShell({ title, subtitle, children }) {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '20px 16px 60px', boxSizing: 'border-box' }}>
      <h2 style={{ textAlign: 'center', margin: '0 0 4px' }}>{title}</h2>
      {subtitle && (
        <p style={{ textAlign: 'center', margin: '0 0 14px', fontSize: 13, color: 'var(--color-muted)' }}>
          {subtitle}
        </p>
      )}
      {children}
    </div>
  );
}

export function Tabs({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '4px 0', margin: '10px 0' }}>
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          style={btn(value === v ? 'primary' : 'outline', { borderRadius: 999, whiteSpace: 'nowrap', flexShrink: 0 })}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function Pager({ page, pages, onPage }) {
  if (pages <= 1) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, margin: '16px 0' }}>
      <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} style={btn('outline')}>
        Previous
      </button>
      <span style={{ fontSize: 13, color: 'var(--color-muted)' }}>
        Page {page} of {pages}
      </span>
      <button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)} style={btn('outline')}>
        Next
      </button>
    </div>
  );
}

// A message bar that clears itself after 7 seconds
export function Notice({ tone = 'success', children, onClose }) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!closeRef.current) return;
    const t = setTimeout(() => closeRef.current && closeRef.current(), 7000);
    return () => clearTimeout(t);
  }, [children]);

  return (
    <div
      role="status"
      style={{
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        margin: '10px 0',
        padding: '10px 12px',
        borderRadius: 8,
        fontSize: 13,
        ...TONES[tone],
      }}
    >
      <span>{children}</span>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss"
          style={{ ...btn('outline'), border: 'none', background: 'transparent', color: 'inherit', padding: '0 4px' }}
        >
          ✕
        </button>
      )}
    </div>
  );
}

// A label + value line
export function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', gap: 8, fontSize: 13, padding: '2px 0' }}>
      <span style={{ color: 'var(--color-muted)', minWidth: 96, flexShrink: 0 }}>{label}</span>
      <span style={{ minWidth: 0, wordBreak: 'break-word' }}>{children}</span>
    </div>
  );
}

// Text with a Copy button (long-press copying is switched off app-wide)
export function CopyText({ value, children }) {
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
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', wordBreak: 'break-all' }}>
      <span>{children || value}</span>
      <button type="button" onClick={copy} style={{ ...btn('outline'), padding: '1px 6px', fontSize: 11 }}>
        {copied ? 'Copied' : 'Copy'}
      </button>
    </span>
  );
}

// ---------- dialogs ----------

export function Modal({ title, children, onClose, busy = false }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape' && !busy) onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, busy]);

  return (
    <div
      onClick={() => {
        if (!busy) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 20,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
                style={{
          background: 'var(--color-card)',
          borderRadius: 16,
          padding: 24,
          width: '100%',
          maxWidth: 400,
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 8px 40px rgba(0,0,0,0.15)',
        }}
      >
        <h3 style={{ margin: '0 0 8px', fontSize: 18 }}>{title}</h3>
        {children}
      </div>
    </div>
  );
}

// askReason: false | 'optional' | 'required'
// onConfirm(reason) should return a promise. If it throws, the error shows in the dialog.
// The parent closes the dialog when onConfirm succeeds.
export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  danger = false,
  askReason = false,
  minReason = 3,
  onConfirm,
  onCancel,
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const blocked = askReason === 'required' && reason.trim().length < minReason;

  async function submit() {
    if (busy || blocked) return;
    setBusy(true);
    setError('');
    try {
      await onConfirm(reason.trim());
    } catch (err) {
      setError(errText(err));
      setBusy(false);
    }
  }

  return (
    <Modal title={title} onClose={onCancel} busy={busy}>
      {message && (
        <p style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--color-muted)', lineHeight: 1.5 }}>{message}</p>
      )}
      {askReason && (
        <textarea
          rows={3}
          maxLength={300}
          placeholder={askReason === 'required' ? 'Reason (required)' : 'Reason (optional)'}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          style={{ marginBottom: 10 }}
        />
      )}
      {error && <p style={{ color: 'var(--color-warning)', fontSize: 13, margin: '0 0 10px' }}>{error}</p>}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onCancel} disabled={busy} style={btn('outline', { padding: '9px 16px' })}>
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={busy || blocked}
          style={btn(danger ? 'dangerSolid' : 'primary', { padding: '9px 16px' })}
        >
          {busy ? 'Working...' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

// ---------- photos ----------

// images: [{ src, label }]
export function PhotoLightbox({ images, startIndex = 0, onClose }) {
  const [i, setI] = useState(startIndex);
  const count = images.length;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') closeRef.current();
      else if (e.key === 'ArrowRight') setI((n) => (n + 1) % count);
      else if (e.key === 'ArrowLeft') setI((n) => (n - 1 + count) % count);
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [count]);

  const current = images[i];
  if (!current) return null;

  const arrow = {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    width: 40,
    height: 40,
    minWidth: 0,
    padding: 0,
    borderRadius: '50%',
    border: 'none',
    background: 'rgba(255,255,255,0.18)',
    color: '#fff',
    fontSize: 26,
    lineHeight: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Photo preview"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.92)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: 16,
        boxSizing: 'border-box',
      }}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close preview"
        style={{
          ...arrow,
          top: 'calc(env(safe-area-inset-top, 0px) + 12px)',
          right: 12,
          transform: 'none',
          fontSize: 20,
        }}
      >
        ✕
      </button>

      {count > 1 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setI((n) => (n - 1 + count) % count);
          }}
          aria-label="Previous photo"
          style={{ ...arrow, left: 10 }}
        >
          ‹
        </button>
      )}

      <img
        src={current.src}
        alt={current.label || ''}
        draggable={false}
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '92vw', maxHeight: '80vh', objectFit: 'contain', borderRadius: 8, display: 'block' }}
      />

      {count > 1 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setI((n) => (n + 1) % count);
          }}
          aria-label="Next photo"
          style={{ ...arrow, right: 10 }}
        >
          ›
        </button>
      )}

      <div
        style={{
          position: 'absolute',
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
          left: 0,
          right: 0,
          textAlign: 'center',
          color: 'rgba(255,255,255,0.85)',
          fontSize: 13,
        }}
      >
        {current.label}
        {count > 1 ? ` (${i + 1} / ${count})` : ''}
      </div>
    </div>
  );
}

// A small tappable photo with a caption
export function Thumb({ src, label, onClick, size = 72 }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`View ${label}`}
      style={{
        padding: 0,
        minWidth: 0,
        width: size,
        alignSelf: 'auto',
        border: '1px solid var(--color-border)',
        background: '#fff',
        borderRadius: 8,
        overflow: 'hidden',
        cursor: 'zoom-in',
        textAlign: 'left',
      }}
    >
      <img src={src} alt={label} style={{ width: '100%', height: size, objectFit: 'cover', display: 'block' }} />
      <span
        style={{
          display: 'block',
          fontSize: 10,
          color: 'var(--color-muted)',
          padding: '2px 4px',
          lineHeight: 1.2,
          fontWeight: 400,
        }}
      >
        {label}
      </span>
    </button>
  );
}