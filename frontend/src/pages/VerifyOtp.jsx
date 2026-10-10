import { Link } from 'react-router-dom';

export default function VerifyOtp() {
  return (
    <div className="container">
      <div
        style={{
          minHeight: '60vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: '72px',
            height: '72px',
            borderRadius: '50%',
            background: 'var(--color-gold-bg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '20px',
          }}
        >
          <span style={{ fontSize: '34px' }}>&#9203;</span>
        </div>
        <h2 style={{ fontSize: '20px', margin: '0 0 10px' }}>Waiting for approval</h2>
        <p style={{ color: 'var(--color-muted)', maxWidth: '320px', lineHeight: 1.5 }}>
          Your details have been submitted. An admin will review your account and you will be notified once it is
          approved. You don't need to enter any code.
        </p>
        <p style={{ marginTop: '18px', fontSize: '13px' }}>
          Already approved? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}