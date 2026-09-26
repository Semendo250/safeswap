import { useState, useEffect } from 'react';
import { getFlaggedListings, approveListing, removeListing } from '../../api/admin.api';

export default function FlaggedQueue() {
  const [listings, setListings] = useState([]);

  function load() {
    getFlaggedListings().then((res) => setListings(res.data));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleApprove(id) {
    await approveListing(id);
    load();
  }

  async function handleRemove(id) {
    await removeListing(id);
    load();
  }

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', padding: '1rem' }}>
      <h2>Flagged listings</h2>
      {listings.length === 0 && <p>Nothing flagged right now.</p>}
      {listings.map((l) => (
        <div key={l._id} style={{ border: '1px solid var(--color-border)', borderRadius: '10px', padding: '10px', marginBottom: '8px', background: 'var(--color-card)' }}>
          <p style={{ margin: 0, fontWeight: 600 }}>{l.title}</p>
          <p style={{ margin: '2px 0', fontSize: '13px', color: 'var(--color-muted)' }}>
            {l.category === 'phone' ? `IMEI status: ${l.imeiStatus}` : 'General item'} &middot; Reports: {l.reportCount} &middot; Seller trust: {l.seller?.trustScore}
          </p>
          <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
            <button onClick={() => handleApprove(l._id)}>Approve</button>
            <button onClick={() => handleRemove(l._id)}>Remove</button>
          </div>
        </div>
      ))}
    </div>
  );
}