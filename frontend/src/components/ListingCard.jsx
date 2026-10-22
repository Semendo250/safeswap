import { useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import FavoriteButton from './FavoriteButton';
import FeePreview from './FeePreview';

function statusLabel(l) {
  if (!l.status || l.status === 'active') return '';
  if (l.status === 'unavailable') return l.unavailableReason === 'sold_elsewhere' ? 'Sold elsewhere' : 'Unavailable';
  if (l.status === 'sold') return 'Sold';
  if (l.status === 'expired') return 'Expired';
  return 'Not available';
}

export default function ListingCard({ listing, onFavoriteChange }) {
  const { user } = useContext(AuthContext);
  const own = user && listing.seller && String(listing.seller._id) === String(user.id);
  const showHeart = user?.role !== 'admin' && !own;
  const unavailable = statusLabel(listing);

  return (
    <Link to={`/listings/${listing._id}`} className="divider-row" style={{ color: 'inherit' }}>
      <img
        src={listing.photos?.[0]}
        alt={listing.title}
        style={{ width: '68px', height: '68px', objectFit: 'cover', borderRadius: 'var(--radius)', flexShrink: 0, border: '1px solid var(--color-border)' }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600 }}>{listing.title}</span>
          {listing.category === 'phone' && listing.imeiStatus === 'clean' && (
            <span className="badge badge-gold">Verified</span>
          )}
          {unavailable && <span className="badge">{unavailable}</span>}
        </div>
        <p style={{ margin: '3px 0 0', fontSize: '13px', color: 'var(--color-muted)' }}>
          KES {Number(listing.price).toLocaleString()} &middot; {listing.seller?.fullName}
        </p>
                {own && (!listing.status || listing.status === 'active') && (
          <FeePreview category={listing.category} amount={listing.price} compact />
        )}
      </div>
      {showHeart && (
        <FavoriteButton
          listingId={listing._id}
          initial={!!listing.isFavorite}
          variant="icon"
          onChange={(v) => onFavoriteChange && onFavoriteChange(listing._id, v)}
        />
      )}
    </Link>
  );
}