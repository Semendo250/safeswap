import { useState, useEffect, useContext, useRef } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { getMyListings } from '../api/listings.api';
import { updateProfile } from '../api/auth.api';
import BackButton from '../components/BackButton';
import TrustBadge from '../components/TrustBadge';
import VerificationBadge from '../components/VerificationBadge';
import Avatar from '../components/Avatar';
import ImageLightbox from '../components/ImageLightbox';
import { normalizeKenyanPhone, formatPhone, phoneForInput } from '../utils/phone';

const MAX_PICTURE_BYTES = 5 * 1024 * 1024;

export default function Profile() {
  const { user, updateUser, loading: authLoading } = useContext(AuthContext);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('sales');
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const [phoneInput, setPhoneInput] = useState('');
  const [locationInput, setLocationInput] = useState('');
  const [newPicture, setNewPicture] = useState(null);
  const [newPreview, setNewPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    getMyListings()
      .then((res) => setListings(res.data))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setPhoneInput(phoneForInput(user?.phone));
    setLocationInput(user?.location || '');
  }, [user?.phone, user?.location]);

  useEffect(() => {
    return () => {
      if (newPreview) URL.revokeObjectURL(newPreview);
    };
  }, [newPreview]);

  function handlePick(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      setSaveError('Please choose a JPG, PNG or WebP image');
      return;
    }
    if (file.size > MAX_PICTURE_BYTES) {
      setSaveError('Profile picture must be 5 MB or smaller');
      return;
    }
    setSaveError('');
    setSaved(false);
    setNewPicture(file);
    setNewPreview(URL.createObjectURL(file));
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaveError('');
    setSaved(false);

    const phoneTrim = phoneInput.trim();
    if (phoneTrim && !normalizeKenyanPhone(phoneTrim)) {
      setSaveError('Enter a valid Kenyan phone number, e.g. 0712 345 678');
      return;
    }

    const data = new FormData();
    data.append('phone', phoneTrim);
    data.append('location', locationInput.trim());
    if (newPicture) data.append('profilePicture', newPicture);

    try {
      setSaving(true);
      const res = await updateProfile(data);
      updateUser(res.data);
      setNewPicture(null);
      setNewPreview(null);
      setSaved(true);
    } catch (err) {
      setSaveError(err.response?.data?.error || 'Could not save changes');
    } finally {
      setSaving(false);
    }
  }

  if (authLoading) {
    return (
      <div className="container">
        <BackButton />
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 0' }}>
          <div style={{ width: '96px', height: '96px', borderRadius: '50%', background: 'var(--color-surface)' }} />
          <p style={{ color: 'var(--color-muted)', marginTop: '12px', fontSize: '13px' }}>Loading profile...</p>
        </div>
      </div>
    );
  }

  const sold = listings.filter((l) => l.status === 'sold');
  const pending = listings.filter((l) => l.status === 'active' || l.status === 'under_review');
  const currentAvatarSrc = newPreview || user?.profilePicture;

  const tabStyle = (active) => ({
    flex: 1,
    padding: '9px 0',
    borderRadius: '8px',
    border: active ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
    background: active ? 'var(--color-primary)' : '#fff',
    color: active ? '#fff' : 'var(--color-ink)',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  });

  const labelStyle = { fontSize: '13px', fontWeight: 600, color: 'var(--color-ink)', display: 'block', marginBottom: '4px' };

  return (
    <div className="container">
      <BackButton />

      <div
        style={{
          width: '100%',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          gap: '4px',
          paddingBottom: '16px',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        {/* Avatar with an edit badge in the corner (edit mode only) -
            clicking the picture itself still opens the lightbox; clicking
            the small camera badge opens the file picker */}
        <div style={{ position: 'relative', margin: '0 auto' }}>
          <button
            type="button"
            onClick={() => currentAvatarSrc && setLightboxOpen(true)}
            style={{ background: 'none', border: 'none', padding: 0, cursor: currentAvatarSrc ? 'zoom-in' : 'default', display: 'block' }}
            aria-label="View profile picture"
          >
            <Avatar
              src={currentAvatarSrc}
              name={user?.fullName}
              size={96}
              style={{ border: '2px solid var(--color-border)' }}
            />
          </button>

          {tab === 'edit' && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handlePick}
                style={{ display: 'none' }}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                aria-label={currentAvatarSrc ? 'Change photo' : 'Add photo'}
                style={{
                  position: 'absolute',
                  bottom: '0',
                  right: '0',
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  background: 'var(--color-primary)',
                  border: '2px solid #fff',
                  color: '#fff',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                📷
              </button>
            </>
          )}
        </div>

        <span style={{ fontWeight: 600, fontSize: '18px', marginTop: '6px' }}>{user?.fullName}</span>
        <span style={{ color: 'var(--color-muted)', fontSize: '13px' }}>{user?.email}</span>
        {user?.location && (
          <span style={{ color: 'var(--color-muted)', fontSize: '13px' }}>📍 {user.location}</span>
        )}
        {user?.phone && (
          <span style={{ color: 'var(--color-muted)', fontSize: '13px' }}>📞 {formatPhone(user.phone)}</span>
        )}
        <div style={{ display: 'flex', gap: '6px', marginTop: '6px', justifyContent: 'center' }}>
          <TrustBadge score={user?.trustScore} />
          <VerificationBadge verificationPath={user?.verificationPath} />
        </div>
      </div>

      {lightboxOpen && (
        <ImageLightbox src={currentAvatarSrc} alt={user?.fullName} onClose={() => setLightboxOpen(false)} />
      )}

      <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
        <button type="button" style={tabStyle(tab === 'sales')} onClick={() => setTab('sales')}>
          Sales
        </button>
        <button type="button" style={tabStyle(tab === 'edit')} onClick={() => setTab('edit')}>
          Edit profile
        </button>
      </div>

      {tab === 'sales' && (
        <div style={{ marginTop: '20px' }}>
          <h3 style={{ fontSize: '16px' }}>Sales</h3>

          {loading && <p style={{ color: 'var(--color-muted)' }}>Loading...</p>}

          {!loading && listings.length === 0 && (
            <div style={{ padding: '16px 0' }}>
              <p style={{ color: 'var(--color-muted)' }}>You haven't made any listings yet.</p>
              <Link to="/create-listing" className="nav-pill" style={{ marginTop: '8px', display: 'inline-block' }}>
                Click to start
              </Link>
            </div>
          )}

          {!loading && listings.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
              <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius)', padding: '10px' }}>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-muted)' }}>Successful sales</p>
                <p style={{ margin: '2px 0 0', fontSize: '20px', fontWeight: 700 }}>{sold.length}</p>
              </div>
              <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius)', padding: '10px' }}>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-muted)' }}>Pending listings</p>
                <p style={{ margin: '2px 0 0', fontSize: '20px', fontWeight: 700 }}>{pending.length}</p>
              </div>
            </div>
          )}

          {listings.map((l) => (
            <div key={l._id} className="divider-row">
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 600 }}>{l.title}</span>
                <p style={{ margin: '2px 0 0', fontSize: '13px', color: 'var(--color-muted)' }}>
                  KES {l.price} &middot; {l.status}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'edit' && (
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '20px' }}>
          <div>
            <label style={labelStyle} htmlFor="edit-phone">Phone number</label>
            <input
              id="edit-phone"
              type="tel"
              inputMode="tel"
              placeholder="e.g. 0712 345 678"
              value={phoneInput}
              onChange={(e) => { setPhoneInput(e.target.value); setSaved(false); }}
              style={{ width: '100%', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={labelStyle} htmlFor="edit-location">Where you live</label>
            <input
              id="edit-location"
              placeholder="e.g. Maseno town, Kisumu"
              maxLength={100}
              value={locationInput}
              onChange={(e) => { setLocationInput(e.target.value); setSaved(false); }}
              style={{ width: '100%', boxSizing: 'border-box' }}
            />
            <p style={{ margin: '6px 0 0', fontSize: '12px', color: 'var(--color-muted)' }}>
              Logged-in buyers can see your phone number and location on your listings.
            </p>
          </div>

          {saveError && <p style={{ color: 'var(--color-warning)', margin: 0 }}>{saveError}</p>}
          {saved && <p style={{ color: 'var(--color-success)', margin: 0 }}>Profile updated</p>}

          <button type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </form>
      )}
    </div>
  );
}