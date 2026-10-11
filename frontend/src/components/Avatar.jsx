import { useState, useEffect } from 'react';

export default function Avatar({ src, name, size = 40, style }) {
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    setBroken(false);
  }, [src]);

  const showImage = src && !broken;
  const initial = typeof name === 'string' ? name.trim()[0]?.toUpperCase() : '';

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'var(--color-primary)',
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
        <span style={{ color: '#fff', fontWeight: 700, fontSize: Math.round(size * 0.4) }}>{initial}</span>
      ) : (
        // No photo and no name yet: a plain person silhouette instead of a question mark
        <svg
          width={Math.round(size * 0.6)}
          height={Math.round(size * 0.6)}
          viewBox="0 0 24 24"
          fill="#fff"
          aria-hidden="true"
          style={{ display: 'block' }}
        >
          <circle cx="12" cy="8.5" r="4" />
          <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z" />
        </svg>
      )}
    </div>
  );
}