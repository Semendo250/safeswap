import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getOverview } from '../../api/admin.api';

export default function Dashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    getOverview().then((res) => setStats(res.data));
  }, []);

  if (!stats) {
    return (
      <div className="container">
        <p style={{ color: 'var(--color-muted)' }}>Loading...</p>
      </div>
    );
  }

  const cards = [
    { label: 'Active listings', value: stats.activeListings },
    { label: 'Pending reviews', value: stats.pendingReviews },
    { label: 'Open reports', value: stats.openReports },
    { label: 'Signups today', value: stats.signupsToday },
  ];

  return (
    <div className="container">
      <h2 style={{ textAlign: 'center' }}>Admin dashboard</h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '24px' }}>
        {cards.map((c) => (
          <div
            key={c.label}
            style={{
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius)',
              padding: '14px',
              background: 'var(--color-surface)',
            }}
          >
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-muted)' }}>{c.label}</p>
            <p style={{ margin: '4px 0 0', fontSize: '22px', fontWeight: 700, color: 'var(--color-primary)' }}>{c.value}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <Link to="/admin/flagged" className="nav-pill" style={{ textAlign: 'center' }}>
          Flagged listings &rarr;
        </Link>
        <Link to="/admin/verification" className="nav-pill" style={{ textAlign: 'center' }}>
          Verification queue &rarr;
        </Link>
        <Link to="/admin/blacklist" className="nav-pill" style={{ textAlign: 'center' }}>
          IMEI blacklist &rarr;
        </Link>
      </div>
    </div>
  );
}