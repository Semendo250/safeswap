import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getConversations } from '../api/chat.api';
import BackButton from '../components/BackButton';

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function Inbox() {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getConversations()
      .then((res) => setConversations(res.data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="container">
      <style>{`
        .inbox-row {
          border-bottom: 0.5px solid var(--color-border);
          transition: background 0.15s;
        }
        .inbox-row:last-child { border-bottom: none; }
        .inbox-row:hover {
          background: color-mix(in srgb, var(--color-primary) 6%, transparent);
        }
      `}</style>

      <BackButton />
      <h2>Messages</h2>

      {loading && <p style={{ color: 'var(--color-muted)' }}>Loading...</p>}

      {!loading && (
        <div style={s.card}>
          <div style={s.cardHeader}>
            <span style={s.cardTitle}>Conversations</span>
            <span style={s.count}>{conversations.length}</span>
          </div>

          {conversations.length === 0 ? (
            <div style={s.empty}>
              <p style={{ fontSize: 36, margin: '0 0 8px' }}>💬</p>
              <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-ink)', margin: '0 0 4px' }}>
                No messages yet
              </p>
              <p style={{ fontSize: 13, color: 'var(--color-muted)', lineHeight: 1.5, margin: 0 }}>
                Visit a listing and message the seller to start a conversation.
              </p>
            </div>
          ) : (
            <div>
              {conversations.map((c) => (
                <Link
                  key={c.listingId}
                  to={`/chat/${c.listingId}`}
                  state={{ receiverId: c.otherUser.id }}
                  className="inbox-row"
                  style={s.row}
                >
                  <div style={s.avatar}>
                    <span style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>
                      {c.otherUser.fullName?.[0]?.toUpperCase()}
                    </span>
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={s.name}>{c.otherUser.fullName}</div>
                    <div style={s.listing}>{c.listingTitle}</div>
                    <div style={s.preview}>{c.lastMessage}</div>
                  </div>

                  <div style={s.time}>{timeAgo(c.lastMessageAt)}</div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const s = {
  card: {
    background: 'var(--color-card)',
    border: '0.5px solid var(--color-border)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  cardHeader: {
    padding: '14px 16px',
    borderBottom: '0.5px solid var(--color-border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: { fontSize: 14, fontWeight: 700, color: 'var(--color-ink)' },
  count: {
    fontSize: 12,
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: 10,
    color: 'var(--color-teal)',
    background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 14px',
    color: 'inherit',
    textDecoration: 'none',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: '50%',
    background: 'var(--color-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    overflow: 'hidden',
  },
  name: { fontSize: 14, fontWeight: 600, color: 'var(--color-ink)', marginBottom: 2 },
  listing: { fontSize: 12, color: 'var(--color-teal)', marginBottom: 2 },
  preview: {
    fontSize: 12,
    color: 'var(--color-muted)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  time: { fontSize: 11, color: 'var(--color-muted)', flexShrink: 0, whiteSpace: 'nowrap' },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '2rem',
    textAlign: 'center',
  },
};
