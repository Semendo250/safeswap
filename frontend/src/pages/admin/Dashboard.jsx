import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getOverview } from '../../api/admin.api';

export default function Dashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    getOverview().then((res) => setStats(res.data));
  }, []);

  if (!stats) return <p>Loading...</p>;

  const cards = [
    { label: 'Active listings', value: stats.activeListings },
    { label: 'Pending reviews', value: stats.pendingReviews },
    { label: 'Open reports', value: stats.openReports },
    { label: 'Signups today', value: stats.signupsToday },
  ];

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', padding: '1rem' }}>
      <h2>Admin dashboard</h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
        {cards.map((c) => (
          <div key={c.label} style={{ border: '1px solid #e5e7eb', borderRadius: '10px', padding: '10px' }}>
            <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>{c.label}</p>
            <p style={{ margin: '2px 0 0', fontSize: '20px', fontWeight: 600 }}>{c.value}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <Link to="/admin/flagged">Flagged listings &rarr;</Link>
        <Link to="/admin/verification">Verification queue &rarr;</Link>
        <Link to="/admin/blacklist">IMEI blacklist &rarr;</Link>
      </div>
    </div>
  );
}