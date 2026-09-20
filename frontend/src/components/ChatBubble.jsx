import { useState, useRef } from 'react';

export default function ChatBubble({ message, isOwn, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pressTimer = useRef(null);

  const time = new Date(message.createdAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  function openMenu(e) {
    e.preventDefault();
    setMenuOpen(true);
  }

  function startPress(e) {
    pressTimer.current = setTimeout(() => setMenuOpen(true), 500);
  }
  function cancelPress() {
    clearTimeout(pressTimer.current);
  }

  return (
    <div style={{ display: 'flex', justifyContent: isOwn ? 'flex-end' : 'flex-start', marginBottom: '10px', position: 'relative' }}>
      <div
        onContextMenu={openMenu}
        onTouchStart={startPress}
        onTouchEnd={cancelPress}
        onTouchMove={cancelPress}
        style={{
          maxWidth: '70%',
          padding: '9px 13px',
          borderRadius: isOwn ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
          background: isOwn ? 'var(--color-primary)' : 'var(--color-surface)',
          color: isOwn ? '#fff' : 'var(--color-ink)',
          border: isOwn ? 'none' : '1px solid var(--color-border)',
          userSelect: 'none',
          cursor: 'pointer',
        }}
      >
        <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.4, fontStyle: message.deletedForEveryone ? 'italic' : 'normal', opacity: message.deletedForEveryone ? 0.7 : 1 }}>
          {message.content}
        </p>
        <span style={{ fontSize: '10px', opacity: isOwn ? 0.75 : 0.6, display: 'block', marginTop: '2px' }}>
          {time}
        </span>
      </div>

      {menuOpen && !message.deletedForEveryone && (
        <>
          <div
            onClick={() => setMenuOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 10 }}
          />
          <div
            style={{
              position: 'absolute',
              [isOwn ? 'right' : 'left']: 0,
              top: '100%',
              marginTop: '4px',
              background: '#fff',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
              zIndex: 11,
              overflow: 'hidden',
              minWidth: '160px',
            }}
          >
            <button
              onClick={() => { onDelete(message._id, false); setMenuOpen(false); }}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', background: '#fff', color: 'var(--color-ink)', border: 'none', borderRadius: 0, fontSize: '13px' }}
            >
              Delete for me
            </button>
            {isOwn && (
              <button
                onClick={() => { onDelete(message._id, true); setMenuOpen(false); }}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', background: '#fff', color: 'var(--color-warning)', border: 'none', borderRadius: 0, fontSize: '13px', borderTop: '1px solid var(--color-border)' }}
              >
                Delete for everyone
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}