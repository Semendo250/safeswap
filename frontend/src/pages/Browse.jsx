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
    <div className="browse-page">
      <style>{`
        .browse-page {
          max-width: 480px;
          margin: 0 auto;
          padding: 20px 16px 60px;
          box-sizing: border-box;
        }
        .browse-grid {
          display: block;
        }
        .browse-grid > a {
          display: flex;
        }
        @media (min-width: 700px) {
          .browse-page { max-width: 900px; padding: 28px 24px 70px; }
          .browse-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 14px;
          }
          .browse-grid > a {
            border-bottom: none !important;
            border: 1px solid var(--color-border);
            border-radius: 12px;
            padding: 12px !important;
            background: var(--color-card);
          }
        }
        @media (min-width: 1100px) {
          .browse-page { max-width: 1180px; }
          .browse-grid { grid-template-columns: repeat(3, 1fr); gap: 16px; }
        }
      `}</style>

      <h1 style={{ fontSize: '26px', marginBottom: '18px' }}>Browse listings</h1>
      <CategoryTabs value={category} onChange={setCategory} />

      {loading && <p style={{ color: 'var(--color-muted)' }}>Loading...</p>}
      {!loading && listings.length === 0 && (
        <p style={{ color: 'var(--color-muted)' }}>No listings yet in this category.</p>
      )}

      <div className="browse-grid">
        {listings.map((listing) => (
          <ListingCard key={listing._id} listing={listing} />
        ))}
      </div>
    </div>
  );
}