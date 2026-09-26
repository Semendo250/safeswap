export default function VerificationBadge({ verificationPath }) {
  const isPrimary = verificationPath === 'university_email';

  return (
    <span
      style={{
        fontSize: '12px',
        fontWeight: 500,
        color: isPrimary ? 'var(--color-teal)' : 'var(--color-muted)',
        background: isPrimary
          ? 'color-mix(in srgb, var(--color-teal) 15%, transparent)'
          : 'var(--color-surface)',
        padding: '2px 8px',
        borderRadius: '6px',
      }}
    >
      {isPrimary ? 'University verified' : 'Fallback verified'}
    </span>
  );
}