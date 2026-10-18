import { useEffect, useState } from 'react';
import { getMyReviewStatus, createReview } from '../api/reviews.api';
import { Stars, StarInput } from './Stars';

const box = {
  border: '1px solid var(--color-border)',
  borderRadius: 12,
  padding: 14,
  background: 'var(--color-card)',
  marginTop: 12,
};

export default function ReviewBox({ listingId }) {
  const [state, setState] = useState(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    getMyReviewStatus(listingId)
      .then((res) => {
        if (!cancelled) setState(res.data);
      })
      .catch(() => {
        if (!cancelled) setState({ eligible: false, review: null });
      });
    return () => {
      cancelled = true;
    };
  }, [listingId]);

  async function submit(e) {
    e.preventDefault();
    if (!rating) {
      setError('Pick a rating from 1 to 5 stars');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await createReview(listingId, rating, comment.trim());
      setState({ eligible: true, review: res.data.review });
    } catch (err) {
      setError(!err.response ? 'Network error. Check your connection.' : err.response.data?.error || 'Could not save your review');
    } finally {
      setBusy(false);
    }
  }

  if (!state || !state.eligible) return null;

  if (state.review) {
    return (
      <div style={box}>
        <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600 }}>Your review</p>
        <Stars value={state.review.rating} size={18} />
        {state.review.comment && (
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--color-muted)' }}>{state.review.comment}</p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit} style={box}>
      <p style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 600 }}>How was this seller?</p>
      <StarInput value={rating} onChange={setRating} />
      <textarea
        rows={3}
        maxLength={300}
        placeholder="Add a short comment (optional)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        style={{ margin: '8px 0' }}
      />
      {error && <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--color-warning)' }}>{error}</p>}
      <button type="submit" disabled={busy}>
        {busy ? 'Saving...' : 'Submit review'}
      </button>
    </form>
  );
}