import { useState } from 'react';

export default function ChatBubble({ message, isOwn, onDelete, otherUserName }) {
  const [menuOpen, setMenuOpen] = useState(false);
  let pressTimer = null;

  const time = new Date(message.createdAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  function openMenu(e) {
    e.preventDefault();
    setMenuOpen(true);
  }
  function startPress() {
    pressTimer = setTimeout(() => setMenuOpen(true), 500);
  }
  function cancelPress() {
    clearTimeout(pressTimer);
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: '8px',
        justifyContent: isOwn ? 'flex-end' : 'flex-start',
        marginBottom: '10px',
        position: 'relative',
      }}
    >
      {!isOwn && (
        <div
          style={{
            width: '26px',
            height: '26px',
            borderRadius: '50%',
            background: 'var(--color-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <span style={{ color: '#fff', fontWeight: 700, fontSize: '11px' }}>
            {otherUserName?.[0]?.toUpperCase() || '?'}
          </span>
        </div>
      )}

      <div
        onContextMenu={openMenu}
        onTouchStart={startPress}
        onTouchEnd={cancelPress}
        onTouchMove={cancelPress}
        style={{
          maxWidth: '72%',
          padding: '9px 13px',
          borderRadius: isOwn ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
          background: isOwn ? 'var(--color-primary)' : '#fff',
          color: isOwn ? '#fff' : 'var(--color-ink)',
          border: isOwn ? 'none' : '1px solid var(--color-border)',
          boxShadow: isOwn ? 'none' : '0 1px 3px rgba(0,0,0,0.05)',
          userSelect: 'none',
          cursor: 'pointer',
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: '14px',
            lineHeight: 1.5,
            fontStyle: message.deletedForEveryone ? 'italic' : 'normal',
            opacity: message.deletedForEveryone ? 0.65 : 1,
          }}
        >
          {message.deletedForEveryone ? '🚫 This message was deleted' : message.content}
        </p>
        <span style={{ fontSize: '10px', opacity: isOwn ? 0.75 : 0.55, display: 'block', marginTop: '3px' }}>
          {time}
        </span>
      </div>

      {menuOpen && !message.deletedForEveryone && (
        <>
          <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 10 }} />
          <div
            style={{
              position: 'absolute',
              [isOwn ? 'right' : 'left']: 0,
              top: '100%',
              marginTop: '4px',
              background: '#fff',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius)',
              boxShadow: '0 2px 10px rgba(0,0,0,0.12)',
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