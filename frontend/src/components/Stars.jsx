export function Stars({ value = 0, size = 14 }) {
  const full = Math.max(0, Math.min(5, Math.round(value)));
  return (
    <span aria-label={`${value} out of 5`} style={{ color: 'var(--color-gold)', fontSize: size, letterSpacing: 1 }}>
      {'★'.repeat(full)}
      <span style={{ color: 'var(--color-border)' }}>{'★'.repeat(5 - full)}</span>
    </span>
  );
}

export function StarInput({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          aria-label={`${n} star${n === 1 ? '' : 's'}`}
          onClick={() => onChange(n)}
          style={{
            minWidth: 0,
            padding: 0,
            width: 36,
            height: 36,
            border: 'none',
            background: 'transparent',
            fontSize: 28,
            lineHeight: 1,
            cursor: 'pointer',
            color: n <= value ? 'var(--color-gold)' : 'var(--color-border)',
          }}
        >
          ★
        </button>
      ))}
    </div>
  );
}