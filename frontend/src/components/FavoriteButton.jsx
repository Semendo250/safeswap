import { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { addFavorite, removeFavorite } from '../api/favorites.api';

export default function FavoriteButton({ listingId, initial = false, variant = 'icon', onChange }) {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [saved, setSaved] = useState(!!initial);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSaved(!!initial);
  }, [initial]);

  async function toggle(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      navigate('/login', { state: { from: `/listings/${listingId}` } });
      return;
    }
    if (busy) return;
    const next = !saved;
    setBusy(true);
    setSaved(next);
    try {
      if (next) await addFavorite(listingId);
      else await removeFavorite(listingId);
      if (onChange) onChange(next);
    } catch (err) {
      setSaved(!next);
      alert(err.response?.data?.error || 'Could not update your saved items');
    } finally {
      setBusy(false);
    }
  }

  if (variant === 'pill') {
    return (
      <button
        type="button"
        onClick={toggle}
        style={{
          minWidth: 0,
          padding: '7px 12px',
          fontSize: 13,
          fontWeight: 600,
          borderRadius: 999,
          cursor: 'pointer',
          background: saved ? 'color-mix(in srgb, var(--color-warning) 12%, var(--color-card))' : 'transparent',
          border: '1px solid var(--color-border)',
          color: saved ? 'var(--color-warning)' : 'var(--color-ink)',
        }}
      >
        {saved ? '♥ Saved' : '♡ Save'}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={saved ? 'Remove from saved' : 'Save listing'}
      style={{
        minWidth: 0,
        width: 36,
        height: 36,
        padding: 0,
        flexShrink: 0,
        border: 'none',
        background: 'transparent',
        fontSize: 20,
        lineHeight: 1,
        cursor: 'pointer',
        color: saved ? 'var(--color-warning)' : 'var(--color-muted)',
      }}
    >
      {saved ? '♥' : '♡'}
    </button>
  );
}