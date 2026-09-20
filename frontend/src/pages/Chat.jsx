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

  useEffect(() => {
    if (!listingId) return;
    getListingById(listingId).then((res) => setListingTitle(res.data.title));
  }, [listingId]);

  useEffect(() => {
    if (!listingId || authLoading || !user) return;
    getConversation(listingId).then((res) => {
      setMessages(res.data.messages);
      if (res.data.otherUserId) {
        setReceiverId(res.data.otherUserId);
      }
    });
  }, [listingId, user, authLoading]);

  useEffect(() => {
    if (!listingId || !user) return;
    socket.emit('join_chat', listingId);

    function handleIncoming(data) {
      if (data.senderId === user.id) return;
      const normalized = {
        ...data,
        sender: { _id: data.senderId },
        receiver: { _id: data.receiverId },
      };
      setMessages((prev) => [...prev, normalized]);
    }

    function handleDeleted(data) {
      if (data.forEveryone) {
        setMessages((prev) =>
          prev.map((m) =>
            m._id === data.messageId
              ? { ...m, content: 'This message was deleted', deletedForEveryone: true }
              : m
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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
    const normalized = {
      ...saved,
      sender: { _id: user.id, fullName: user.fullName },
      receiver: { _id: receiverId },
    };

    socket.emit('send_message', {
      listingId,
      senderId: user.id,
      receiverId,
      content: saved.content,
      _id: saved._id,
      createdAt: saved.createdAt,
    });

    setMessages((prev) => [...prev, normalized]);
  }

  if (authLoading) return null;
  if (!user) return <p style={{ padding: '1rem' }}>Please log in to view this conversation.</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 68px)' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Link to={`/listings/${listingId}`} style={{ color: 'var(--color-muted)', fontSize: '18px' }}>&larr;</Link>
        <div>
          <p style={{ margin: 0, fontWeight: 600, fontSize: '14px' }}>{listingTitle || 'Listing'}</p>
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-muted)' }}>Chat about this item</p>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', background: 'var(--color-surface)' }}>
        {messages.length === 0 && (
          <p style={{ textAlign: 'center', color: 'var(--color-muted)', fontSize: '13px', marginTop: '30px' }}>
            No messages yet — say hello.
          </p>
        )}
        {messages.map((m) => (
          <ChatBubble key={m._id} message={m} isOwn={m.sender._id === user.id} onDelete={handleDelete} />
        ))}
        <div ref={bottomRef} />
      </div>

      <ChatInput onSend={handleSend} />
    </div>
  );
}