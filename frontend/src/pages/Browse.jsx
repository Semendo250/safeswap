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
        /* Two columns on phones, three on tablets, four on wide screens */
        .browse-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }
        .browse-filters { display: grid; gap: 10px; margin: 4px 0 14px; }
        .browse-row { display: flex; gap: 10px; flex-wrap: wrap; align-items: flex-end; }
        .browse-field { flex: 1 1 110px; min-width: 0; }
        .browse-label {
          display: block; margin-bottom: 2px; font-size: 11px; font-weight: 600;
          text-transform: uppercase; letter-spacing: 0.04em; color: var(--color-muted);
        }
        .browse-filters input, .browse-filters select { width: 100%; box-sizing: border-box; }

        /* Listing card: big photo on top, price, title and seller underneath */
        a.lc-card {
          display: flex; flex-direction: column; min-width: 0; overflow: hidden;
          border: 1px solid var(--color-border); border-radius: 12px;
          background: var(--color-card); text-decoration: none;
          transition: border-color 0.15s, transform 0.1s;
        }
        a.lc-card:hover { border-color: var(--color-teal); text-decoration: none; }
        a.lc-card:active { transform: scale(0.985); }
        .lc-photo { position: relative; width: 100%; aspect-ratio: 1 / 1; background: var(--color-surface); }
        .lc-photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .lc-unavail .lc-photo img { opacity: 0.55; }
        .lc-heart { position: absolute; top: 6px; right: 6px; }
        .lc-status { position: absolute; left: 8px; bottom: 8px; }
        .lc-body { display: flex; flex-direction: column; gap: 3px; min-width: 0; padding: 10px 12px 12px; }
        .lc-price { font-size: 16px; font-weight: 700; color: var(--color-primary); }
        .lc-title {
          font-size: 14px; font-weight: 600; line-height: 1.3; min-height: 2.6em;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
          overflow: hidden; word-break: break-word; color: var(--color-ink);
        }
        .lc-meta {
          display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 2px;
          font-size: 12px; color: var(--color-muted);
        }
        .lc-seller { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        @media (min-width: 700px) {
          .browse-page { max-width: 900px; padding: 28px 24px 70px; }
          .browse-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
        }
        @media (min-width: 1100px) {
          .browse-page { max-width: 1180px; }
          .browse-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
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
          <ListingCard key={listing._id} listing={listing} variant="card" />
        ))}
      </div>
    </div>
  );
}