import { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { getMyListings } from '../api/listings.api';
import BackButton from '../components/BackButton';
import TrustBadge from '../components/TrustBadge';
import VerificationBadge from '../components/VerificationBadge';

export default function Profile() {
  const { user } = useContext(AuthContext);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyListings()
      .then((res) => setListings(res.data))
      .finally(() => setLoading(false));
  }, []);

  const sold = listings.filter((l) => l.status === 'sold');
  const pending = listings.filter((l) => l.status === 'active' || l.status === 'under_review');

  return (
    <div className="container">
      <BackButton />
      <h2>Profile</h2>

      <div className="divider-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
        <span style={{ fontWeight: 600, fontSize: '16px' }}>{user?.fullName}</span>
        <span style={{ color: 'var(--color-muted)', fontSize: '13px' }}>{user?.email}</span>
        <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
          <TrustBadge score={user?.trustScore} />
          <VerificationBadge verificationPath={user?.verificationPath} />
        </div>
      </div>

      <div style={{ marginTop: '20px' }}>
        <h3 style={{ fontSize: '16px' }}>Sales</h3>

        {loading && <p style={{ color: 'var(--color-muted)' }}>Loading...</p>}

        {!loading && listings.length === 0 && (
          <div style={{ padding: '16px 0' }}>
            <p style={{ color: 'var(--color-muted)' }}>You haven't made any listings yet.</p>
            <Link to="/create-listing" className="nav-pill" style={{ marginTop: '8px', display: 'inline-block' }}>
              Click to start
            </Link>
          </div>
        )}

        {!loading && listings.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
            <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius)', padding: '10px' }}>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-muted)' }}>Successful sales</p>
              <p style={{ margin: '2px 0 0', fontSize: '20px', fontWeight: 700 }}>{sold.length}</p>
            </div>
            <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius)', padding: '10px' }}>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-muted)' }}>Pending listings</p>
              <p style={{ margin: '2px 0 0', fontSize: '20px', fontWeight: 700 }}>{pending.length}</p>
            </div>
          </div>
        )}

        {listings.map((l) => (
          <div key={l._id} className="divider-row">
            <div style={{ flex: 1 }}>
              <span style={{ fontWeight: 600 }}>{l.title}</span>
              <p style={{ margin: '2px 0 0', fontSize: '13px', color: 'var(--color-muted)' }}>
                KES {l.price} &middot; {l.status}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}