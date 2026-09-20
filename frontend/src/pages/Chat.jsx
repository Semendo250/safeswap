import { useState, useEffect, useContext, useRef } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import socket from '../socket';
import { getConversation, sendMessage, deleteMessage } from '../api/chat.api';
import { getListingById } from '../api/listings.api';
import ChatBubble from '../components/ChatBubble';
import ChatInput from '../components/ChatInput';

export default function Chat() {
  const { listingId } = useParams();
  const { user, loading: authLoading } = useContext(AuthContext);
  const location = useLocation();
  const [messages, setMessages] = useState([]);
  const [receiverId, setReceiverId] = useState(location.state?.receiverId || null);
  const [listingTitle, setListingTitle] = useState('');
  const bottomRef = useRef(null);
  const messagesBoxRef = useRef(null);
  const outerRef = useRef(null);

  useEffect(() => {
    if (!listingId) return;
    getListingById(listingId).then((res) => setListingTitle(res.data.title));
  }, [listingId]);

  useEffect(() => {
    if (!listingId || authLoading || !user) return;
    getConversation(listingId).then((res) => {
      setMessages(res.data.messages);
      if (res.data.otherUserId) setReceiverId(res.data.otherUserId);
    });
  }, [listingId, user, authLoading]);

  useEffect(() => {
    if (!listingId || !user) return;
    socket.emit('join_chat', listingId);

    function handleIncoming(data) {
      if (data.senderId === user.id) return;
      setMessages((prev) => [
        ...prev,
        { ...data, sender: { _id: data.senderId }, receiver: { _id: data.receiverId } },
      ]);
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

    socket.on('receive_message', handleIncoming);
    socket.on('message_deleted', handleDeleted);
    return () => {
      socket.off('receive_message', handleIncoming);
      socket.off('message_deleted', handleDeleted);
    };
  }, [listingId, user]);

  // Keep the messages scrolled to the latest, scoped to the box itself
  // (never the whole page), so nothing shifts sideways or moves the navbar
  useEffect(() => {
    const box = messagesBoxRef.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [messages]);

  // Pin the chat container to the visual viewport, so the input row stays
  // directly above the on-screen keyboard when it's open, and sits at the
  // true bottom of the screen when it's closed. The navbar height (68px)
  // is subtracted so this container starts right below it and never
  // covers or scrolls the navbar.
  useEffect(() => {
    const outer = outerRef.current;
    if (!outer) return;

    function update() {
      const vv = window.visualViewport;
      if (!vv) return;
      outer.style.top = vv.offsetTop + 68 + 'px';
      outer.style.height = vv.height - 68 + 'px';
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

  async function handleDelete(messageId, forEveryone) {
    try {
      await deleteMessage(messageId, forEveryone);
      if (forEveryone) {
        setMessages((prev) =>
          prev.map((m) =>
            m._id === messageId ? { ...m, content: 'This message was deleted', deletedForEveryone: true } : m
          )
        );
        socket.emit('delete_message', { listingId, messageId, forEveryone: true });
      } else {
        setMessages((prev) => prev.filter((m) => m._id !== messageId));
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete message');
    }
  }

  async function handleSend(content) {
    if (!receiverId) {
      alert('Cannot determine who to message — please open this chat from the listing page.');
      return;
    }
    const res = await sendMessage(listingId, receiverId, content);
    const saved = res.data;
    setMessages((prev) => [
      ...prev,
      { ...saved, sender: { _id: user.id, fullName: user.fullName }, receiver: { _id: receiverId } },
    ]);
    socket.emit('send_message', {
      listingId,
      senderId: user.id,
      receiverId,
      content: saved.content,
      _id: saved._id,
      createdAt: saved.createdAt,
    });
  }

  if (authLoading) return null;
  if (!user) return <p style={{ padding: '1rem' }}>Please log in to view this conversation.</p>;

  return (
    <div
      ref={outerRef}
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: '#fff',
      }}
    >
      {/* This inner header is part of the fixed chat panel (stays visible
          with the chat), distinct from your app Navbar above, which never
          moves regardless of keyboard state */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          background: '#fafafa',
          flexShrink: 0,
        }}
      >
        <Link to={`/listings/${listingId}`} style={{ color: 'var(--color-muted)', fontSize: '18px' }}>&larr;</Link>
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: 'var(--color-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <span style={{ color: '#fff', fontWeight: 700, fontSize: '14px' }}>{listingTitle?.[0]?.toUpperCase()}</span>
        </div>
        <div>
          <p style={{ margin: 0, fontWeight: 600, fontSize: '14px' }}>{listingTitle || 'Listing'}</p>
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-muted)' }}>Chat about this item</p>
        </div>
      </div>

      <div
        ref={messagesBoxRef}
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '16px',
          background: 'var(--color-surface)',
        }}
      >
        {messages.length === 0 && (
          <p style={{ textAlign: 'center', color: 'var(--color-muted)', fontSize: '13px', marginTop: '30px' }}>
            No messages yet — say hello.
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
        <div ref={bottomRef} />
      </div>

      <div style={{ flexShrink: 0 }}>
        <ChatInput onSend={handleSend} />
      </div>
    </div>
  );
}