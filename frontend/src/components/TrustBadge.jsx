export default function TrustBadge({ score }) {
  const value = score ?? 50;
  const color = value >= 70 ? '#166534' : value >= 40 ? '#92400e' : '#991b1b';
  const bg = value >= 70 ? '#dcfce7' : value >= 40 ? '#fef3c7' : '#fee2e2';

  return (
    <span
      style={{
        fontSize: '12px',
        fontWeight: 600,
        color,
        background: bg,
        padding: '2px 8px',
        borderRadius: '6px',
      }}
    >
      Trust {value}/100
    </span>
  );
}