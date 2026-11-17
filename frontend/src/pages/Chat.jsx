import { Fragment, useState, useEffect, useContext, useRef } from 'react';
import { useParams, useLocation, useSearchParams, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import socket from '../socket';
import { getConversation, sendMessage, deleteMessage, markAsRead } from '../api/chat.api';
import { getListingById } from '../api/listings.api';
import ChatBubble from '../components/ChatBubble';
import ChatInput from '../components/ChatInput';
import OfferCard from '../components/OfferCard';
import OfferSheet from '../components/OfferSheet';
import Avatar from '../components/Avatar';
import { createOffer, acceptOffer, declineOffer, counterOffer } from '../api/offers.api';
import { blockUser, unblockUser, getBlockStatus } from '../api/blocks.api';

// Height of the navbar, so the full-screen (phone) chat starts right below it
const NAVBAR_HEIGHT = 60;
const DAY_MS = 24 * 60 * 60 * 1000;
const STATUS_LABEL = { sold: 'Sold', unavailable: 'Unavailable', expired: 'Expired' };

// Same room name the server relays to: must match on both ends
function roomFor(listingId, userId, otherUserId) {
  if (!listingId || !userId || !otherUserId) return null;
  return [listingId, [userId, otherUserId].sort().join('-')].join(':');
}

function dayKey(value) {
  const d = new Date(value);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(value) {
  const d = new Date(value);
  const days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / DAY_MS);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return d.toLocaleDateString([], { weekday: 'long' });
  return d.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' });
}

const CHAT_CSS = `
  .wa-chat { display: flex; flex-direction: column; background: var(--color-card); overflow: hidden; box-sizing: border-box; }

  /* header */
  .wa-header {
    position: relative; display: flex; align-items: center; gap: 12px; flex-shrink: 0;
    padding: 10px 14px; background: var(--color-card); border-bottom: 1px solid var(--color-border);
  }
  a.wa-back {
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    width: 34px; height: 34px; margin-left: -6px; border-radius: 50%;
    color: var(--color-ink); font-size: 20px; line-height: 1;
  }
  a.wa-back:hover { background: var(--color-surface); text-decoration: none; }
  .wa-dot {
    position: absolute; right: -1px; bottom: -1px; width: 12px; height: 12px;
    border-radius: 50%; border: 2px solid var(--color-card);
  }
  .wa-who { min-width: 0; flex: 1; }
  .wa-name {
    display: block; font-size: 15px; font-weight: 600; color: var(--color-ink);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .wa-status {
    display: block; font-size: 12px; color: var(--color-muted);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .wa-status.live { color: var(--color-teal); font-weight: 600; }
  button.wa-icon-btn {
    display: flex; align-items: center; justify-content: center; flex-shrink: 0; align-self: auto;
    min-width: 0; width: 36px; height: 36px; padding: 0; border: none; border-radius: 50%;
    background: transparent; color: var(--color-muted);
  }
  button.wa-icon-btn:hover { background: var(--color-surface); color: var(--color-ink); }
  .wa-menu {
    position: absolute; top: calc(100% - 6px); right: 10px; z-index: 30; min-width: 200px; padding: 6px;
    border: 1px solid var(--color-border); border-radius: 12px; background: var(--color-card);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.18);
  }
  .wa-menu a, button.wa-menu-item {
    display: flex; align-items: center; width: 100%; min-width: 0; align-self: auto;
    padding: 10px 12px; border: none; border-radius: 8px; background: transparent;
    color: var(--color-ink); font-size: 14px; font-weight: 500; text-align: left; text-decoration: none;
  }
  .wa-menu a:hover, button.wa-menu-item:hover { background: var(--color-surface); color: var(--color-ink); text-decoration: none; }
  button.wa-menu-item.danger, button.wa-menu-item.danger:hover { color: var(--color-warning); }

  /* item strip */
  .wa-item {
    display: flex; align-items: center; gap: 10px; flex-shrink: 0;
    padding: 8px 14px; background: var(--color-card); border-bottom: 1px solid var(--color-border);
  }
  .wa-item img, .wa-item-ph {
    width: 38px; height: 38px; flex-shrink: 0; border-radius: 8px; object-fit: cover;
    background: var(--color-surface); border: 1px solid var(--color-border); display: block;
  }
  .wa-item-main { min-width: 0; flex: 1; }
  a.wa-item-title {
    display: block; font-size: 13px; font-weight: 600; color: var(--color-ink);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  a.wa-item-title:hover { color: var(--color-teal); text-decoration: none; }
  .wa-item-price { font-size: 12.5px; font-weight: 700; color: var(--color-primary); }
  button.wa-offer-btn {
    flex-shrink: 0; align-self: auto; min-width: 0; padding: 7px 14px; border-radius: 999px;
    background: transparent; border: 1px solid var(--color-teal); color: var(--color-teal);
    font-size: 13px; font-weight: 600; white-space: nowrap;
  }
  button.wa-offer-btn:hover { background: var(--color-teal); border-color: var(--color-teal); color: #fff; }
  [data-theme="dark"] button.wa-offer-btn:hover { color: #0e1518; }

  /* messages */
  .wa-messages {
    flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; display: flex; flex-direction: column;
    padding: 12px 12px 8px; touch-action: pan-y; overscroll-behavior: contain;
    background-color: var(--color-surface);
    background-image:
      radial-gradient(circle at 20% 30%, color-mix(in srgb, var(--color-teal) 9%, transparent) 0 2px, transparent 3px),
      radial-gradient(circle at 72% 68%, color-mix(in srgb, var(--color-teal) 7%, transparent) 0 2px, transparent 3px);
    background-size: 46px 46px, 62px 62px;
  }
  @media (min-width: 900px) { .wa-messages { padding: 16px 7% 10px; } }
  .wa-secure {
    align-self: center; max-width: 440px; margin: 4px 0 10px; padding: 8px 12px; border-radius: 10px;
    text-align: center; font-size: 12px; line-height: 1.5; color: var(--color-ink); background: var(--color-gold-bg);
  }
  .wa-hello { align-self: center; margin: 14px 0; font-size: 13px; color: var(--color-muted); }
  .wa-day { align-self: center; margin: 10px 0 8px; flex-shrink: 0; }
  .wa-day span {
    display: inline-block; padding: 4px 12px; border-radius: 8px; font-size: 12px; font-weight: 600;
    color: var(--color-muted); background: var(--color-card); box-shadow: 0 1px 1px rgba(0, 0, 0, 0.1);
  }

  .wa-row { display: flex; width: 100%; flex-shrink: 0; margin-top: 2px; }
  .wa-row.tail { margin-top: 8px; }
  .wa-row.own { justify-content: flex-end; }
  .wa-row.them { justify-content: flex-start; }
  .wa-bubble {
    position: relative; max-width: 78%; padding: 6px 9px 7px; border-radius: 10px;
    font-size: 14.5px; line-height: 1.45; word-break: break-word; overflow-wrap: anywhere;
    box-shadow: 0 1px 1px rgba(0, 0, 0, 0.13); cursor: default;
    -webkit-user-select: none; user-select: none;
  }
  @media (max-width: 640px) { .wa-bubble { max-width: 86%; } }
  .wa-bubble::after { content: ''; display: table; clear: both; }
  .wa-row.own .wa-bubble { background: var(--color-primary); color: #fff; }
  .wa-row.them .wa-bubble { background: var(--color-card); color: var(--color-ink); }
  .wa-text { white-space: pre-wrap; }
  .wa-meta {
    float: right; display: inline-flex; align-items: center; gap: 3px; margin: 7px 0 -4px 12px;
    font-size: 11px; line-height: 1; white-space: nowrap; opacity: 0.85;
  }
  .wa-row.them .wa-meta { color: var(--color-muted); opacity: 1; }

  .wa-row.tail .wa-bubble::before { content: ''; position: absolute; top: 0; width: 9px; height: 13px; }
  .wa-row.own.tail .wa-bubble { border-top-right-radius: 0; }
  .wa-row.own.tail .wa-bubble::before { right: -8px; background: var(--color-primary); clip-path: polygon(0 0, 100% 0, 0 100%); }
  .wa-row.them.tail .wa-bubble { border-top-left-radius: 0; }
  .wa-row.them.tail .wa-bubble::before { left: -8px; background: var(--color-card); clip-path: polygon(100% 0, 0 0, 100% 100%); }

  .wa-row .wa-bubble.deleted { background: var(--color-card); color: var(--color-muted); font-style: italic; }
  .wa-row.own.tail .wa-bubble.deleted::before { background: var(--color-card); }
  .wa-row .wa-bubble.deleted .wa-meta { color: var(--color-muted); }

  .wa-typing { display: inline-flex; align-items: center; padding: 11px 14px; }
  @keyframes typingBounce {
    0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
    30% { transform: translateY(-4px); opacity: 1; }
  }
  .typing-dot {
    display: inline-block; width: 6px; height: 6px; border-radius: 50%;
    background: var(--color-muted); margin: 0 2px; animation: typingBounce 1.2s infinite;
  }

  .wa-blocked {
    margin: 0; padding: 14px; font-size: 13px; text-align: center;
    color: var(--color-muted); background: var(--color-card); border-top: 1px solid var(--color-border);
  }
  @media (max-width: 640px) { .msg-input-row { gap: 6px !important; padding: 8px !important; } }
`;

// listingId / receiverId can be passed in (the two-pane Messages page does that);
// otherwise they come from the address, as before. `embedded` means it sits inside
// another page's pane instead of covering the whole screen.
export default function Chat({
  listingId: listingIdProp,
  receiverId: receiverIdProp,
  otherName: otherNameProp,
  otherPhoto: otherPhotoProp,
  embedded = false,
  onActivity,
}) {
  const routeParams = useParams();
  const listingId = listingIdProp || routeParams.listingId;
  const { user, loading: authLoading } = useContext(AuthContext);
  const location = useLocation();
  const [messages, setMessages] = useState([]);
  const [searchParams] = useSearchParams();
  const withParam = searchParams.get('with') || '';
  const [receiverId, setReceiverId] = useState(
    receiverIdProp || location.state?.receiverId || (/^[a-f\d]{24}$/i.test(withParam) ? withParam : null)
  );
  const [listingPrice, setListingPrice] = useState(0);
  const [listingStatus, setListingStatus] = useState('');
  const [sheet, setSheet] = useState(null);
  const [blockedByMe, setBlockedByMe] = useState(false);
  const [listingTitle, setListingTitle] = useState('');
  const [listingSellerId, setListingSellerId] = useState(null);
  const [listingCategory, setListingCategory] = useState('');
  const [listingPhoto, setListingPhoto] = useState('');
  const [seller, setSeller] = useState(null);
  const [otherTyping, setOtherTyping] = useState(false);
  const [otherOnline, setOtherOnline] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const bottomRef = useRef(null);
  const messagesBoxRef = useRef(null);
  const outerRef = useRef(null);
  const menuRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Lets the Messages list know something changed (a message sent, received or read)
  const activityRef = useRef(onActivity);
  activityRef.current = onActivity;
  function pingActivity() {
    if (activityRef.current) activityRef.current();
  }

  useEffect(() => {
    if (!listingId) return undefined;
    let cancelled = false;
    getListingById(listingId)
      .then((res) => {
        if (cancelled) return;
        const d = res.data;
        setListingTitle(d.title);
        setListingSellerId(d.seller?._id || null);
        setSeller(d.seller || null);
        setListingPrice(d.price || 0);
        setListingStatus(d.status || '');
        setListingCategory(d.category || '');
        setListingPhoto(d.photos?.[0] || '');
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
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
    getConversation(listingId, receiverId)
      .then((res) => {
        setMessages(res.data.messages);
        // Anything already here that I haven't read yet: mark it read now that I'm viewing it
        const unread = res.data.messages.filter(
          (m) => m.sender._id !== user.id && !m.read && !m.deletedForEveryone
        );
        unread.forEach((m) => {
          markAsRead(m._id).catch(() => {});
          if (room) socket.emit('message_seen', { room, messageId: m._id });
        });
        if (unread.length) pingActivity();
      })
      .catch(() => {});
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

    // Join the room and tell the server whether this tab is actually being looked at.
    // Runs again after every reconnect, because the server forgets rooms when a socket drops.
    function joinRoom() {
      socket.emit('join_chat', room);
      socket.emit('chat_focus', { active: document.visibilityState === 'visible' });
    }
    // Tab hidden (phone locked, switched app) or shown again: the server uses this to
    // decide whether a new message still needs a push
    function handleVisibility() {
      socket.emit('chat_focus', { active: document.visibilityState === 'visible' });
    }

    joinRoom();
    socket.on('connect', joinRoom);
    document.addEventListener('visibilitychange', handleVisibility);

    function handleIncoming(data) {
      if (data.senderId === user.id) return;
      setMessages((prev) => {
        if (prev.some((m) => m._id === data._id)) return prev;
        return [...prev, { ...data, sender: { _id: data.senderId }, receiver: { _id: data.receiverId } }];
      });
      // The chat is open right now, so this message counts as seen immediately
      markAsRead(data._id).catch(() => {});
      socket.emit('message_seen', { room, messageId: data._id });
      pingActivity();
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
    function handleOfferMessage({ room: r, message }) {
      if (r !== room || !message) return;
      setMessages((prev) => (prev.some((m) => m._id === message._id) ? prev : [...prev, message]));
      if (message.sender?._id !== user.id) {
        markAsRead(message._id).catch(() => {});
        socket.emit('message_seen', { room, messageId: message._id });
      }
      pingActivity();
    }
    function handleOfferUpdated({ room: r, offer }) {
      if (r !== room || !offer) return;
      setMessages((prev) => prev.map((m) => (m.offer && m.offer._id === offer._id ? { ...m, offer } : m)));
    }

    socket.on('receive_message', handleIncoming);
    socket.on('message_deleted', handleDeleted);
    socket.on('message_delivered', handleDelivered);
    socket.on('message_seen', handleSeen);
    socket.on('typing', handleTypingEvt);
    socket.on('stop_typing', handleStopTypingEvt);
    socket.on('user_online', handleUserOnline);
    socket.on('user_offline', handleUserOffline);
    socket.on('offer_message', handleOfferMessage);
    socket.on('offer_updated', handleOfferUpdated);
    return () => {
      socket.off('connect', joinRoom);
      document.removeEventListener('visibilitychange', handleVisibility);
      // Tell the server we left, so new messages here get a push again
      if (socket.connected) socket.emit('leave_chat', room);
      socket.off('receive_message', handleIncoming);
      socket.off('message_deleted', handleDeleted);
      socket.off('message_delivered', handleDelivered);
      socket.off('message_seen', handleSeen);
      socket.off('typing', handleTypingEvt);
      socket.off('stop_typing', handleStopTypingEvt);
      socket.off('user_online', handleUserOnline);
      socket.off('user_offline', handleUserOffline);
      socket.off('offer_message', handleOfferMessage);
      socket.off('offer_updated', handleOfferUpdated);
    };
  }, [listingId, user, receiverId]);

  // Keep the messages scrolled to the latest, scoped to the box itself
  // (never the whole page), so nothing shifts sideways or moves the navbar
  useEffect(() => {
    const box = messagesBoxRef.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [messages, otherTyping]);

  // Full-screen (phone) mode only: pin the chat to the visual viewport, so the input
  // row stays directly above the on-screen keyboard when it's open
  useEffect(() => {
    if (embedded) return undefined;
    const outer = outerRef.current;
    if (!outer) return undefined;

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
  }, [embedded]);

  // Close the header menu when tapping anywhere else
  useEffect(() => {
    if (!menuOpen) return undefined;
    function onDown(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [menuOpen]);

  useEffect(() => {
    if (!user || !receiverId) return undefined;
    let cancelled = false;
    getBlockStatus(receiverId)
      .then((res) => {
        if (!cancelled) setBlockedByMe(!!res.data.blockedByMe);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user, receiverId]);

  async function toggleBlock() {
    if (
      !blockedByMe &&
      !window.confirm(
        'Block this person? Neither of you can message or send offers to the other until you unblock them.'
      )
    ) {
      return;
    }
    try {
      if (blockedByMe) await unblockUser(receiverId);
      else await blockUser(receiverId);
      setBlockedByMe(!blockedByMe);
    } catch (err) {
      alert(offerError(err));
    }
  }

  function mergeOffer(offer) {
    setMessages((prev) => prev.map((m) => (m.offer && m.offer._id === offer._id ? { ...m, offer } : m)));
  }

  function applyOfferResult(data) {
    (data.replaced || []).forEach(mergeOffer);
    if (data.message) {
      setMessages((prev) => (prev.some((m) => m._id === data.message._id) ? prev : [...prev, data.message]));
    } else if (data.offer) {
      mergeOffer(data.offer);
    }
    pingActivity();
  }

  function offerError(err) {
    return !err.response ? 'Network error. Check your connection.' : err.response?.data?.error || 'Something went wrong';
  }

  async function submitOffer(amount) {
    try {
      const res =
        sheet?.mode === 'counter'
          ? await counterOffer(sheet.offer._id, amount)
          : await createOffer(listingId, receiverId, amount);
      applyOfferResult(res.data);
      setSheet(null);
      return null;
    } catch (err) {
      return offerError(err);
    }
  }

  async function respondToOffer(fn, offerId) {
    try {
      const res = await fn(offerId);
      applyOfferResult(res.data);
    } catch (err) {
      alert(offerError(err));
    }
  }

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
      pingActivity();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete message');
    }
  }

  // Returns false on failure so ChatInput keeps the typed text.
  async function handleSend(content) {
    if (!receiverId) {
      alert('Cannot determine who to message. Please open this chat from the listing page.');
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
      pingActivity();
      return true;
    } catch (err) {
      alert(
        !err.response
          ? 'Network error. Check your connection.'
          : err.response?.data?.error || 'Failed to send.'
      );
      return false;
    }
  }

  if (authLoading) return null;
  if (!user) return <p style={{ padding: '1rem' }}>Please log in to view this conversation.</p>;
  const isSeller = listingSellerId === user.id;

  // Who the other person is: told by the Messages list, or the seller, or found in the messages
  let otherName = otherNameProp || '';
  let otherPhoto = otherPhotoProp || '';
  if (receiverId && seller && String(seller._id) === String(receiverId)) {
    otherName = otherName || seller.fullName || '';
    otherPhoto = otherPhoto || seller.profilePicture || '';
  }
  if (!otherName && receiverId) {
    for (const m of messages) {
      if (m.sender && String(m.sender._id) === String(receiverId) && m.sender.fullName) {
        otherName = m.sender.fullName;
        break;
      }
      if (m.receiver && String(m.receiver._id) === String(receiverId) && m.receiver.fullName) {
        otherName = m.receiver.fullName;
        break;
      }
    }
  }

  const statusLive = otherTyping || otherOnline;
  const statusText = otherTyping ? 'typing…' : otherOnline ? 'online' : listingTitle ? `About: ${listingTitle}` : '';

  const wrapperStyle = embedded
    ? { position: 'relative', height: '100%', minHeight: 0 }
    : {
        position: 'fixed',
        // initial values; the visualViewport effect overrides top/height
        top: NAVBAR_HEIGHT,
        left: 0,
        right: 0,
        bottom: 0,
        touchAction: 'none',
      };

  return (
    <div ref={outerRef} className="wa-chat" style={wrapperStyle}>
      <style>{CHAT_CSS}</style>

      <div className="wa-header" ref={menuRef}>
        {!embedded && (
          <Link to="/messages" className="wa-back" aria-label="Back to messages">
            &larr;
          </Link>
        )}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <Avatar src={otherPhoto} name={otherName || listingTitle} size={42} />
          {receiverId && (
            <span
              className="wa-dot"
              title={otherOnline ? 'Online' : 'Offline'}
              style={{ background: otherOnline ? 'var(--color-success)' : 'var(--color-muted)' }}
            />
          )}
        </div>
        <div className="wa-who">
          <span className="wa-name">{otherName || 'Chat'}</span>
          <span className={statusLive ? 'wa-status live' : 'wa-status'}>{statusText}</span>
        </div>
        {receiverId && (
          <button
            type="button"
            className="wa-icon-btn"
            aria-label="More options"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <circle cx="12" cy="5" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="12" cy="19" r="2" />
            </svg>
          </button>
        )}
        {menuOpen && (
          <div className="wa-menu">
            <Link to={`/listings/${listingId}`} onClick={() => setMenuOpen(false)}>
              View item
            </Link>
            <Link to={`/report/${listingId}`} onClick={() => setMenuOpen(false)}>
              Report listing
            </Link>
            <button
              type="button"
              className="wa-menu-item danger"
              onClick={() => {
                setMenuOpen(false);
                toggleBlock();
              }}
            >
              {blockedByMe ? 'Unblock user' : 'Block user'}
            </button>
          </div>
        )}
      </div>

      {listingTitle && (
        <div className="wa-item">
          {listingPhoto ? <img src={listingPhoto} alt="" /> : <span className="wa-item-ph" />}
          <div className="wa-item-main">
            <Link to={`/listings/${listingId}`} className="wa-item-title">
              {listingTitle}
            </Link>
            <span className="wa-item-price">KES {Number(listingPrice).toLocaleString()}</span>
          </div>
          {receiverId && listingStatus === 'active' && !blockedByMe && (
            <button type="button" className="wa-offer-btn" onClick={() => setSheet({ mode: 'new' })}>
              Make an offer
            </button>
          )}
          {listingStatus && listingStatus !== 'active' && (
            <span className="badge badge-muted">{STATUS_LABEL[listingStatus] || 'Not available'}</span>
          )}
        </div>
      )}

      {!receiverId ? (
        <div
          className="wa-messages"
          style={{ alignItems: 'center', justifyContent: 'center' }}
        >
          <p style={{ textAlign: 'center', color: 'var(--color-muted)', fontSize: 13 }}>
            Open this conversation from your <Link to="/messages">Messages</Link> list.
          </p>
        </div>
      ) : (
        <>
          <div ref={messagesBoxRef} className="wa-messages">
            <div className="wa-secure">
              Pay through SafeSwap and meet at a safe zone. Your money is held until you confirm the handover.
            </div>

            {messages.length === 0 && <p className="wa-hello">No messages yet. Say hello 👋</p>}

            {messages.map((m, i) => {
              const prev = messages[i - 1];
              const showDay = !prev || dayKey(prev.createdAt) !== dayKey(m.createdAt);
              const isOffer = m.type === 'offer' && m.offer;
              const tail =
                showDay || !prev || prev.type === 'offer' || String(prev.sender?._id) !== String(m.sender?._id);

              return (
                <Fragment key={m._id}>
                  {showDay && (
                    <div className="wa-day">
                      <span>{dayLabel(m.createdAt)}</span>
                    </div>
                  )}
                  {isOffer ? (
                    <div style={{ margin: '6px 0' }}>
                      <OfferCard
                        message={m}
                        userId={user.id}
                        onAccept={(id) => respondToOffer(acceptOffer, id)}
                        onDecline={(id) => respondToOffer(declineOffer, id)}
                        onCounter={(offer) => setSheet({ mode: 'counter', offer })}
                        isSeller={isSeller}
                        category={listingCategory}
                      />
                    </div>
                  ) : (
                    <ChatBubble
                      message={m}
                      isOwn={m.sender._id === user.id}
                      onDelete={handleDelete}
                      tail={tail}
                    />
                  )}
                </Fragment>
              );
            })}

            {otherTyping && (
              <div className="wa-row them tail">
                <div className="wa-bubble wa-typing">
                  <span className="typing-dot" style={{ animationDelay: '0s' }} />
                  <span className="typing-dot" style={{ animationDelay: '0.2s' }} />
                  <span className="typing-dot" style={{ animationDelay: '0.4s' }} />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div style={{ flexShrink: 0 }}>
            {blockedByMe ? (
              <p className="wa-blocked">You blocked this person. Unblock them to send messages or offers.</p>
            ) : (
              <ChatInput onSend={handleSend} onTyping={handleTyping} />
            )}
            {sheet && (
              <OfferSheet
                title={sheet.mode === 'counter' ? 'Counter offer' : 'Make an offer'}
                askingPrice={listingPrice}
                initial={sheet.mode === 'counter' ? sheet.offer.amount : null}
                onSubmit={submitOffer}
                onClose={() => setSheet(null)}
                showFee={isSeller}
                category={listingCategory}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}