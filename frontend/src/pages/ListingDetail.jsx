import { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { getListingById, setMeetup, confirmMeetup } from '../api/listings.api';
import { initiateStkPush, getPaymentStatus, getMyPaymentForListing, cancelPayment } from '../api/payments.api';
import TrustBadge from '../components/TrustBadge';
import VerificationBadge from '../components/VerificationBadge';
import SafeZonePicker from '../components/SafeZonePicker';
import BackButton from '../components/BackButton';
import Avatar from '../components/Avatar';
import { formatPhone, telHref, normalizeKenyanPhone, phoneForInput } from '../utils/phone';
import ListingManager from '../components/ListingManager';
import ReviewBox from '../components/ReviewBox';
import FavoriteButton from '../components/FavoriteButton';
import { Stars } from '../components/Stars';
import FeePreview from '../components/FeePreview';
import { optimizeImage } from '../utils/image';

const ICON_PATHS = {
  lock: (
    <>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </>
  ),
  phone: (
    <>
      <rect x="5" y="2" width="14" height="20" rx="2" />
      <path d="M12 18h.01" />
    </>
  ),
  chat: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  check: <path d="M20 6 9 17l-5-5" />,
  shield: (
    <>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  pin: (
    <>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
      <circle cx="12" cy="10" r="3" />
    </>
  ),
};

function Icon({ name, size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICON_PATHS[name]}
    </svg>
  );
}

export default function ListingDetail() {
  const { id } = useParams();
  const { user, token } = useContext(AuthContext);
  const navigate = useNavigate();
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [phone, setPhone] = useState('');
  const [checkoutId, setCheckoutId] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [payError, setPayError] = useState('');
  const [paying, setPaying] = useState(false);
  const [payMessage, setPayMessage] = useState(''); // the real reason from M-Pesa when a payment fails
  const [cancelAfter, setCancelAfter] = useState(60);
  const [pendingSince, setPendingSince] = useState(null);
  const [nowTick, setNowTick] = useState(Date.now());
  const [cancelling, setCancelling] = useState(false);
  const [paidInfo, setPaidInfo] = useState(null); // amount and receipt shown in the success message

  // Shows a payment record from the server (waiting, paid or failed) on the button
  function applyPayment(p) {
    if (!p) return;
    setCheckoutId(p.checkoutRequestId);
    setPaymentStatus(p.status);
    setCancelAfter(p.cancelAfterSeconds || 60);
    if (p.status === 'pending') setPendingSince(Date.now() - (p.waitingSeconds || 0) * 1000);
    setPayMessage(p.status === 'failed' ? p.message || '' : '');
    setPaidInfo(p.status === 'held' ? { amount: p.amount, receipt: p.mpesaReceipt || '' } : null);
    if (p.status === 'pending' || p.status === 'held') setPayError('');
  }

  // Which control a logged-out visitor tried to use: 'meetup', 'pay', or null
  const [loginNotice, setLoginNotice] = useState(null);

  // Photo preview: index of the photo being viewed, or null when closed
  const [viewerIndex, setViewerIndex] = useState(null);
  const viewerOpen = viewerIndex !== null;
  const photoCount = listing?.photos?.length || 0;
  const [mainIndex, setMainIndex] = useState(0); // the large photo currently shown

  // The login token is already attached when the app starts, so the listing (and the seller's phone
  // number for logged-in users) can be requested straight away. It reloads if the login changes.
  useEffect(() => {
    let cancelled = false;
    setNotFound(false);
    setMainIndex(0);
    getListingById(id)
      .then((res) => {
        if (!cancelled) setListing(res.data);
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      });
    setLoading(false);
    return () => {
      cancelled = true;
    };
  }, [id, token]);

  // Pick up a payment the buyer already started (waiting or paid), e.g. after a page reload
  useEffect(() => {
    if (!token || !id) return;
    let cancelled = false;
    getMyPaymentForListing(id)
      .then((res) => {
        if (!cancelled && res.data.payment) applyPayment(res.data.payment);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token]);

  // While waiting for the PIN, ask the server for the real result every few seconds
  useEffect(() => {
    if (!checkoutId || paymentStatus !== 'pending') return;
    const interval = setInterval(() => {
      getPaymentStatus(checkoutId)
        .then((res) => applyPayment(res.data))
        .catch(() => {});
    }, 3000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkoutId, paymentStatus]);

  // One-second clock for the "cancel in Ns" countdown
  useEffect(() => {
    if (paymentStatus !== 'pending') return;
    const t = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, [paymentStatus]);

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

  // Start with the phone number saved on the person's profile, if they have one
  useEffect(() => {
    if (user?.phone) setPhone((current) => current || phoneForInput(user.phone));
  }, [user?.phone]);

  if (notFound) {
    return (
      <div style={{ padding: '1rem' }}>
        <BackButton />
        <p style={{ color: 'var(--color-muted)' }}>This listing isn't available.</p>
      </div>
    );
  }

  if (loading || !listing) return <p>Loading...</p>;

  const isOwnListing = user && listing.seller._id === user.id;
  const agreed = !isOwnListing ? listing.agreedOffer : null;
  const agreements = isOwnListing ? listing.agreements || [] : [];
  const isAdmin = user?.role === 'admin';
  const shareUrl = `${window.location.origin}/listings/${listing._id}`;
  const shareText = `${listing.title} - KES ${Number(listing.price).toLocaleString()} on SafeSwap`;
  const shareBtn = {
    display: 'inline-flex',
    alignItems: 'center',
    minWidth: 0,
    padding: '7px 12px',
    fontSize: 13,
    fontWeight: 600,
    borderRadius: 999,
    cursor: 'pointer',
    background: 'transparent',
    border: '1px solid var(--color-teal)',
    color: 'var(--color-teal)',
    textDecoration: 'none',
  };

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      alert('Link copied');
    } catch (e) {
      alert(shareUrl);
    }
  }

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
    try {
      const res = await setMeetup(listing._id, zone);
      setListing(res.data);
    } catch (err) {
      alert(err.response?.data?.error || 'Could not set the meetup point');
    }
  }

  async function handleConfirmMeetup() {
    if (!user) {
      setLoginNotice('meetup');
      return;
    }
    try {
      const res = await confirmMeetup(listing._id);
      setListing(res.data);
    } catch (err) {
      alert(err.response?.data?.error || 'Could not confirm the meetup');
    }
  }

  const isPending = paymentStatus === 'pending';
  const isHeld = paymentStatus === 'held';
  const waited = pendingSince ? Math.max(Math.floor((nowTick - pendingSince) / 1000), 0) : 0;
  const cancelIn = Math.max(cancelAfter - waited, 0);

  async function handlePay(e) {
    e.preventDefault();
    setPayError('');
    if (!user) {
      setLoginNotice('pay');
      return;
    }
    if (!phone.trim()) {
      setPayError('Enter the phone number to pay from');
      return;
    }
    if (!normalizeKenyanPhone(phone.trim())) {
      setPayError('Enter a valid Kenyan phone number, e.g. 0712 345 678');
      return;
    }
    try {
      setPaying(true);
      const res = await initiateStkPush(listing._id, phone.trim());
      setCheckoutId(res.data.checkoutRequestId);
      setPaymentStatus('pending');
      setPayMessage('');
      setCancelAfter(res.data.cancelAfterSeconds || 60);
      setPendingSince(Date.now());
    } catch (err) {
      setPayError(err.response?.data?.error?.errorMessage || err.response?.data?.error || 'Payment failed to initiate');
      // If the server says a payment is already open, show that one instead
      getMyPaymentForListing(listing._id)
        .then((r) => {
          if (r.data.payment) applyPayment(r.data.payment);
        })
        .catch(() => {});
    } finally {
      setPaying(false);
    }
  }

  async function handleCancel() {
    if (!checkoutId || cancelling) return;
    setCancelling(true);
    setPayError('');
    try {
      const res = await cancelPayment(checkoutId);
      applyPayment(res.data);
    } catch (err) {
      setPayError(err.response?.data?.error || 'Could not cancel. Try again in a moment.');
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="listing-detail-page" style={{ padding: '1rem' }}>
      <style>{`
        .listing-detail-page {
          max-width: 560px; margin: 0 auto; box-sizing: border-box;
          display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; align-content: start;
        }
        .ld-back { grid-column: 1 / -1; }
        .ld-info { min-width: 0; }
        .ld-info h2 { margin: 0 0 6px; font-size: 24px; line-height: 1.25; word-break: break-word; }
        .ld-price { margin: 4px 0 10px; font-size: 26px; font-weight: 700; color: var(--color-primary); }

        .ld-gallery { min-width: 0; }
        button.ld-main-photo {
          position: relative; display: block; width: 100%; min-width: 0; padding: 0; align-self: auto;
          aspect-ratio: 4 / 3; overflow: hidden; border: 1px solid var(--color-border); border-radius: 12px;
          background: var(--color-surface); cursor: zoom-in;
        }
        button.ld-main-photo:hover { background: var(--color-surface); border-color: var(--color-teal); }
        button.ld-main-photo img { position: relative; width: 100%; height: 100%; object-fit: contain; display: block; }
        .ld-photo-bg {
          position: absolute; inset: -24px; background-size: cover; background-position: center;
          filter: blur(22px) brightness(0.55); transform: scale(1.1);
        }
        .ld-photo-count {
          position: absolute; right: 8px; bottom: 8px; padding: 2px 8px; border-radius: 999px;
          background: rgba(0,0,0,0.55); color: #fff; font-size: 12px; font-weight: 600;
        }
        .ld-thumbs { display: flex; gap: 8px; margin-top: 8px; overflow-x: auto; padding-bottom: 2px; }
        button.ld-thumb {
          flex: 0 0 64px; width: 64px; height: 64px; min-width: 0; padding: 0; align-self: auto;
          overflow: hidden; border: 2px solid transparent; border-radius: 8px;
          background: var(--color-surface); opacity: 0.75;
        }
        button.ld-thumb:hover { background: var(--color-surface); opacity: 1; }
        button.ld-thumb.active { border-color: var(--color-teal); opacity: 1; }
        button.ld-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }

        @media (min-width: 600px) { .listing-detail-page { max-width: 640px; } }
        @media (min-width: 900px) {
          .listing-detail-page {
            max-width: 1080px; grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
            column-gap: 32px; align-items: start;
          }
          .ld-gallery { position: sticky; top: 76px; }
        }

        .ld-card {
          border: 1px solid var(--color-border); border-radius: 12px; padding: 14px;
          background: var(--color-card); margin-top: 12px;
        }
        .ld-seller-card { margin-top: 16px; }
        .ld-seller { display: flex; align-items: center; gap: 12px; }
        .ld-name { margin: 0; font-size: 16px; font-weight: 600; line-height: 1.3; }
        .ld-badges { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
        .ld-contact {
          display: flex; flex-direction: column; gap: 6px; margin-top: 12px; padding-top: 12px;
          border-top: 1px solid var(--color-border); font-size: 13px; color: var(--color-muted);
        }
        .ld-contact a { color: var(--color-teal); font-weight: 600; }
        .ld-login-line { display: flex; align-items: center; gap: 10px; }
        .ld-login-line svg { flex-shrink: 0; }

        button.ld-msg-btn {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          width: 100%; min-width: 0; height: 46px; margin-top: 12px; align-self: auto;
          background: transparent; border: 1px solid var(--color-teal); color: var(--color-teal); font-size: 15px;
        }
        button.ld-msg-btn:hover { background: var(--color-teal); border-color: var(--color-teal); color: #fff; }
        [data-theme="dark"] button.ld-msg-btn:hover { color: #0e1518; }

        .ld-head { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
        .ld-head-left { display: flex; align-items: center; gap: 12px; min-width: 0; }
        .ld-tile {
          width: 42px; height: 42px; flex-shrink: 0; border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          background: color-mix(in srgb, var(--color-teal) 14%, var(--color-card)); color: var(--color-teal);
        }

        .ld-meetup select { width: 100%; height: 44px; font-size: 15px; }
        button.ld-confirm-btn {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          width: 100%; min-width: 0; height: 44px; margin-top: 10px; align-self: auto;
          background: var(--color-card); border: 1px solid var(--color-border); color: var(--color-ink); font-size: 14px;
        }
        button.ld-confirm-btn:hover { background: var(--color-surface); border-color: var(--color-teal); color: var(--color-ink); }

        .ld-pay-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 12px; }
        .ld-pay-title { margin: 0; font-size: 15px; font-weight: 600; line-height: 1.3; }
        .ld-pay-sub { margin: 2px 0 0; font-size: 12px; color: var(--color-muted); }
        .ld-label { display: block; margin-bottom: 6px; font-size: 12px; color: var(--color-muted); }
        .ld-input-wrap { position: relative; }
        .ld-input-wrap svg {
          position: absolute; left: 12px; top: 50%; transform: translateY(-50%);
          color: var(--color-muted); pointer-events: none;
        }
        .ld-input-wrap input { height: 46px; font-size: 15px; padding-left: 38px; }
        button.ld-pay-btn {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          width: 100%; min-width: 0; height: 48px; margin-top: 12px; align-self: auto; font-size: 16px;
        }
        .ld-hint { margin: 8px 0 0; font-size: 12px; color: var(--color-muted); line-height: 1.5; }
        .ld-safe {
          display: flex; gap: 6px; align-items: flex-start; margin: 10px 0 0;
          font-size: 12px; color: var(--color-muted); line-height: 1.5;
        }
        .ld-safe svg { flex-shrink: 0; margin-top: 1px; color: var(--color-teal); }
        .ld-error { margin: 8px 0 0; font-size: 13px; color: var(--color-warning); }
        .ld-status { margin: 10px 0 0; font-size: 13px; }
        button.ld-pay-btn.ld-paid:disabled {
          opacity: 1; cursor: default; background: var(--color-success-bg);
          border: 1px solid var(--color-success); color: var(--color-success);
        }
        button.ld-cancel-btn {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          width: 100%; min-width: 0; height: 44px; margin-top: 10px; align-self: auto;
          background: var(--color-card); border: 1px solid var(--color-border); color: var(--color-ink); font-size: 14px;
        }
        button.ld-cancel-btn:hover:not(:disabled) {
          background: var(--color-surface); border-color: var(--color-teal); color: var(--color-ink);
        }
        .ld-success {
          margin-top: 12px; padding: 14px; border-radius: 12px;
          border: 1px solid var(--color-success); background: var(--color-success-bg);
        }
        .ld-success-head { display: flex; align-items: center; gap: 10px; }
        .ld-success-icon {
          flex: 0 0 32px; width: 32px; height: 32px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          background: var(--color-success); color: #fff;
        }
        .ld-success-title { margin: 0; font-size: 15px; font-weight: 700; color: var(--color-success); }
        .ld-success-sub { margin: 2px 0 0; font-size: 13px; line-height: 1.45; color: var(--color-ink); }
        .ld-success-steps { margin: 12px 0 0; padding: 0; list-style: none; display: grid; gap: 8px; }
        .ld-success-steps li { display: flex; gap: 8px; font-size: 13px; line-height: 1.45; color: var(--color-ink); }
        .ld-step-num {
          flex: 0 0 20px; width: 20px; height: 20px; margin-top: 1px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          background: var(--color-card); border: 1px solid var(--color-success);
          color: var(--color-success); font-size: 11px; font-weight: 700;
        }
        .ld-success-receipt { margin: 10px 0 0; font-size: 12px; color: var(--color-muted); word-break: break-all; }
      `}</style>

      <div className="ld-back">
        <BackButton />
      </div>

      <div className="ld-gallery">
        {photoCount > 0 && (
          <button
            type="button"
            className="ld-main-photo"
            onClick={() => setViewerIndex(mainIndex)}
            aria-label="View photo full screen"
          >
            <span
              className="ld-photo-bg"
              aria-hidden="true"
              style={{ backgroundImage: `url(${optimizeImage(listing.photos[mainIndex] || listing.photos[0], 160)})` }}
            />
            <img
              src={optimizeImage(listing.photos[mainIndex] || listing.photos[0], 900)}
              alt={listing.title}
              decoding="async"
            />
            {photoCount > 1 && (
              <span className="ld-photo-count">
                {mainIndex + 1} / {photoCount}
              </span>
            )}
          </button>
        )}
        {photoCount > 1 && (
          <div className="ld-thumbs">
            {listing.photos.map((url, i) => (
              <button
                key={i}
                type="button"
                className={i === mainIndex ? 'ld-thumb active' : 'ld-thumb'}
                onClick={() => setMainIndex(i)}
                aria-label={`Show photo ${i + 1}`}
              >
                <img src={optimizeImage(url, 160)} alt="" loading="lazy" decoding="async" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="ld-info">
        <h2>{listing.title}</h2>

        {listing.status === 'under_review' && (
          <p
            role="status"
            style={{
              background: 'var(--color-gold-bg)',
              color: 'var(--color-gold)',
              padding: '10px 12px',
              borderRadius: '8px',
              fontSize: '13px',
              lineHeight: 1.5,
              margin: '0 0 12px',
            }}
          >
            {isOwnListing
              ? "Waiting for approval. Only you can see this listing until an admin approves it. We'll notify you once it's live."
              : 'This listing is waiting for approval and is visible to admins only.'}
          </p>
        )}

        {agreed ? (
          <div style={{ margin: '12px 0' }}>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-success)', fontWeight: 600 }}>
              Agreed price for you
            </p>
            <p style={{ margin: '2px 0 0', fontSize: '18px', fontWeight: 600 }}>
              <span style={{ textDecoration: 'line-through', color: 'var(--color-muted)', marginRight: '8px' }}>
                KES {Number(listing.price).toLocaleString()}
              </span>
              KES {Number(agreed.amount).toLocaleString()}
            </p>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--color-muted)' }}>
              Pay before {new Date(agreed.expiresAt).toLocaleString()}
            </p>
          </div>
        ) : (
          <p className="ld-price">KES {Number(listing.price).toLocaleString()}</p>
        )}

        {isOwnListing && listing.status !== 'sold' && (
          <FeePreview category={listing.category} amount={listing.price} approximate style={{ margin: '0 0 8px' }} />
        )}

        {agreements.length > 0 && (
          <div style={{ margin: '0 0 12px' }}>
            {agreements.map((a) => (
              <div key={a.offerId} style={{ margin: '4px 0' }}>
                <p style={{ margin: '2px 0', fontSize: '13px', color: 'var(--color-success)', fontWeight: 600 }}>
                  Agreed with {a.buyer.fullName}: KES {Number(a.amount).toLocaleString()}
                </p>
                <FeePreview category={listing.category} amount={a.amount} style={{ margin: 0 }} />
              </div>
            ))}
          </div>
        )}
        <p style={{ color: 'var(--color-muted)' }}>{listing.description}</p>

        {listing.status === 'unavailable' && !isOwnListing && (
          <p style={{ fontWeight: 600, color: 'var(--color-warning)' }}>
            {listing.unavailableReason === 'sold_elsewhere'
              ? 'The seller sold this item elsewhere.'
              : 'This item is no longer available.'}
          </p>
        )}
        {listing.status === 'expired' && !isOwnListing && (
          <p style={{ fontWeight: 600, color: 'var(--color-warning)' }}>This listing has expired.</p>
        )}

        {isOwnListing && (
          <div className="ld-card">
            <ListingManager
              listing={listing}
              onChange={(u) => setListing((prev) => ({ ...prev, ...u, seller: prev.seller }))}
              onDeleted={() => navigate('/profile')}
            />
          </div>
        )}

        {listing.status === 'active' && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '12px 0' }}>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              style={shareBtn}
            >
              Share on WhatsApp
            </a>
            <button type="button" onClick={copyLink} style={shareBtn}>
              Copy link
            </button>
            {!isOwnListing && !isAdmin && (
              <FavoriteButton listingId={listing._id} initial={!!listing.isFavorite} variant="pill" />
            )}
          </div>
        )}

        {!isOwnListing && !isAdmin && listing.status !== 'removed' && (
          <p style={{ margin: '0 0 8px', fontSize: 13 }}>
            <Link to={`/report/${listing._id}`} style={{ color: 'var(--color-muted)' }}>
              Report this listing
            </Link>
          </p>
        )}

        {listing.category === 'phone' && (
          <p style={{ fontSize: '13px' }}>
            IMEI status: <strong>{listing.imeiStatus}</strong>
          </p>
        )}

        {/* Seller */}
        <div className="ld-card ld-seller-card">
          <div className="ld-seller">
            <Avatar src={listing.seller.profilePicture} name={listing.seller.fullName} size={48} soft zoomable />
            <div style={{ minWidth: 0 }}>
              <p className="ld-name">
                <Link to={`/sellers/${listing.seller._id}`} style={{ color: 'inherit' }}>
                  {listing.seller.fullName}
                </Link>
              </p>
              {listing.seller.ratingCount > 0 && (
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--color-muted)' }}>
                  <Stars value={listing.seller.ratingAverage} size={13} /> {listing.seller.ratingAverage} (
                  {listing.seller.ratingCount})
                </p>
              )}
              <div className="ld-badges">
                <TrustBadge score={listing.seller.trustScore} icon />
                <VerificationBadge verificationPath={listing.seller.verificationPath} icon />
              </div>
            </div>
          </div>

          {!isOwnListing &&
            (user ? (
              <div className="ld-contact">
                {listing.seller.location && <span>📍 {listing.seller.location}</span>}
                {listing.seller.phone ? (
                  <a href={telHref(listing.seller.phone)}>📞 {formatPhone(listing.seller.phone)}</a>
                ) : (
                  <span>Seller hasn't added a phone number</span>
                )}
              </div>
            ) : (
              <div className="ld-contact">
                <span className="ld-login-line">
                  <Icon name="lock" />
                  <span>
                    <Link to="/login">Log in</Link> to see the seller's phone number
                  </span>
                </span>
              </div>
            ))}
        </div>

        {!isOwnListing && listing.status === 'active' && (
          <>
            <button type="button" className="ld-msg-btn" onClick={handleMessageSeller}>
              <Icon name="chat" />
              Message seller
            </button>

            <div className="ld-card ld-meetup">
              <div className="ld-head">
                <span className="ld-tile">
                  <Icon name="pin" size={20} />
                </span>
                <div>
                  <p className="ld-pay-title">Meet at a safe zone</p>
                  <p className="ld-pay-sub">Choose a public spot on campus</p>
                </div>
              </div>

              <SafeZonePicker
                value={listing.meetupSafeZone}
                onSelect={handleSetMeetup}
                locked={!user}
                onLockedTap={() => setLoginNotice('meetup')}
                hideLabel
              />
              {loginNotice === 'meetup' && !user && loginNoticeEl}

              {listing.meetupSafeZone && !listing.meetupConfirmed && (
                <>
                  <button type="button" className="ld-confirm-btn" onClick={handleConfirmMeetup}>
                    <Icon name="check" />
                    Confirm meetup happened
                  </button>
                  <p className="ld-hint">
                    Only the buyer confirms, after the handover. This releases the payment to the seller.
                  </p>
                </>
              )}
            </div>

            <form onSubmit={handlePay} className="ld-card ld-pay">
              <div className="ld-pay-head">
                <div className="ld-head-left">
                  <span className="ld-tile">
                    <Icon name="phone" size={20} />
                  </span>
                  <div>
                    <p className="ld-pay-title">Pay with M-Pesa</p>
                    <p className="ld-pay-sub">Held safely until you confirm</p>
                  </div>
                </div>
              </div>

              <label className="ld-label" htmlFor="ld-pay-phone">
                Phone to pay from
              </label>
              <div className="ld-input-wrap">
                <Icon name="phone" />
                <input
                  id="ld-pay-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="e.g. 0712 345 678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={isPending || isHeld}
                />
              </div>

              {payError && (
                <p className="ld-error">{typeof payError === 'string' ? payError : JSON.stringify(payError)}</p>
              )}

              {agreed && (
                <p className="ld-hint">You will be charged the agreed price: KES {Number(agreed.amount).toLocaleString()}</p>
              )}

              <button
                type="submit"
                className={isHeld ? 'ld-pay-btn ld-paid' : 'ld-pay-btn'}
                disabled={paying || isPending || isHeld}
              >
                <Icon name={isHeld ? 'check' : 'lock'} />
                {isHeld
                  ? 'Paid · held by SafeSwap'
                  : isPending
                  ? 'Waiting for your PIN...'
                  : paying
                  ? 'Sending STK push...'
                  : paymentStatus === 'failed'
                  ? 'Try again'
                  : 'Pay now'}
              </button>

              {loginNotice === 'pay' && !user && loginNoticeEl}

              {isPending && (
                <>
                  <p className="ld-status">Check your phone and enter your M-Pesa PIN. This page updates by itself.</p>
                  {cancelIn > 0 ? (
                    <p className="ld-hint">Didn't get the prompt? You can cancel and try again in {cancelIn}s.</p>
                  ) : (
                    <>
                      <button type="button" className="ld-cancel-btn" onClick={handleCancel} disabled={cancelling}>
                        {cancelling ? 'Checking with M-Pesa...' : 'Cancel and try again'}
                      </button>
                      <p className="ld-hint">
                        Missed the prompt or it was delayed? We check with M-Pesa first. If the payment already went
                        through, it will show as paid.
                      </p>
                    </>
                  )}
                </>
              )}

              {paymentStatus === 'failed' && payMessage && <p className="ld-error">{payMessage}</p>}

              {isHeld && (
                <div className="ld-success" role="status">
                  <div className="ld-success-head">
                    <span className="ld-success-icon">
                      <Icon name="check" size={18} />
                    </span>
                    <div>
                      <p className="ld-success-title">
                        Payment received
                        {paidInfo && paidInfo.amount ? `: KES ${Number(paidInfo.amount).toLocaleString()}` : ''}
                      </p>
                      <p className="ld-success-sub">
                        Thank you. SafeSwap is holding your money safely and the seller has been told.
                      </p>
                    </div>
                  </div>
                  <ul className="ld-success-steps">
                    <li>
                      <span className="ld-step-num">1</span>
                      <span>Pick a safe zone above and arrange the meetup with the seller.</span>
                    </li>
                    <li>
                      <span className="ld-step-num">2</span>
                      <span>Check the item when you meet.</span>
                    </li>
                    <li>
                      <span className="ld-step-num">3</span>
                      <span>
                        Once you have the item, tap <strong>Confirm meetup happened</strong> to release the money to
                        the seller.
                      </span>
                    </li>
                  </ul>
                  {paidInfo && paidInfo.receipt && (
                    <p className="ld-success-receipt">M-Pesa receipt: {paidInfo.receipt}</p>
                  )}
                </div>
              )}

              <p className="ld-safe">
                <Icon name="shield" size={15} />
                <span>Your money is held by SafeSwap and only released when you confirm the handover.</span>
              </p>
            </form>
          </>
        )}

        {listing.status === 'sold' && (
          <>
            <p style={{ marginTop: '16px', fontWeight: 600, color: 'var(--color-success)' }}>This item has been sold.</p>
            {user && !isOwnListing && !isAdmin && <ReviewBox listingId={listing._id} />}
          </>
        )}
      </div>

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
            src={optimizeImage(listing.photos[viewerIndex], 1400)}
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