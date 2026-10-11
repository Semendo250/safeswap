const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('./models/User');

const socketUser = new Map(); // socket.id -> userId (set from the verified login token)
const userSockets = new Map(); // userId -> Set of socket.id
const socketRoom = new Map(); // socket.id -> chat room this socket has joined
const socketViewing = new Set(); // socket.ids whose tab is currently showing their chat room
const userActiveRooms = new Map(); // userId -> Map<room, refcount>

const MAX_CONTENT = 2000;
// Room names look like  <listingId>:<userIdA>-<userIdB>
const ROOM_RE = /^([a-f\d]{24}):([a-f\d]{24})-([a-f\d]{24})$/i;

function parseRoom(room) {
  if (typeof room !== 'string') return null;
  const m = ROOM_RE.exec(room);
  if (!m) return null;
  const a = m[2].toLowerCase();
  const b = m[3].toLowerCase();
  if (a === b) return null;
  return { listingId: m[1].toLowerCase(), a, b };
}

// A user may only use rooms that contain their own ID
function roomAllowsUser(room, userId) {
  const parsed = parseRoom(room);
  return !!parsed && (parsed.a === userId || parsed.b === userId);
}

function otherParticipant(parsed, userId) {
  return parsed.a === userId ? parsed.b : parsed.a;
}

function addActiveRoom(userId, room) {
  if (!userActiveRooms.has(userId)) userActiveRooms.set(userId, new Map());
  const rooms = userActiveRooms.get(userId);
  rooms.set(room, (rooms.get(room) || 0) + 1);
}

function removeActiveRoom(userId, room) {
  const rooms = userActiveRooms.get(userId);
  if (!rooms) return;
  const next = (rooms.get(room) || 0) - 1;
  if (next <= 0) rooms.delete(room);
  else rooms.set(room, next);
  if (rooms.size === 0) userActiveRooms.delete(userId);
}

// Used by chat.controller.js (an HTTP route, not a socket) to decide whether to
// send a push: if the recipient is looking at this exact conversation right now, the
// live socket message already reached them, so a push/bell row is redundant.
function isUserActiveInRoom(userId, room) {
  if (!userId || !room) return false;
  const rooms = userActiveRooms.get(String(userId));
  return !!rooms && rooms.has(room);
}

// Marks this socket as "looking at its chat room" or not (tab hidden, phone locked, left the chat)
function setViewing(socket, viewing) {
  const room = socketRoom.get(socket.id);
  if (!room) return;
  const was = socketViewing.has(socket.id);
  if (viewing && !was) {
    socketViewing.add(socket.id);
    addActiveRoom(socket.userId, room);
  } else if (!viewing && was) {
    socketViewing.delete(socket.id);
    removeActiveRoom(socket.userId, room);
  }
}

// FRONTEND_URL can hold one address or several, separated by commas
function allowedOrigins() {
  const list = String(process.env.FRONTEND_URL || '')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);
  if (list.length === 0) {
    console.warn('FRONTEND_URL is not set: the chat socket accepts connections from any website');
    return '*';
  }
  return list;
}

function initSocket(server) {
  const io = new Server(server, {
    cors: { origin: allowedOrigins() },
  });

  // Every connection must carry a valid login token. The user ID comes from the token,
  // never from anything the browser claims.
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth && socket.handshake.auth.token;
      if (!token) return next(new Error('unauthorized'));
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(payload.id).select('isBanned').lean();
      if (!user || user.isBanned) return next(new Error('unauthorized'));
      socket.userId = String(user._id);
      next();
    } catch (err) {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.userId;
    console.log('Socket connected:', socket.id);

    // Registered automatically from the verified token
    socketUser.set(socket.id, userId);
    if (!userSockets.has(userId)) userSockets.set(userId, new Set());
    const wasOffline = userSockets.get(userId).size === 0;
    userSockets.get(userId).add(socket.id);
    if (wasOffline) io.emit('user_online', { userId });

    // Older frontends still send this. The user ID is already known, so it is ignored.
    socket.on('register', () => {});

    socket.on('check_online', (otherId, callback) => {
      const online = (userSockets.get(String(otherId))?.size || 0) > 0;
      if (typeof callback === 'function') callback(online);
    });

    // Join the room for one (listing, two participants) conversation. Only allowed for
    // rooms that contain this user's own ID.
    socket.on('join_chat', (room) => {
      if (!roomAllowsUser(room, userId)) return;
      const previousRoom = socketRoom.get(socket.id);
      if (previousRoom && previousRoom !== room) {
        setViewing(socket, false);
        socket.leave(previousRoom);
      }
      socket.join(room);
      socketRoom.set(socket.id, room);
      setViewing(socket, true);
    });

    // The page left the chat (navigated away)
    socket.on('leave_chat', (room) => {
      if (socketRoom.get(socket.id) !== room) return;
      setViewing(socket, false);
      socket.leave(room);
      socketRoom.delete(socket.id);
    });

    // The tab was hidden or shown again (phone locked, switched app, came back)
    socket.on('chat_focus', (data) => {
      setViewing(socket, !!(data && data.active));
    });

    socket.on('send_message', (data) => {
      if (!data || !socket.rooms.has(data.room)) return;
      const parsed = parseRoom(data.room);
      if (!parsed || !roomAllowsUser(data.room, userId)) return;

      // Sender, receiver and listing come from the verified user and the room, not from the browser
      const receiverId = otherParticipant(parsed, userId);
      const payload = {
        room: data.room,
        listingId: parsed.listingId,
        senderId: userId,
        receiverId,
        content: typeof data.content === 'string' ? data.content.slice(0, MAX_CONTENT) : '',
        _id: data._id,
        createdAt: data.createdAt,
      };
      io.to(data.room).emit('receive_message', payload);
      const recipientOnline = (userSockets.get(receiverId)?.size || 0) > 0;
      if (recipientOnline) {
        io.to(data.room).emit('message_delivered', { messageId: data._id });
      }
    });

    socket.on('delete_message', (data) => {
      if (!data || !socket.rooms.has(data.room) || !roomAllowsUser(data.room, userId)) return;
      io.to(data.room).emit('message_deleted', {
        room: data.room,
        listingId: data.listingId,
        messageId: data.messageId,
        forEveryone: !!data.forEveryone,
      });
    });

    socket.on('typing', (data) => {
      const room = data && data.room;
      if (room && socket.rooms.has(room) && roomAllowsUser(room, userId)) socket.to(room).emit('typing', { room });
    });
    socket.on('stop_typing', (data) => {
      const room = data && data.room;
      if (room && socket.rooms.has(room) && roomAllowsUser(room, userId)) socket.to(room).emit('stop_typing', { room });
    });

    socket.on('message_seen', (data) => {
      if (!data || !socket.rooms.has(data.room) || !roomAllowsUser(data.room, userId)) return;
      io.to(data.room).emit('message_seen', { messageId: data.messageId });
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected:', socket.id);
      setViewing(socket, false);
      socketRoom.delete(socket.id);
      socketUser.delete(socket.id);

      if (userSockets.has(userId)) {
        userSockets.get(userId).delete(socket.id);
        if (userSockets.get(userId).size === 0) {
          userSockets.delete(userId);
          io.emit('user_offline', { userId });
        }
      }
    });
  });

  return io;
}

module.exports = { initSocket, isUserActiveInRoom };