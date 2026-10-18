import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import BackButton from '../components/BackButton';
import Avatar from '../components/Avatar';
import TrustBadge from '../components/TrustBadge';
import VerificationBadge from '../components/VerificationBadge';
import ListingCard from '../components/ListingCard';
import { Stars } from '../components/Stars';
import { getSellerReviews } from '../api/reviews.api';
import { getListings } from '../api/listings.api';

function when(value) {
  return new Date(value).toLocaleDateString([], { dateStyle: 'medium' });
}

export default function SellerProfile() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    Promise.allSettled([getSellerReviews(id), getListings(null, { seller: id })]).then(([r, l]) => {
      if (cancelled) return;
      if (r.status === 'fulfilled') setData(r.value.data);
      else setNotFound(true);
      setListings(l.status === 'fulfilled' ? l.value.data : []);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="container">
        <BackButton />
        <p style={{ color: 'var(--color-muted)' }}>Loading...</p>
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="container">
        <BackButton />
        <p style={{ color: 'var(--color-muted)' }}>This seller isn't available.</p>
      </div>
    );
  }

  const { seller, reviews } = data;

  return (
    <div className="container">
      <BackButton />

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: 4,
          paddingBottom: 16,
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <Avatar src={seller.profilePicture} name={seller.fullName} size={80} />
        <span style={{ fontWeight: 600, fontSize: 18, marginTop: 6 }}>{seller.fullName}</span>
        {seller.ratingCount > 0 ? (
          <span style={{ fontSize: 13, color: 'var(--color-muted)' }}>
            <Stars value={seller.ratingAverage} size={16} /> {seller.ratingAverage} ({seller.ratingCount} review
            {seller.ratingCount === 1 ? '' : 's'})
          </span>
        ) : (
          <span style={{ fontSize: 13, color: 'var(--color-muted)' }}>No reviews yet</span>
        )}
        <div style={{ display: 'flex', gap: 6, marginTop: 6, justifyContent: 'center' }}>
          <TrustBadge score={seller.trustScore} />
          <VerificationBadge verificationPath={seller.verificationPath} />
        </div>
      </div>

      <h3 style={{ fontSize: 16, marginTop: 20 }}>Listings for sale</h3>
      {listings.length === 0 ? (
        <p style={{ color: 'var(--color-muted)', fontSize: 14 }}>Nothing for sale right now.</p>
      ) : (
        listings.map((l) => <ListingCard key={l._id} listing={l} />)
      )}

      <h3 style={{ fontSize: 16, marginTop: 24 }}>Reviews</h3>
      {reviews.length === 0 ? (
        <p style={{ color: 'var(--color-muted)', fontSize: 14 }}>Buyers can leave a review after a completed deal.</p>
      ) : (
        reviews.map((r) => (
          <div key={r._id} style={{ padding: '10px 0', borderTop: '1px solid var(--color-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <Stars value={r.rating} size={15} />
              <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>{when(r.createdAt)}</span>
            </div>
            {r.comment && <p style={{ margin: '4px 0 0', fontSize: 14 }}>{r.comment}</p>}
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-muted)' }}>
              {r.reviewerName}
              {r.listingTitle ? ` · ${r.listingTitle}` : ''}
            </p>
          </div>
        ))
      )}
    </div>
  );
}