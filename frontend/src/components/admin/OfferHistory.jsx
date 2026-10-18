import { useEffect, useState } from 'react';
import { getListingOffers } from '../../api/admin.api';
import { Modal, Chip, btn, errText, fmtDate, money } from './AdminUi';

const OFFER_TONE = {
  pending: 'gold',
  accepted: 'success',
  declined: 'warning',
  replaced: 'muted',
  expired: 'muted',
  closed: 'muted',
  paid: 'teal',
};
const PAYMENT_TONE = { pending: 'gold', held: 'teal', released: 'success', failed: 'warning', refunded: 'muted' };

export default function OfferHistory({ listingId, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    getListingOffers(listingId)
      .then((res) => {
        if (!cancelled) setData(res.data);
      })
      .catch((err) => {
        if (!cancelled) setError(errText(err, 'Could not load the offer history.'));
      });
    return () => {
      cancelled = true;
    };
  }, [listingId]);

  const events = data
    ? [
        ...data.offers.map((o) => ({ at: o.createdAt, key: `o${o._id}`, offer: o })),
        ...data.payments.map((p) => ({ at: p.createdAt, key: `p${p._id}`, payment: p })),
      ].sort((a, b) => new Date(a.at) - new Date(b.at))
    : [];

  return (
    <Modal title="Offer history" onClose={onClose}>
      {error && <p style={{ color: 'var(--color-warning)', fontSize: 13 }}>{error}</p>}
      {!data && !error && <p style={{ color: 'var(--color-muted)', fontSize: 13 }}>Loading...</p>}

      {data && (
        <>
          <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--color-muted)' }}>
            {data.listing.title} · asking {money(data.listing.price)} · seller {data.listing.sellerName}
          </p>

          {events.length === 0 && (
            <p style={{ fontSize: 13, color: 'var(--color-muted)' }}>No offers or payments for this listing.</p>
          )}

          {events.map((e) => (
            <div key={e.key} style={{ padding: '8px 0', borderTop: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>{fmtDate(e.at)}</div>
              {e.offer && (
                <>
                  <div style={{ fontSize: 13, margin: '2px 0' }}>
                    <strong>{e.offer.proposedByName}</strong> offered <strong>{money(e.offer.amount)}</strong>{' '}
                    <Chip tone={OFFER_TONE[e.offer.status] || 'muted'}>{e.offer.status}</Chip>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>
                    Buyer {e.offer.buyerName} · asking {money(e.offer.askingPrice)}
                    {e.offer.acceptedAt ? ` · agreed ${fmtDate(e.offer.acceptedAt)}` : ''}
                  </div>
                </>
              )}
              {e.payment && (
                <>
                  <div style={{ fontSize: 13, margin: '2px 0' }}>
                    Payment <strong>{money(e.payment.amount)}</strong> by {e.payment.buyerName}{' '}
                    <Chip tone={PAYMENT_TONE[e.payment.status] || 'muted'}>{e.payment.status}</Chip>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-muted)', wordBreak: 'break-all' }}>
                    {e.payment.checkoutRequestId}
                  </div>
                </>
              )}
            </div>
          ))}
        </>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
        <button type="button" onClick={onClose} style={btn('outline', { padding: '9px 16px' })}>
          Close
        </button>
      </div>
    </Modal>
  );
}