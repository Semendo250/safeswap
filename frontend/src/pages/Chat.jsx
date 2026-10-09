import { useState, useEffect, useContext, useRef } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import socket from '../socket';
import { getConversation, sendMessage, deleteMessage, markAsRead } from '../api/chat.api';
import { getListingById } from '../api/listings.api';
import ChatBubble from '../components/ChatBubble';
import ChatInput from '../components/ChatInput';

const NAVBAR_HEIGHT = 68;

// Same room name the server relays to — must match on both ends
function roomFor(listingId, userId, otherUserId) {
  if (!listingId || !userId || !otherUserId) return null;
  return [listingId, [userId, otherUserId].sort().join('-')].join(':');
}

export default function Chat() {
  const { listingId } = useParams();
  const { user, loading: authLoading } = useContext(AuthContext);
  const location = useLocation();
  const [messages, setMessages] = useState([]);
  const [receiverId, setReceiverId] = useState(location.state?.receiverId || null);
  const [listingTitle, setListingTitle] = useState('');
  const [listingSellerId, setListingSellerId] = useState(null);
  const [otherTyping, setOtherTyping] = useState(false);
  const [otherOnline, setOtherOnline] = useState(false);
  const bottomRef = useRef(null);
  const messagesBoxRef = useRef(null);
  const outerRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    if (!listingId) return;
    getListingById(listingId).then((res) => {
      setListingTitle(res.data.title);
      setListingSellerId(res.data.seller?._id || null);
    });
  }, [listingId]);

  // If we weren't told who the other person is (e.g. a bookmarked link) and I'm
  // not the seller, the other person must be the seller
  useEffect(() => {
    if (receiverId || !user || !listingSellerId) return;
    if (listingSellerId !== user.id) setReceiverId(listingSellerId);
  }, [receiverId, user, listingSellerId]);

  useEffect(() => {
    if (!listingId || authLoading || !user || !receiverId) return;
    const room = roomFor(listingId, user.id, receiverId);
    getConversation(listingId, receiverId).then((res) => {
      setMessages(res.data.messages);
      // Anything already here that I haven't read yet: mark it read now that I'm viewing it
      res.data.messages
        .filter((m) => m.sender._id !== user.id && !m.read && !m.deletedForEveryone)
        .forEach((m) => {
          markAsRead(m._id).catch(() => {});
          if (room) socket.emit('message_seen', { room, messageId: m._id });
        });
    });
  }, [listingId, user, authLoading, receiverId]);

  // Ask whether the other person is online as soon as we know who they are
  useEffect(() => {
    if (!receiverId) return;
    socket.emit('check_online', receiverId, (online) => setOtherOnline(!!online));
  }, [receiverId]);

  useEffect(() => {
    if (!listingId || !user) return;
    // Room is per (listing, the two participants), not per listing alone,
    // so messages from a different buyer about the same item don't arrive here
    const room = roomFor(listingId, user.id, receiverId);
    if (!room) return;
    socket.emit('join_chat', room);

    function handleIncoming(data) {
      if (data.senderId === user.id) return;
      setMessages((prev) => {
        if (prev.some((m) => m._id === data._id)) return prev;
        return [...prev, { ...data, sender: { _id: data.senderId }, receiver: { _id: data.receiverId } }];
      });
      // The chat is open right now, so this message counts as seen immediately
      markAsRead(data._id).catch(() => {});
      socket.emit('message_seen', { room, messageId: data._id });
    }
    function handleDeleted(data) {
      if (data.forEveryone) {
        setMessages((prev) =>
          prev.map((m) =>
            m._id === data.messageId ? { ...m, content: 'This message was deleted', deletedForEveryone: true } : m
          )
        );
      }
    }
    function handleDelivered({ messageId }) {
      setMessages((prev) => prev.map((m) => (m._id === messageId ? { ...m, delivered: true } : m)));
    }
    function handleSeen({ messageId }) {
      setMessages((prev) => prev.map((m) => (m._id === messageId ? { ...m, read: true } : m)));
    }
    function handleTypingEvt({ room: r }) {
      if (r === room) setOtherTyping(true);
    }
    function handleStopTypingEvt({ room: r }) {
      if (r === room) setOtherTyping(false);
    }
    function handleUserOnline({ userId }) {
      if (userId === receiverId) setOtherOnline(true);
    }
    function handleUserOffline({ userId }) {
      if (userId === receiverId) setOtherOnline(false);
    }

    socket.on('receive_message', handleIncoming);
    socket.on('message_deleted', handleDeleted);
    socket.on('message_delivered', handleDelivered);
    socket.on('message_seen', handleSeen);
    socket.on('typing', handleTypingEvt);
    socket.on('stop_typing', handleStopTypingEvt);
    socket.on('user_online', handleUserOnline);
    socket.on('user_offline', handleUserOffline);
    return () => {
      socket.off('receive_message', handleIncoming);
      socket.off('message_deleted', handleDeleted);
      socket.off('message_delivered', handleDelivered);
      socket.off('message_seen', handleSeen);
      socket.off('typing', handleTypingEvt);
      socket.off('stop_typing', handleStopTypingEvt);
      socket.off('user_online', handleUserOnline);
      socket.off('user_offline', handleUserOffline);
    };
  }, [listingId, user, receiverId]);

  // Keep the messages scrolled to the latest, scoped to the box itself
  // (never the whole page), so nothing shifts sideways or moves the navbar
  useEffect(() => {
    const box = messagesBoxRef.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [messages, otherTyping]);

  // Pin the chat container to the visual viewport, so the input row stays
  // directly above the on-screen keyboard when it's open, and sits at the
  // true bottom of the screen when it's closed. The navbar height is
  // subtracted so this container starts right below it.
  useEffect(() => {
    const outer = outerRef.current;
    if (!outer) return;

    function update() {
      const vv = window.visualViewport;
      if (!vv) return;
      outer.style.top = vv.offsetTop + NAVBAR_HEIGHT + 'px';
      outer.style.height = vv.height - NAVBAR_HEIGHT + 'px';
      const box = messagesBoxRef.current;
      if (box) box.scrollTop = box.scrollHeight;
    }

    update();
    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);
    return () => {
      window.visualViewport?.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('scroll', update);
    };
  }, []);

  function handleTyping() {
    const room = roomFor(listingId, user.id, receiverId);
    if (!room) return;
    socket.emit('typing', { room });
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stop_typing', { room });
    }, 1500);
  }

  async function handleDelete(messageId, forEveryone) {
    try {
      await deleteMessage(messageId, forEveryone);
      if (forEveryone) {
        setMessages((prev) =>
          prev.map((m) =>
            m._id === messageId ? { ...m, content: 'This message was deleted', deletedForEveryone: true } : m
          )
        );
        socket.emit('delete_message', {
          room: roomFor(listingId, user.id, receiverId),
          listingId,
          messageId,
          forEveryone: true,
        });
      } else {
        setMessages((prev) => prev.filter((m) => m._id !== messageId));
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete message');
    }
  }

  // Returns false on failure so ChatInput keeps the typed text.
  async function handleSend(content) {
    if (!receiverId) {
      alert('Cannot determine who to message — please open this chat from the listing page.');
      return false;
    }
    try {
      const res = await sendMessage(listingId, receiverId, content);
      const saved = res.data;
      setMessages((prev) => [
        ...prev,
        { ...saved, sender: { _id: user.id, fullName: user.fullName }, receiver: { _id: receiverId } },
      ]);
      clearTimeout(typingTimeoutRef.current);
      socket.emit('stop_typing', { room: roomFor(listingId, user.id, receiverId) });
      socket.emit('send_message', {
        room: roomFor(listingId, user.id, receiverId),
        listingId,
        senderId: user.id,
        receiverId,
        content: saved.content,
        _id: saved._id,
        createdAt: saved.createdAt,
      });
      return true;
    } catch (err) {
      alert(
        !err.response
          ? 'Network error — check your connection.'
          : err.response?.data?.error || 'Failed to send.'
      );
      return false;
    }
  }

  if (authLoading) return null;
  if (!user) return <p style={{ padding: '1rem' }}>Please log in to view this conversation.</p>;

  return (
    <div
      ref={outerRef}
      style={{
        position: 'fixed',
        // initial values; the visualViewport effect overrides top/height
        top: NAVBAR_HEIGHT,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        flexDirection: 'column',
        padding: 12,
        boxSizing: 'border-box',
        overflow: 'hidden',
        background: 'var(--color-bg)',
        touchAction: 'none',
      }}
    >
      <style>{`
        @keyframes typingBounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
        .typing-dot {
          display: inline-block; width: 6px; height: 6px; border-radius: 50%;
          background: var(--color-muted); margin: 0 2px; animation: typingBounce 1.2s infinite;
        }
        @media (max-width: 640px) {
          .msg-bubble { max-width: 85% !important; }
          .msg-input-row { gap: 4px !important; padding: 8px !important; }
        }
      `}</style>

      {/* The chat "card": hairline border + 12px radius, like the source app */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--color-card)',
          border: '0.5px solid var(--color-border)',
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '0.5px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'var(--color-surface)',
            flexShrink: 0,
          }}
        >
          <Link to={`/listings/${listingId}`} style={{ color: 'var(--color-muted)', fontSize: 18 }}>
            &larr;
          </Link>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: 'var(--color-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              <span style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>
                {listingTitle?.[0]?.toUpperCase()}
              </span>
            </div>
            {receiverId && (
              <span
                title={otherOnline ? 'Online' : 'Offline'}
                style={{
                  position: 'absolute',
                  bottom: -1,
                  right: -1,
                  width: 11,
                  height: 11,
                  borderRadius: '50%',
                  background: otherOnline ? 'var(--color-success)' : 'var(--color-muted)',
                  border: '2px solid var(--color-surface)',
                }}
              />
            )}
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: '0 0 2px', fontWeight: 600, fontSize: 14, color: 'var(--color-ink)' }}>
              {listingTitle || 'Listing'}
            </p>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--color-teal)' }}>
              {otherTyping ? 'Typing...' : otherOnline ? 'Online' : 'Chat about this item'}
            </p>
          </div>
        </div>

        {!receiverId ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <p style={{ textAlign: 'center', color: 'var(--color-muted)', fontSize: 13 }}>
              Open this conversation from your <Link to="/messages">Messages</Link> list.
            </p>
          </div>
        ) : (
          <>
            <div
              ref={messagesBoxRef}
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                overflowX: 'hidden',
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                background: 'var(--color-surface)',
                touchAction: 'pan-y',
                overscrollBehavior: 'contain',
              }}
            >
              {messages.length === 0 && (
                <p style={{ textAlign: 'center', color: 'var(--color-muted)', fontSize: 13, margin: 'auto' }}>
                  No messages yet — say hello. 👋
                </p>
              )}
              {messages.map((m) => (
                <ChatBubble
                  key={m._id}
                  message={m}
                  isOwn={m.sender._id === user.id}
                  onDelete={handleDelete}
                  otherUserName={listingTitle}
                />
              ))}
              {otherTyping && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: 'var(--color-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <span style={{ color: '#fff', fontWeight: 700, fontSize: 12 }}>
                      {listingTitle?.[0]?.toUpperCase() || '?'}
                    </span>
                  </div>
                  <div
                    style={{
                      background: 'var(--color-card)',
                      border: '0.5px solid var(--color-border)',
                      borderRadius: 16,
                      borderBottomLeftRadius: 4,
                      padding: '8px 14px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    }}
                  >
                    <span className="typing-dot" style={{ animationDelay: '0s' }} />
                    <span className="typing-dot" style={{ animationDelay: '0.2s' }} />
                    <span className="typing-dot" style={{ animationDelay: '0.4s' }} />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <div style={{ flexShrink: 0 }}>
              <ChatInput onSend={handleSend} onTyping={handleTyping} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}