export default function VerificationBadge({ verificationPath }) {
  const isPrimary = verificationPath === 'university_email';

  return (
    <span
      style={{
        fontSize: '12px',
        fontWeight: 500,
        color: isPrimary ? '#1e40af' : '#6b7280',
        background: isPrimary ? '#dbeafe' : '#f3f4f6',
        padding: '2px 8px',
        borderRadius: '6px',
      }}
    >
      {isPrimary ? 'University verified' : 'Fallback verified'}
    </span>
  );
}