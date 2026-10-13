export default function VerificationBadge({ verificationPath, icon = false }) {
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
          <circle cx="12" cy="12" r="10" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      )}
      {isPrimary ? 'University verified' : 'Fallback verified'}
    </span>
  );
}