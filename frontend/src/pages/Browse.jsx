import { useState, useEffect } from 'react';
import CategoryTabs from '../components/CategoryTabs';
import ListingCard from '../components/ListingCard';
import { getListings } from '../api/listings.api';

export default function Browse() {
  const [category, setCategory] = useState('phone');
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getListings(category)
      .then((res) => setListings(res.data))
      .finally(() => setLoading(false));
  }, [category]);

  return (
    <div className="container">
      <h1 style={{ fontSize: '26px', marginBottom: '18px' }}>Browse listings</h1>
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