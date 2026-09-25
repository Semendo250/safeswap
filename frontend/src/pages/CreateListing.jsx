import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import CategoryTabs from '../components/CategoryTabs';
import { createListing } from '../api/listings.api';
import BackButton from '../components/BackButton';

const cardStyle = {
  background: '#fff',
  border: '1px solid var(--color-border)',
  borderRadius: 14,
  padding: 18,
  marginBottom: 16,
  boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
};

const sectionLabelStyle = {
  fontSize: 12,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: 'var(--color-teal)',
  marginBottom: 12,
  display: 'flex',
  alignItems: 'center',
  gap: 6,
};

const fieldLabelStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 13,
  color: 'var(--color-muted)',
  marginBottom: 6,
  fontWeight: 500,
};

function UploadBox({ icon, mainText, subText, filesSummary, onClick }) {
  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      style={{
        border: '2px dashed var(--color-border)',
        borderRadius: 12,
        padding: '22px 16px',
        textAlign: 'center',
        background: 'var(--color-surface)',
        cursor: 'pointer',
      }}
    >
      <div style={{ fontSize: 26, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-teal)' }}>
        {filesSummary || mainText}
      </div>
      <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 3 }}>{subText}</div>
    </div>
  );
}

export default function CreateListing() {
  const navigate = useNavigate();
  const [category, setCategory] = useState('general');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [imei, setImei] = useState('');
  const [photos, setPhotos] = useState([]);
  const [proofPhoto, setProofPhoto] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const proofInputRef = useRef(null);
  const photosInputRef = useRef(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (category === 'phone' && (!imei || !proofPhoto)) {
      setError('IMEI and a proof photo are required for phone listings');
      return;
    }
    if (photos.length === 0) {
      setError('At least one photo is required');
      return;
    }

    const formData = new FormData();
    formData.append('title', title);
    formData.append('description', description);
    formData.append('price', price);
    formData.append('category', category);
    if (category === 'phone') {
      formData.append('imei', imei);
      formData.append('proofPhoto', proofPhoto);
    }
    photos.forEach((file) => formData.append('photos', file));

    try {
      setSubmitting(true);
      const res = await createListing(formData);
      navigate(`/listings/${res.data._id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create listing');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: '560px', margin: '0 auto', padding: '16px', boxSizing: 'border-box' }}>
      <BackButton />
      <h1 style={{ fontSize: 26, margin: '0 0 16px' }}>Create listing</h1>

      <div style={{ marginBottom: 18 }}>
        <CategoryTabs value={category} onChange={setCategory} />
      </div>

      <form onSubmit={handleSubmit}>
        <div style={cardStyle}>
          <div style={sectionLabelStyle}>📝 Item details</div>

          <div style={{ marginBottom: 12 }}>
            <div style={fieldLabelStyle}>🏷️ Title</div>
            <input
              placeholder="Title including name of your item"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={fieldLabelStyle}>💬 Description</div>
            <textarea
              placeholder="Tell us more about your item — condition, accessories, reason for selling"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{ width: '100%', minHeight: 70 }}
            />
          </div>

          <div>
            <div style={fieldLabelStyle}>💵 Price (KES)</div>
            <input
              type="number"
              placeholder="e.g. 12000"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
              style={{ width: '100%' }}
            />
          </div>
        </div>

        {category === 'phone' && (
          <div style={cardStyle}>
            <div style={sectionLabelStyle}>🔒 Verification</div>

            <div style={{ marginBottom: 12 }}>
              <div style={fieldLabelStyle}>🔢 IMEI (15 digits)</div>
              <input
                placeholder="Dial *#06# to find it"
                value={imei}
                onChange={(e) => setImei(e.target.value)}
                maxLength={15}
                style={{ width: '100%' }}
              />
            </div>

            <div
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 12,
                padding: 14,
                fontSize: 13,
                color: 'var(--color-ink)',
                lineHeight: 1.5,
                marginBottom: 16,
                display: 'flex',
                gap: 10,
              }}
            >
              <div style={{ fontSize: 18, flexShrink: 0 }}>ℹ️</div>
              <div>
                One photo showing your phone's IMEI screen together with your National ID, School ID, or
                School Temporary ID — both clearly visible in the same shot.
                <br />
                <br />
                To find your IMEI: dial{' '}
                <code
                  style={{
                    background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)',
                    padding: '1px 6px',
                    borderRadius: 5,
                    fontWeight: 700,
                  }}
                >
                  *#06#
                </code>{' '}
                and photograph the screen next to your ID.
              </div>
            </div>

            <div>
              <div style={fieldLabelStyle}>📸 Proof photo</div>
              <input
                ref={proofInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => setProofPhoto(e.target.files[0] || null)}
                style={{ display: 'none' }}
              />
              <UploadBox
                icon="⬆️"
                mainText="Tap to upload proof photo"
                subText={proofPhoto ? proofPhoto.name : 'IMEI screen + ID, one shot'}
                onClick={() => proofInputRef.current?.click()}
              />
            </div>
          </div>
        )}

        <div style={cardStyle}>
          <div style={sectionLabelStyle}>🖼️ Item photos</div>
          <div>
            <div style={fieldLabelStyle}>Up to 5 photos</div>
            <input
              ref={photosInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setPhotos(Array.from(e.target.files).slice(0, 5))}
              style={{ display: 'none' }}
            />
            <UploadBox
              icon="🖼️"
              mainText="Tap to add photos"
              subText={
                photos.length > 0
                  ? `${photos.length} photo${photos.length === 1 ? '' : 's'} selected`
                  : 'Clear photos sell faster'
              }
              onClick={() => photosInputRef.current?.click()}
            />
          </div>
        </div>

        {error && <p style={{ color: 'var(--color-warning)', marginBottom: 12 }}>{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          style={{
            width: '100%',
            padding: 15,
            fontSize: 16,
            fontWeight: 700,
            borderRadius: 12,
            boxShadow: '0 4px 14px color-mix(in srgb, var(--color-primary) 25%, transparent)',
          }}
        >
          {submitting ? 'Publishing...' : 'Publish listing'}
        </button>
      </form>
    </div>
  );
}