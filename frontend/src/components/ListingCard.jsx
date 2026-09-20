import { Link } from 'react-router-dom';

export default function ListingCard({ listing }) {
  return (
    <Link to={`/listings/${listing._id}`} className="divider-row" style={{ color: 'inherit' }}>
      <img
        src={listing.photos?.[0]}
        alt={listing.title}
        style={{ width: '68px', height: '68px', objectFit: 'cover', borderRadius: 'var(--radius)', flexShrink: 0, border: '1px solid var(--color-border)' }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontWeight: 600 }}>{listing.title}</span>
          {listing.category === 'phone' && listing.imeiStatus === 'clean' && (
            <span className="badge badge-gold">Verified</span>
          )}
        </div>
        <p style={{ margin: '3px 0 0', fontSize: '13px', color: 'var(--color-muted)' }}>
          KES {listing.price} &middot; {listing.seller?.fullName}
        </p>
      </div>
    </Link>
  );
}