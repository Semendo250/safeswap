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
      <BackButton />
      <h2>Messages</h2>

      {loading && <p style={{ color: 'var(--color-muted)' }}>Loading...</p>}

      {!loading && conversations.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <p style={{ fontSize: '32px', margin: 0 }}>💬</p>
          <p style={{ fontWeight: 600, margin: '8px 0 2px' }}>No messages yet</p>
          <p style={{ color: 'var(--color-muted)', fontSize: '13px' }}>
            Visit a listing and message the seller to start a conversation.
          </p>
        </div>
      )}

      <div>
        {conversations.map((c) => (
          <Link
            key={c.listingId}
            to={`/chat/${c.listingId}`}
            state={{ receiverId: c.otherUser.id }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 4px',
              borderBottom: '1px solid var(--color-border)',
              color: 'inherit',
            }}
          >
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                background: 'var(--color-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                overflow: 'hidden',
              }}
            >
              <span style={{ color: '#fff', fontWeight: 700, fontSize: '16px' }}>
                {c.otherUser.fullName?.[0]?.toUpperCase()}
              </span>
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '2px' }}>{c.otherUser.fullName}</div>
              <div style={{ fontSize: '12px', color: 'var(--color-teal)', marginBottom: '2px' }}>{c.listingTitle}</div>
              <div
                style={{
                  fontSize: '13px',
                  color: 'var(--color-muted)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {c.lastMessage}
              </div>
            </div>

            <div style={{ fontSize: '11px', color: 'var(--color-muted)', flexShrink: 0, whiteSpace: 'nowrap' }}>
              {timeAgo(c.lastMessageAt)}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}