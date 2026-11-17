import { useState, useRef } from 'react';
import ChatTicks from './ChatTicks';

// The bubble look (colours, tail, time and ticks inside the bubble) comes from the
// .wa-* rules in Chat.jsx. Long-press or right-click opens the delete menu.
export default function ChatBubble({ message, isOwn, onDelete, tail = false }) {
  const [menuOpen, setMenuOpen] = useState(false);
  // useRef, not a plain variable, so the long-press timer can always be cancelled
  const pressTimer = useRef(null);
  const isDeleted = message.deletedForEveryone;

  const time = new Date(message.createdAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  function openMenu(e) {
    e.preventDefault();
    if (!isDeleted) setMenuOpen(true);
  }
  function startPress() {
    if (isDeleted) return;
    pressTimer.current = setTimeout(() => setMenuOpen(true), 500);
  }
  function cancelPress() {
    clearTimeout(pressTimer.current);
  }

  function handleDelete(forEveryone) {
    onDelete(message._id, forEveryone);
    setMenuOpen(false);
  }

  return (
    <div className={`wa-row ${isOwn ? 'own' : 'them'}${tail ? ' tail' : ''}`}>
      <div
        className={isDeleted ? 'wa-bubble deleted' : 'wa-bubble'}
        onContextMenu={openMenu}
        onTouchStart={startPress}
        onTouchEnd={cancelPress}
        onTouchMove={cancelPress}
      >
        <span className="wa-text">{isDeleted ? '🚫 This message was deleted' : message.content}</span>
        <span className="wa-meta">
          {time}
          {isOwn && !isDeleted && (
            <ChatTicks
              read={!!message.read}
              delivered={!!message.delivered}
              size={16}
              readColor="#65C1CF"
              idleColor="rgba(255,255,255,0.7)"
            />
          )}
        </span>
      </div>

      {menuOpen && !isDeleted && (
        <div style={s.overlay} onClick={() => setMenuOpen(false)}>
          <div style={s.sheet} onClick={(e) => e.stopPropagation()}>
            <p style={s.sheetTitle}>Delete message?</p>
            <button style={s.deleteForMe} onClick={() => handleDelete(false)}>
              🗑️ Delete for me
            </button>
            {isOwn && (
              <button style={s.deleteForAll} onClick={() => handleDelete(true)}>
                🗑️ Delete for everyone
              </button>
            )}
            <button style={s.cancel} onClick={() => setMenuOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.4)',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    zIndex: 1000,
    padding: 20,
  },
  sheet: {
    background: 'var(--color-card)',
    borderRadius: 16,
    padding: '20px 24px',
    width: '100%',
    maxWidth: 360,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    boxShadow: '0 -4px 24px rgba(0,0,0,0.1)',
  },
  sheetTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: 'var(--color-ink)',
    margin: '0 0 4px',
    textAlign: 'center',
  },
  deleteForMe: {
    padding: 11,
    background: 'var(--color-surface)',
    border: 'none',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    color: 'var(--color-ink)',
  },
  deleteForAll: {
    padding: 11,
    background: 'color-mix(in srgb, var(--color-warning) 12%, var(--color-card))',
    border: 'none',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    color: 'var(--color-warning)',
  },
  cancel: {
    padding: 11,
    background: 'var(--color-card)',
    border: '0.5px solid var(--color-border)',
    borderRadius: 10,
    fontSize: 14,
    cursor: 'pointer',
    color: 'var(--color-muted)',
  },
};