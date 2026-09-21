import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { getOverview } from '../../api/admin.api';

export default function Dashboard() {
  const { user, loading: authLoading } = useContext(AuthContext);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    // Wait until we know who is logged in before asking for admin data
    if (authLoading || !user) return;
    let cancelled = false;
    setError('');
    getOverview()
      .then((res) => {
        if (!cancelled) setStats(res.data);
      })
      .catch((err) => {
        if (cancelled) return;
        const status = err.response?.status;
        let message;
        if (!err.response) message = 'Network error. Check your connection and try again.';
        else if (status === 401) message = 'Your session has expired. Please log in again.';
        else if (status === 403) message = 'This page is for admins only.';
        else message = err.response?.data?.error || 'Could not load the dashboard.';
        setError(status ? `${message} (status ${status})` : message);
      });
    return () => {
      cancelled = true;
    };
  }, [authLoading, user?.id]);

  if (authLoading) {
    return (
      <div className="container">
        <p style={{ color: 'var(--color-muted)' }}>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container">
        <p style={{ color: 'var(--color-warning)' }}>Please log in as an admin to view this page.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container">
        <p style={{ color: 'var(--color-warning)' }}>{error}</p>
      </div>
    );
  }

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
    </div>
  );
}