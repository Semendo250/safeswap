export default function TrustBadge({ score, icon = false }) {
  const value = score ?? 50;
  const tone = value >= 70 ? 'success' : value >= 40 ? 'gold' : 'warning';
  const colors = {
    success: { color: 'var(--color-success)', bg: 'var(--color-success-bg)' },
    gold: { color: 'var(--color-gold)', bg: 'var(--color-gold-bg)' },
    warning: { color: 'var(--color-warning)', bg: 'var(--color-warning-bg)' },
  }[tone];

  return (
    <span
      style={{
        fontSize: '12px',
        fontWeight: 600,
        color: colors.color,
        background: colors.bg,
        padding: icon ? '3px 10px' : '2px 8px',
        borderRadius: icon ? '999px' : '6px',
        display: icon ? 'inline-flex' : undefined,
        alignItems: icon ? 'center' : undefined,
        gap: icon ? '5px' : undefined,
      }}
    >
      {icon && (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      )}
      Trust {value}/100
    </span>
  );
}