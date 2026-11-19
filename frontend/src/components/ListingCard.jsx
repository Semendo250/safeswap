import { useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import FavoriteButton from './FavoriteButton';
import FeePreview from './FeePreview';
import { optimizeImage } from '../utils/image';

function statusLabel(l) {
  if (!l.status || l.status === 'active') return '';
  if (l.status === 'unavailable') return l.unavailableReason === 'sold_elsewhere' ? 'Sold elsewhere' : 'Unavailable';
  if (l.status === 'sold') return 'Sold';
  if (l.status === 'expired') return 'Expired';
  return 'Not available';
}

// variant "row" is the compact list row (Saved, seller profiles, your listings).
// variant "card" is the big photo card used on Browse.
export default function ListingCard({ listing, onFavoriteChange, variant = 'row' }) {
  const { user } = useContext(AuthContext);
  const own = user && listing.seller && String(listing.seller._id) === String(user.id);
  const showHeart = user?.role !== 'admin' && !own;
  const unavailable = statusLabel(listing);
  const verified = listing.category === 'phone' && listing.imeiStatus === 'clean';
  const showFee = own && (!listing.status || listing.status === 'active');

  const heart = showHeart ? (
    <FavoriteButton
      listingId={listing._id}
      initial={!!listing.isFavorite}
      variant="icon"
      onChange={(v) => onFavoriteChange && onFavoriteChange(listing._id, v)}
    />
  ) : null;

  if (variant === 'card') {
    return (
      <Link
        to={`/listings/${listing._id}`}
        className={unavailable ? 'lc-card lc-unavail' : 'lc-card'}
        style={{ color: 'inherit' }}
      >
        <div className="lc-photo">
          <img
            src={optimizeImage(listing.photos?.[0], 500)}
            alt={listing.title}
            loading="lazy"
            decoding="async"
          />
          {heart && <div className="lc-heart">{heart}</div>}
          {unavailable && <span className="badge lc-status">{unavailable}</span>}
        </div>
        <div className="lc-body">
          <div className="lc-price">KES {Number(listing.price).toLocaleString()}</div>
          <div className="lc-title">{listing.title}</div>
          <div className="lc-meta">
            <span className="lc-seller">{listing.seller?.fullName}</span>
            {verified && <span className="badge badge-gold">Verified</span>}
          </div>
          {showFee && <FeePreview category={listing.category} amount={listing.price} compact />}
        </div>
      </Link>
    );
  }

  return (
    <Link to={`/listings/${listing._id}`} className="divider-row" style={{ color: 'inherit' }}>
      <img
        src={optimizeImage(listing.photos?.[0], 160)}
        alt={listing.title}
        loading="lazy"
        decoding="async"
        style={{ width: '68px', height: '68px', objectFit: 'cover', borderRadius: 'var(--radius)', flexShrink: 0, border: '1px solid var(--color-border)' }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600 }}>{listing.title}</span>
          {verified && <span className="badge badge-gold">Verified</span>}
          {unavailable && <span className="badge">{unavailable}</span>}
        </div>
        <p style={{ margin: '3px 0 0', fontSize: '13px', color: 'var(--color-muted)' }}>
          KES {Number(listing.price).toLocaleString()} &middot; {listing.seller?.fullName}
        </p>
        {showFee && <FeePreview category={listing.category} amount={listing.price} compact />}
      </div>
      {heart}
    </Link>
  );
}