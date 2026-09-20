import { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import CategoryTabs from '../components/CategoryTabs';
import ListingCard from '../components/ListingCard';
import HeroBackground from '../components/HeroBackground';
import { getListings } from '../api/listings.api';

export default function Home() {
  const { user, loading: authLoading } = useContext(AuthContext);
  const [category, setCategory] = useState('phone');
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getListings(category)
      .then((res) => setListings(res.data))
      .finally(() => setLoading(false));
  }, [category]);

  if (authLoading) return null;

  if (!user) {
    return (
      <div
        style={{
          position: 'relative',
          overflow: 'hidden',
          minHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '40px 20px',
          background: 'linear-gradient(180deg, var(--color-surface) 0%, #fff 100%)',
        }}
      >
        <HeroBackground />

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'var(--color-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '20px',
            }}
          >
            <span style={{ color: '#fff', fontSize: '28px', fontWeight: 700 }}>S</span>
          </div>

          <h1 style={{ fontSize: '28px', maxWidth: '360px', lineHeight: 1.3 }}>
            Welcome to SafeSwap
          </h1>
          <p style={{ color: 'var(--color-muted)', maxWidth: '320px', margin: '10px 0 28px', fontSize: '15px' }}>
            Home for verified secondhand products around Maseno University.
          </p>

          <Link
            to="/signup"
            style={{
              background: 'var(--color-primary)',
              color: '#fff',
              padding: '12px 28px',
              borderRadius: 'var(--radius)',
              fontWeight: 600,
              fontSize: '15px',
            }}
          >
            Sign up to get started
          </Link>

          <p style={{ marginTop: '16px', fontSize: '13px', color: 'var(--color-muted)' }}>
            Already have an account? <Link to="/login">Log in</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <h1 style={{ fontSize: '26px', marginBottom: '18px' }}>SafeSwap</h1>
      <CategoryTabs value={category} onChange={setCategory} />

      {loading && <p style={{ color: 'var(--color-muted)' }}>Loading...</p>}
      {!loading && listings.length === 0 && (
        <p style={{ color: 'var(--color-muted)' }}>No listings yet in this category.</p>
      )}

      <div>
        {listings.map((listing) => (
          <ListingCard key={listing._id} listing={listing} />
        ))}
      </div>
    </div>
  );
}