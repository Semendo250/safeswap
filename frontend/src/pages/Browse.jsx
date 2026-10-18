import { useState, useEffect } from 'react';
import CategoryTabs from '../components/CategoryTabs';
import ListingCard from '../components/ListingCard';
import { getListings } from '../api/listings.api';

function useDebounced(value, delay = 400) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

export default function Browse() {
  const [category, setCategory] = useState('phone');
  const [search, setSearch] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sort, setSort] = useState('newest');
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const dSearch = useDebounced(search);
  const dMin = useDebounced(minPrice);
  const dMax = useDebounced(maxPrice);

  const filtersActive = !!(dSearch.trim() || dMin || dMax || sort !== 'newest');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    getListings(category, { search: dSearch.trim(), minPrice: dMin, maxPrice: dMax, sort })
      .then((res) => {
        if (!cancelled) setListings(res.data);
      })
      .catch(() => {
        if (!cancelled) {
          setListings([]);
          setError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [category, dSearch, dMin, dMax, sort, reloadKey]);

  useEffect(() => {
    function handleOnline() {
      setReloadKey((k) => k + 1);
    }
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  function clearFilters() {
    setSearch('');
    setMinPrice('');
    setMaxPrice('');
    setSort('newest');
  }

  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;

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
        .browse-filters { display: grid; gap: 10px; margin: 4px 0 14px; }
        .browse-row { display: flex; gap: 10px; flex-wrap: wrap; align-items: flex-end; }
        .browse-field { flex: 1 1 110px; min-width: 0; }
        .browse-label {
          display: block; margin-bottom: 2px; font-size: 11px; font-weight: 600;
          text-transform: uppercase; letter-spacing: 0.04em; color: var(--color-muted);
        }
        .browse-filters input, .browse-filters select { width: 100%; box-sizing: border-box; }
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

      <div className="browse-filters">
        <input
          type="search"
          placeholder="Search listings, e.g. Samsung, charger, laptop"
          value={search}
          maxLength={60}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="browse-row">
          <div className="browse-field">
            <label className="browse-label">Min price</label>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              placeholder="KES"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
            />
          </div>
          <div className="browse-field">
            <label className="browse-label">Max price</label>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              placeholder="KES"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
            />
          </div>
          <div className="browse-field">
            <label className="browse-label">Sort by</label>
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="newest">Newest</option>
              <option value="cheapest">Cheapest first</option>
              <option value="expensive">Most expensive first</option>
            </select>
          </div>
        </div>
        {filtersActive && (
          <div>
            <button
              type="button"
              onClick={clearFilters}
              style={{ minWidth: 0, padding: '6px 12px', fontSize: 13 }}
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {loading && <p style={{ color: 'var(--color-muted)' }}>Loading...</p>}

      {!loading && error && (
        <div style={{ color: 'var(--color-muted)' }}>
          <p>
            {offline
              ? "You're offline. Listings will load when you're back online."
              : "Couldn't load listings. Check your connection and try again."}
          </p>
          <button type="button" onClick={() => setReloadKey((k) => k + 1)}>
            Try again
          </button>
        </div>
      )}

      {!loading && !error && listings.length === 0 && (
        <p style={{ color: 'var(--color-muted)' }}>
          {filtersActive ? 'No listings match your search. Try different words or clear the filters.' : 'No listings yet in this category.'}
        </p>
      )}

      <div className="browse-grid">
        {listings.map((listing) => (
          <ListingCard key={listing._id} listing={listing} />
        ))}
      </div>
    </div>
  );
}