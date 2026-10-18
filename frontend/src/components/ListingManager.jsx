import { useState } from 'react';
import { updateListing, deleteListing, setListingAvailability, renewListing } from '../api/listings.api';

const DAY = 24 * 60 * 60 * 1000;

const STATUS_TEXT = {
  active: 'Live',
  under_review: 'Waiting for approval',
  unavailable: 'Unavailable',
  expired: 'Expired',
  sold: 'Sold',
  removed: 'Removed',
};

export function statusText(l) {
  if (l.status === 'unavailable') return l.unavailableReason === 'sold_elsewhere' ? 'Sold elsewhere' : 'Unavailable';
  return STATUS_TEXT[l.status] || l.status;
}

function errMsg(err) {
  return !err.response ? 'Network error. Check your connection.' : err.response.data?.error || 'Something went wrong';
}

const small = {
  minWidth: 0,
  padding: '5px 10px',
  fontSize: 12,
  fontWeight: 600,
  borderRadius: 8,
  cursor: 'pointer',
  border: '1px solid var(--color-border)',
  background: 'var(--color-card)',
  color: 'var(--color-ink)',
};

export default function ListingManager({ listing, onChange, onDeleted }) {
  const [mode, setMode] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ title: '', description: '', price: '' });

  const status = listing.status;
  const canEdit = ['active', 'under_review', 'unavailable', 'expired'].includes(status);
  const canDelete = !['sold', 'removed'].includes(status);
  const age = Date.now() - new Date(listing.renewedAt || listing.createdAt).getTime();
  const nearExpiry = status === 'active' && age > 50 * DAY;

  async function act(fn) {
    setBusy(true);
    setError('');
    try {
      const res = await fn();
      if (onChange) onChange(res.data);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  function ask(message, fn) {
    if (window.confirm(message)) act(fn);
  }

  function openEdit() {
    setForm({
      title: listing.title || '',
      description: listing.description || '',
      price: String(listing.price),
    });
    setError('');
    setMode('edit');
  }

  async function saveEdit(e) {
    e.preventDefault();
    const price = Number(form.price);
    if (form.title.trim().length < 3 || form.title.trim().length > 100) {
      setError('Title must be 3 to 100 characters');
      return;
    }
    if (!Number.isInteger(price) || price < 1 || price > 250000) {
      setError('Price must be a whole number of KES between 1 and 250,000');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await updateListing(listing._id, {
        title: form.title,
        description: form.description,
        price,
      });
      if (onChange) onChange(res.data);
      setMode(null);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    setBusy(true);
    setError('');
    try {
      await deleteListing(listing._id);
      setMode(null);
      if (onDeleted) onDeleted(listing._id);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: 8 }}>
      <p style={{ margin: '0 0 6px', fontSize: 12, color: 'var(--color-muted)' }}>
        Status: <strong>{statusText(listing)}</strong>
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {canEdit && (
          <button type="button" style={small} disabled={busy} onClick={openEdit}>
            Edit
          </button>
        )}
        {status === 'active' && (
          <button
            type="button"
            style={small}
            disabled={busy}
            onClick={() =>
              ask(
                'Mark this item as sold elsewhere? It will be hidden from Browse and open offers will close.',
                () => setListingAvailability(listing._id, 'sold_elsewhere')
              )
            }
          >
            Sold elsewhere
          </button>
        )}
        {status === 'active' && (
          <button
            type="button"
            style={small}
            disabled={busy}
            onClick={() =>
              ask('Mark this item as unavailable? It will be hidden from Browse and open offers will close.', () =>
                setListingAvailability(listing._id, 'unavailable')
              )
            }
          >
            Mark unavailable
          </button>
        )}
        {status === 'unavailable' && (
          <button
            type="button"
            style={small}
            disabled={busy}
            onClick={() => act(() => setListingAvailability(listing._id, 'available'))}
          >
            Make available
          </button>
        )}
        {(status === 'expired' || nearExpiry) && (
          <button type="button" style={small} disabled={busy} onClick={() => act(() => renewListing(listing._id))}>
            Renew listing
          </button>
        )}
        {canDelete && (
          <button
            type="button"
            style={{ ...small, color: 'var(--color-warning)' }}
            disabled={busy}
            onClick={() => {
              setError('');
              setMode('delete');
            }}
          >
            Delete
          </button>
        )}
      </div>

      {error && mode === null && (
        <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--color-warning)' }}>{error}</p>
      )}

      {mode && (
        <div style={s.overlay} onClick={() => !busy && setMode(null)}>
          {mode === 'edit' ? (
            <form style={s.sheet} onClick={(e) => e.stopPropagation()} onSubmit={saveEdit}>
              <p style={s.title}>Edit listing</p>
              <input
                placeholder="Title"
                maxLength={100}
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
              <textarea
                rows={4}
                placeholder="Description"
                maxLength={1000}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
              <input
                type="number"
                inputMode="numeric"
                min="1"
                step="1"
                placeholder="Price in KES"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              />
              <p style={s.hint}>If you lower the price, people who saved this item are told.</p>
              {error && <p style={s.error}>{error}</p>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" disabled={busy} onClick={() => setMode(null)} style={{ ...s.btn, ...s.cancel }}>
                  Cancel
                </button>
                <button type="submit" disabled={busy} style={{ ...s.btn, ...s.primary }}>
                  {busy ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          ) : (
            <div style={s.sheet} onClick={(e) => e.stopPropagation()}>
              <p style={s.title}>Delete this listing?</p>
              <p style={s.hint}>
                This removes it for good and closes open offers. If it has payment history, you will be asked to mark
                it unavailable instead.
              </p>
              {error && <p style={s.error}>{error}</p>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" disabled={busy} onClick={() => setMode(null)} style={{ ...s.btn, ...s.cancel }}>
                  Cancel
                </button>
                <button type="button" disabled={busy} onClick={confirmDelete} style={{ ...s.btn, ...s.danger }}>
                  {busy ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const s = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: 20,
  },
  sheet: {
    background: 'var(--color-card)',
    borderRadius: 16,
    padding: '20px 24px',
    width: '100%',
    maxWidth: 380,
    maxHeight: '90vh',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    boxSizing: 'border-box',
    boxShadow: '0 8px 40px rgba(0,0,0,0.15)',
  },
  title: { margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--color-ink)', textAlign: 'center' },
  hint: { margin: 0, fontSize: 12, color: 'var(--color-muted)', lineHeight: 1.5 },
  error: { margin: 0, fontSize: 13, color: 'var(--color-warning)' },
  btn: { flex: 1, minWidth: 0, padding: 11, borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  cancel: { background: 'var(--color-card)', border: '0.5px solid var(--color-border)', color: 'var(--color-muted)' },
  primary: { background: 'var(--color-primary)', border: 'none', color: '#fff' },
  danger: { background: 'var(--color-warning)', border: 'none', color: '#fff' },
};