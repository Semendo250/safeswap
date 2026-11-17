// One tick = sent, two ticks = delivered, two coloured ticks = read
export default function ChatTicks({
  read = false,
  delivered = false,
  size = 15,
  readColor = 'var(--color-teal)',
  idleColor = 'var(--color-muted)',
}) {
  const double = read || delivered;
  return (
    <svg
      width={size}
      height={Math.round(size * 0.6)}
      viewBox="0 0 20 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label={read ? 'Read' : double ? 'Delivered' : 'Sent'}
      style={{ color: read ? readColor : idleColor, flexShrink: 0 }}
    >
      <path d="M1.5 6.5l3.5 3.5 7.5-8.5" />
      {double && <path d="M7 6.5l3.5 3.5 7.5-8.5" />}
    </svg>
  );
}