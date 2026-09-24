import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CategoryTabs from '../components/CategoryTabs';
import { createListing } from '../api/listings.api';
import BackButton from '../components/BackButton';

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
    <div style={{ maxWidth: '480px', margin: '0', padding: '1rem' }}>
      <BackButton />
      <h2>Create listing</h2>
      <CategoryTabs value={category} onChange={setCategory} />

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <input placeholder="Title including the name of the phone" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <textarea
          placeholder="Description,tell us more about your phone,e.g storage and RAM"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <input
          type="number"
          placeholder="Price (KES)"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          required
        />

        {category === 'phone' && (
          <>
            <input
              placeholder="IMEI (15 digits)"
              value={imei}
              onChange={(e) => setImei(e.target.value)}
              maxLength={15}
            />
                                              <div>
              <div style={{ fontSize: '13px', color: 'var(--color-muted)', margin: '2px 0 6px' }}>
                One photo showing your phone's IMEI screen together with your National ID, School ID, or
                School Temporary ID, so both are clearly visible in the same shot.
                <br />
                To find your IMEI: dial <strong>*#06#</strong> on the phone, and a screen showing the IMEI
                number(s) will appear — photograph that screen next to your ID.
              </div>
              <label>
                Proof photo
                <input type="file" accept="image/*" onChange={(e) => setProofPhoto(e.target.files[0])} />
              </label>
            </div>
          </>
        )}

        <label>
          Item photos (up to 5)
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setPhotos(Array.from(e.target.files).slice(0, 5))}
          />
        </label>

        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit" disabled={submitting} style={{ minWidth: '200px', padding: '11px 28px' }}>
          {submitting ? 'Publishing...' : 'Publish listing'}
        </button>
      </form>
    </div>
  );
}