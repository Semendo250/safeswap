import { Link } from 'react-router-dom';

export default function VerifyOtp() {
  return (
    <div className="container">
      <div className="status-page">
        <div className="status-card tone-gold" role="status">
          <div className="status-icon pulse">
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
          </div>
          <span className="status-pill">In review</span>
          <h2 className="status-title">Waiting for approval</h2>
          <p className="status-text">
            Your details have been submitted. An admin will review your account and you will be notified once it is
            approved. You don't need to enter any code.
          </p>

          <ol className="status-steps">
            <li className="done">
              <span className="dot">&#10003;</span>
              Details submitted
            </li>
            <li className="current">
              <span className="dot" />
              Admin review
            </li>
            <li>
              <span className="dot" />
              Account approved
            </li>
          </ol>

          <div className="status-actions">
            <Link to="/login" className="status-btn-outline">
              Already approved? Log in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}