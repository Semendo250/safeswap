import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getConversations } from '../api/chat.api';
import BackButton from '../components/BackButton';

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
        <p style={{ color: 'var(--color-muted)' }}>No conversations yet.</p>
      )}
      <div>
        {conversations.map((c) => (
          <Link
            key={c.listingId}
            to={`/chat/${c.listingId}`}
            state={{ receiverId: c.otherUser.id }}
            className="divider-row"
            style={{ color: 'inherit', alignItems: 'flex-start' }}
          >
            {c.listingPhoto && (
              <img
                src={c.listingPhoto}
                alt={c.listingTitle}
                style={{ width: '52px', height: '52px', objectFit: 'cover', borderRadius: 'var(--radius)', flexShrink: 0 }}
              />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontWeight: 600, fontSize: '14px' }}>{c.otherUser.fullName}</span>
              <p style={{ margin: '2px 0 0', fontSize: '13px', color: 'var(--color-muted)' }}>{c.listingTitle}</p>
              <p style={{ margin: '2px 0 0', fontSize: '13px', color: 'var(--color-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {c.lastMessage}
              </p>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--color-muted)', flexShrink: 0, whiteSpace: 'nowrap' }}>
              {new Date(c.lastMessageAt).toLocaleDateString()}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}