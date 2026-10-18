import { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import BackButton from '../components/BackButton';
import ListingCard from '../components/ListingCard';
import { getFavorites } from '../api/favorites.api';

export default function Saved() {
  const { user, loading: authLoading } = useContext(AuthContext);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    getFavorites()
      .then((res) => {
        if (!cancelled) setItems(res.data.listings || []);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(!err.response ? 'Network error. Check your connection.' : err.response.data?.error || 'Could not load saved items.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authLoading, user?.id]);

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '20px 16px 60px' }}>
      <BackButton />
      <h2 style={{ margin: '14px 0 4px', textAlign: 'left' }}>Saved items</h2>
      <p style={{ margin: '0 0 18px', fontSize: 14, color: 'var(--color-muted)' }}>
        You get a notification if the price of a saved item drops.
      </p>

      {authLoading || (user && loading) ? (
        <p style={{ color: 'var(--color-muted)' }}>Loading...</p>
      ) : !user ? (
        <p>
          <Link to="/login" state={{ from: '/saved' }}>
            Log in
          </Link>{' '}
          to see your saved items.
        </p>
      ) : error ? (
        <p style={{ color: 'var(--color-warning)', fontSize: 14 }}>{error}</p>
      ) : items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 16px', border: '1px dashed var(--color-border)', borderRadius: 12 }}>
          <p style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--color-muted)' }}>
            Tap the heart on a listing to save it here.
          </p>
          <Link to="/browse">Browse listings</Link>
        </div>
      ) : (
        items.map((l) => (
          <ListingCard
            key={l._id}
            listing={l}
            onFavoriteChange={(listingId, saved) => {
              if (!saved) setItems((prev) => prev.filter((x) => x._id !== listingId));
            }}
          />
        ))
      )}
    </div>
  );
}