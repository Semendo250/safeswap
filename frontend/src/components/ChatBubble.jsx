import { useState, useRef } from 'react';

// Styling ported from the SkillVault chat (bubble shape, hairline border,
// bottom-sheet delete menu). Colours all come from this app's CSS variables.
export default function ChatBubble({ message, isOwn, onDelete, otherUserName }) {
  const [menuOpen, setMenuOpen] = useState(false);
  // useRef, not a plain variable: a plain `let` is reset on every re-render,
  // which can make the long-press timer impossible to cancel.
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
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: 8,
        justifyContent: isOwn ? 'flex-end' : 'flex-start',
        flexShrink: 0,
      }}
    >
      {!isOwn && (
        <div style={s.avatar}>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 12 }}>
            {otherUserName?.[0]?.toUpperCase() || '?'}
          </span>
        </div>
      )}

      {/* .msg-bubble is widened to 85% on small screens by a rule in Chat.jsx */}
      <div className="msg-bubble" style={{ maxWidth: '70%' }}>
        {isDeleted ? (
          <div style={s.bubbleDeleted}>🚫 This message was deleted</div>
        ) : (
          <div
            onContextMenu={openMenu}
            onTouchStart={startPress}
            onTouchEnd={cancelPress}
            onTouchMove={cancelPress}
            style={{ ...s.bubble, ...(isOwn ? s.bubbleMe : s.bubbleThem) }}
          >
            {message.content}
          </div>
        )}
        <p style={{ ...s.time, textAlign: isOwn ? 'right' : 'left' }}>{time}</p>
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
  avatar: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    background: 'var(--color-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  bubble: {
    padding: '9px 13px',
    borderRadius: 16,
    fontSize: 14,
    lineHeight: 1.5,
    wordBreak: 'break-word',
    overflowWrap: 'anywhere',
    whiteSpace: 'pre-wrap', // so Shift+Enter line breaks actually show
    cursor: 'pointer',
    userSelect: 'none',
  },
  bubbleMe: {
    background: 'var(--color-primary)',
    color: '#fff',
    borderBottomRightRadius: 4,
  },
    bubbleThem: {
    background: 'var(--color-card)',
    color: 'var(--color-ink)',
    borderBottomLeftRadius: 4,
    border: '0.5px solid var(--color-border)',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  },
  bubbleDeleted: {
    padding: '8px 12px',
    borderRadius: 12,
    background: 'rgba(0,0,0,0.04)',
    color: 'var(--color-muted)',
    fontSize: 13,
    fontStyle: 'italic',
    border: '0.5px solid var(--color-border)',
  },
  time: {
    fontSize: 10,
    color: 'var(--color-muted)',
    margin: '3px 0 0',
    padding: '0 4px',
  },
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
    // faint tint of whatever --color-warning is, so it stays on-palette
    background: 'color-mix(in srgb, var(--color-warning) 10%, #fff)',
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
