import { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { getListingById, setMeetup, confirmMeetup } from '../api/listings.api';
import { initiateStkPush, getPaymentStatus } from '../api/payments.api';
import TrustBadge from '../components/TrustBadge';
import VerificationBadge from '../components/VerificationBadge';
import SafeZonePicker from '../components/SafeZonePicker';
import BackButton from '../components/BackButton';

export default function ListingDetail() {
  const { id } = useParams();
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);

  const [phone, setPhone] = useState('');
  const [checkoutId, setCheckoutId] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [payError, setPayError] = useState('');
  const [paying, setPaying] = useState(false);

  function loadListing() {
    getListingById(id).then((res) => setListing(res.data));
  }

  useEffect(() => {
    loadListing();
    setLoading(false);
  }, [id]);

  useEffect(() => {
    if (!checkoutId || paymentStatus === 'held' || paymentStatus === 'failed') return;
    const interval = setInterval(() => {
      getPaymentStatus(checkoutId).then((res) => setPaymentStatus(res.data.status));
    }, 3000);
    return () => clearInterval(interval);
  }, [checkoutId, paymentStatus]);

  if (loading || !listing) return <p>Loading...</p>;

  const isOwnListing = user && listing.seller._id === user.id;

  function handleMessageSeller() {
    navigate(`/chat/${listing._id}`, { state: { receiverId: listing.seller._id } });
  }

  async function handleSetMeetup(zone) {
    const res = await setMeetup(listing._id, zone);
    setListing(res.data);
  }

  async function handleConfirmMeetup() {
    const res = await confirmMeetup(listing._id);
    setListing(res.data);
  }

  async function handlePay(e) {
    e.preventDefault();
    setPayError('');
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
          <img key={i} src={url} alt={listing.title} style={{ width: '120px', height: '120px', objectFit: 'cover', borderRadius: '8px' }} />
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

      <div style={{ borderTop: '1px solid #e5e7eb', marginTop: '16px', paddingTop: '12px' }}>
        <p style={{ fontWeight: 600, margin: 0 }}>{listing.seller.fullName}</p>
        <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
          <TrustBadge score={listing.seller.trustScore} />
          <VerificationBadge verificationPath={listing.seller.verificationPath} />
        </div>
      </div>

      {!isOwnListing && listing.status === 'active' && (
        <>
          <button onClick={handleMessageSeller} style={{ marginTop: '16px' }}>
            Message seller
          </button>

          <div style={{ marginTop: '16px' }}>
            <SafeZonePicker value={listing.meetupSafeZone} onSelect={handleSetMeetup} />
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
    </div>
  );
}