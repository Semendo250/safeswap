export default function TrustBadge({ score }) {
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
        padding: '2px 8px',
        borderRadius: '6px',
      }}
    >
      Trust {value}/100
    </span>
  );
}