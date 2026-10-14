import { useState, useEffect } from 'react';
import ImageLightbox from './ImageLightbox';

export default function Avatar({ src, name, size = 40, style, soft = false, zoomable = false }) {
  const [broken, setBroken] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);

  useEffect(() => {
    setBroken(false);
  }, [src]);

  const showImage = src && !broken;
  const initial = typeof name === 'string' ? name.trim()[0]?.toUpperCase() : '';

  // `soft` is a tinted circle with coloured initials instead of solid teal with white text
  const background = soft ? 'color-mix(in srgb, var(--color-teal) 22%, var(--color-card))' : 'var(--color-primary)';
  const textColor = soft ? 'var(--color-teal)' : '#fff';

    const circle = (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        flexShrink: 0,
        ...style,
      }}
    >
      {showImage ? (
        <img
          src={src}
          alt=""
          draggable={false}
          onError={() => setBroken(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : initial ? (
        <span style={{ color: textColor, fontWeight: 700, fontSize: Math.round(size * 0.4) }}>{initial}</span>
      ) : (
        // No photo and no name yet: a plain person silhouette instead of a question mark
        <svg
          width={Math.round(size * 0.6)}
          height={Math.round(size * 0.6)}
          viewBox="0 0 24 24"
          fill={textColor}
          aria-hidden="true"
          style={{ display: 'block' }}
        >
          <circle cx="12" cy="8.5" r="4" />
          <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z" />
        </svg>
           )}
    </div>
  );

  // Zoom only applies when it was asked for and there is a real photo to enlarge
  if (!zoomable || !showImage) return circle;

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setZoomOpen(true);
        }}
        aria-label={`View ${name ? `${name}'s` : 'profile'} picture`}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          margin: 0,
          minWidth: 0,
          minHeight: 0,
          width: size,
          height: size,
          borderRadius: '50%',
          display: 'block',
          flexShrink: 0,
          alignSelf: 'auto',
          cursor: 'zoom-in',
        }}
      >
        {circle}
      </button>

      {zoomOpen && (
        <span onClick={(e) => e.stopPropagation()}>
          <ImageLightbox src={src} alt={name} onClose={() => setZoomOpen(false)} />
        </span>
      )}
    </>
  );
}