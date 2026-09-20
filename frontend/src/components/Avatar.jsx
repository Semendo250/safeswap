import { useState, useEffect } from 'react';

export default function Avatar({ src, name, size = 40, style }) {
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    setBroken(false);
  }, [src]);

  const showImage = src && !broken;

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
      ) : (
        <span style={{ color: '#fff', fontWeight: 700, fontSize: Math.round(size * 0.4) }}>
          {name?.[0]?.toUpperCase() || '?'}
        </span>
      )}
    </div>
  );
}