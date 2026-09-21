import { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { getListingById, setMeetup, confirmMeetup } from '../api/listings.api';
import { initiateStkPush, getPaymentStatus } from '../api/payments.api';
import TrustBadge from '../components/TrustBadge';
import VerificationBadge from '../components/VerificationBadge';
import SafeZonePicker from '../components/SafeZonePicker';
import BackButton from '../components/BackButton';
import Avatar from '../components/Avatar';
import { formatPhone, telHref } from '../utils/phone';

export default function ListingDetail() {
  const { id } = useParams();
  const { user, loading: authLoading } = useContext(AuthContext);
  const navigate = useNavigate();
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);

  const [phone, setPhone] = useState('');
  const [checkoutId, setCheckoutId] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [payError, setPayError] = useState('');
  const [paying, setPaying] = useState(false);

  // Which control a logged-out visitor tried to use: 'meetup', 'pay', or null
  const [loginNotice, setLoginNotice] = useState(null);

  // Photo preview: index of the photo being viewed, or null when closed
  const [viewerIndex, setViewerIndex] = useState(null);
  const viewerOpen = viewerIndex !== null;
  const photoCount = listing?.photos?.length || 0;

  // Wait until we know whether the visitor is logged in, so the login token is
  // attached and the seller's phone number comes back. Reloads if login state changes.
  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    getListingById(id).then((res) => {
      if (!cancelled) setListing(res.data);
    });
    setLoading(false);
    return () => {
      cancelled = true;
    };
  }, [id, authLoading, user?.id]);

  useEffect(() => {
    if (!checkoutId || paymentStatus === 'held' || paymentStatus === 'failed') return;
    const interval = setInterval(() => {
      getPaymentStatus(checkoutId).then((res) => setPaymentStatus(res.data.status));
    }, 3000);
    return () => clearInterval(interval);
  }, [checkoutId, paymentStatus]);

  // While the preview is open: lock page scroll, and Esc / arrow keys work
  useEffect(() => {
    if (!viewerOpen) return;
    function onKey(e) {
      if (e.key === 'Escape') setViewerIndex(null);
      else if (e.key === 'ArrowRight') setViewerIndex((i) => (i + 1) % photoCount);
      else if (e.key === 'ArrowLeft') setViewerIndex((i) => (i - 1 + photoCount) % photoCount);
    }
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [viewerOpen, photoCount]);

  if (loading || !listing) return <p>Loading...</p>;

  const isOwnListing = user && listing.seller._id === user.id;

  // Shown to logged-out visitors who try to pick a meetup point or pay
  const loginNoticeEl = (
    <p role="alert" style={{ color: 'var(--color-warning)', fontSize: '13px', margin: '8px 0 0' }}>
      Please log in to complete request.{' '}
      <Link to="/login" state={{ from: `/listings/${listing._id}` }} style={{ fontWeight: 600 }}>
        Log in
      </Link>
    </p>
  );

  function closeViewer() {
    setViewerIndex(null);
  }
  function showPrev() {
    setViewerIndex((i) => (i - 1 + photoCount) % photoCount);
  }
  function showNext() {
    setViewerIndex((i) => (i + 1) % photoCount);
  }

  function handleMessageSeller() {
    navigate(`/chat/${listing._id}`, { state: { receiverId: listing.seller._id } });
  }

  async function handleSetMeetup(zone) {
    if (!user) {
      setLoginNotice('meetup');
      return;
    }
    const res = await setMeetup(listing._id, zone);
    setListing(res.data);
  }

  async function handleConfirmMeetup() {
    if (!user) {
      setLoginNotice('meetup');
      return;
    }
    const res = await confirmMeetup(listing._id);
    setListing(res.data);
  }

  async function handlePay(e) {
    e.preventDefault();
    setPayError('');
    if (!user) {
      setLoginNotice('pay');
      return;
    }
    if (!phone) {
      setPayError('Enter the phone number to pay from');
      return;
    }
    try {
      setPaying(true);
      const res = await initiateStkPush(listing._id, phone);
      setCheckoutId(res.data.checkoutRequestId);
      setPaymentStatus('pending');
    } catch (err) {
      setPayError(err.response?.data?.error?.errorMessage || err.response?.data?.error || 'Payment failed to initiate');
    } finally {
      setPaying(false);
    }
  }

  return (
    <div style={{ maxWidth: '480px', margin: '0', padding: '1rem' }}>
      <BackButton />
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto' }}>
        {listing.photos.map((url, i) => (
          <img
            key={i}
            src={url}
            alt={listing.title}
            role="button"
            tabIndex={0}
            onClick={() => setViewerIndex(i)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setViewerIndex(i);
              }
            }}
            style={{ width: '120px', height: '120px', objectFit: 'cover', borderRadius: '8px', cursor: 'pointer' }}
          />
        ))}
      </div>

      <h2>{listing.title}</h2>
      <p style={{ fontSize: '18px', fontWeight: 600 }}>KES {listing.price}</p>
      <p style={{ color: '#6b7280' }}>{listing.description}</p>

      {listing.category === 'phone' && (
        <p style={{ fontSize: '13px' }}>
          IMEI status: <strong>{listing.imeiStatus}</strong>
        </p>
      )}

      {/* Seller */}
      <div
        style={{
          borderTop: '1px solid #e5e7eb',
          marginTop: '16px',
          paddingTop: '12px',
          display: 'flex',
          gap: '12px',
          alignItems: 'flex-start',
        }}
      >
        <Avatar src={listing.seller.profilePicture} name={listing.seller.fullName} size={44} />
        <div style={{ minWidth: 0 }}>
          <p style={{ fontWeight: 600, margin: 0 }}>{listing.seller.fullName}</p>
          <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
            <TrustBadge score={listing.seller.trustScore} />
            <VerificationBadge verificationPath={listing.seller.verificationPath} />
          </div>

          {!isOwnListing &&
            (user ? (
              <div style={{ marginTop: '8px', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {listing.seller.location && (
                  <span style={{ color: 'var(--color-muted)' }}>📍 {listing.seller.location}</span>
                )}
                {listing.seller.phone ? (
                  <a href={telHref(listing.seller.phone)} style={{ color: 'var(--color-teal)', fontWeight: 600 }}>
                    📞 {formatPhone(listing.seller.phone)}
                  </a>
                ) : (
                  <span style={{ color: 'var(--color-muted)' }}>Seller hasn't added a phone number</span>
                )}
              </div>
            ) : (
              <p style={{ margin: '8px 0 0', fontSize: '13px', color: 'var(--color-muted)' }}>
                <Link to="/login" style={{ color: 'var(--color-teal)', fontWeight: 600 }}>Log in</Link> to see the
                seller's phone number
              </p>
            ))}
        </div>
      </div>

      {!isOwnListing && listing.status === 'active' && (
        <>
          <button onClick={handleMessageSeller} style={{ marginTop: '16px' }}>
            Message seller
          </button>

          <div style={{ marginTop: '16px' }}>
            <SafeZonePicker
              value={listing.meetupSafeZone}
              onSelect={handleSetMeetup}
              locked={!user}
              onLockedTap={() => setLoginNotice('meetup')}
            />
            {loginNotice === 'meetup' && !user && loginNoticeEl}
          </div>

          {listing.meetupSafeZone && !listing.meetupConfirmed && (
            <button onClick={handleConfirmMeetup} style={{ marginTop: '10px' }}>
              Confirm meetup happened
            </button>
          )}

          <form onSubmit={handlePay} style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <p style={{ fontSize: '13px', fontWeight: 600, margin: 0 }}>Pay with M-Pesa (sandbox)</p>
            <input
              placeholder="Phone e.g. 2547XXXXXXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            {payError && <p style={{ color: 'red', fontSize: '13px' }}>{JSON.stringify(payError)}</p>}
            <button type="submit" disabled={paying} style={{ minWidth: '200px', padding: '11px 28px' }}>
              {paying ? 'Sending STK push...' : 'Pay now'}
            </button>
            {loginNotice === 'pay' && !user && loginNoticeEl}
            {paymentStatus && (
              <p style={{ fontSize: '13px' }}>
                Payment status: <strong>{paymentStatus}</strong>
                {paymentStatus === 'pending' && ' — check your phone'}
                {paymentStatus === 'held' && ' — funds held, confirm meetup to release to seller'}
              </p>
            )}
          </form>
        </>
      )}

      {listing.status === 'sold' && (
        <p style={{ marginTop: '16px', fontWeight: 600, color: '#166534' }}>This item has been sold.</p>
      )}

      {/* Full-screen photo preview */}
      {viewerOpen && listing.photos[viewerIndex] && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Photo preview"
          onClick={closeViewer}
          style={viewerStyles.overlay}
        >
          <button onClick={closeViewer} aria-label="Close preview" style={viewerStyles.close}>
            ✕
          </button>

          {photoCount > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); showPrev(); }}
              aria-label="Previous photo"
              style={{ ...viewerStyles.arrow, left: '10px' }}
            >
              ‹
            </button>
          )}

          <img
            src={listing.photos[viewerIndex]}
            alt={listing.title}
            draggable={false}
            onClick={(e) => e.stopPropagation()}
            style={viewerStyles.image}
          />

          {photoCount > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); showNext(); }}
              aria-label="Next photo"
              style={{ ...viewerStyles.arrow, right: '10px' }}
            >
              ›
            </button>
          )}

          {photoCount > 1 && (
            <div style={viewerStyles.counter}>
              {viewerIndex + 1} / {photoCount}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const viewerStyles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.92)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
    padding: '16px',
    boxSizing: 'border-box',
  },
  image: {
    maxWidth: '92vw',
    maxHeight: '85vh',
    objectFit: 'contain',
    borderRadius: '8px',
    display: 'block',
  },
  close: {
    position: 'absolute',
    top: 'calc(env(safe-area-inset-top, 0px) + 12px)',
    right: '12px',
    width: '40px',
    height: '40px',
    padding: 0,
    borderRadius: '50%',
    border: 'none',
    background: 'rgba(255,255,255,0.18)',
    color: '#fff',
    fontSize: '20px',
    lineHeight: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  arrow: {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    width: '40px',
    height: '40px',
    padding: 0,
    borderRadius: '50%',
    border: 'none',
    background: 'rgba(255,255,255,0.18)',
    color: '#fff',
    fontSize: '26px',
    lineHeight: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  counter: {
    position: 'absolute',
    bottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
    left: 0,
    right: 0,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.85)',
    fontSize: '13px',
  },
};