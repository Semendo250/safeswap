const { Server } = require('socket.io');

const socketUser = new Map(); // socket.id -> userId
const userSockets = new Map(); // userId -> Set of socket.id
const socketRoom = new Map(); // socket.id -> last-joined chat room
const userActiveRooms = new Map(); // userId -> Map<room, refcount>

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
// send a push: if the recipient already has this exact conversation open, the
// live socket message already reached them, so a push/bell row is redundant.
function isUserActiveInRoom(userId, room) {
  if (!userId || !room) return false;
  const rooms = userActiveRooms.get(String(userId));
  return !!rooms && rooms.has(room);
}

function initSocket(server) {
  const io = new Server(server, {
    cors: { origin: '*' }, // tighten this to your frontend URL before real deployment
  });

  io.on('connection', (socket) => {
    console.log('Socket connected:', socket.id);

    socket.on('register', (userId) => {
      if (!userId) return;
      userId = String(userId);
      socketUser.set(socket.id, userId);
      if (!userSockets.has(userId)) userSockets.set(userId, new Set());
      const wasOffline = userSockets.get(userId).size === 0;
      userSockets.get(userId).add(socket.id);
      if (wasOffline) io.emit('user_online', { userId });
    });

    socket.on('check_online', (userId, callback) => {
      const online = (userSockets.get(String(userId))?.size || 0) > 0;
      if (typeof callback === 'function') callback(online);
    });

    // Client joins a room scoped to a specific (listing, pair of participants)
    // conversation. Also tracks which room each user currently has open, so
    // the HTTP side can skip sending a push for a chat someone is already in.
    socket.on('join_chat', (room) => {
      if (!room) return;
      const userId = socketUser.get(socket.id);
      const previousRoom = socketRoom.get(socket.id);
      if (previousRoom && previousRoom !== room) {
        socket.leave(previousRoom);
        if (userId) removeActiveRoom(userId, previousRoom);
      }
      socket.join(room);
      socketRoom.set(socket.id, room);
      if (userId) addActiveRoom(userId, room);
    });

    socket.on('send_message', (data) => {
      io.to(data.room).emit('receive_message', data);
      const recipientOnline = (userSockets.get(String(data.receiverId))?.size || 0) > 0;
      if (recipientOnline) {
        io.to(data.room).emit('message_delivered', { messageId: data._id });
      }
    });

    socket.on('delete_message', (data) => {
      io.to(data.room).emit('message_deleted', data);
    });

    socket.on('typing', ({ room }) => {
      if (room) socket.to(room).emit('typing', { room });
    });
    socket.on('stop_typing', ({ room }) => {
      if (room) socket.to(room).emit('stop_typing', { room });
    });

    socket.on('message_seen', ({ room, messageId }) => {
      if (room) io.to(room).emit('message_seen', { messageId });
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected:', socket.id);
      const userId = socketUser.get(socket.id);
      socketUser.delete(socket.id);

      const room = socketRoom.get(socket.id);
      socketRoom.delete(socket.id);
      if (userId && room) removeActiveRoom(userId, room);

      if (userId && userSockets.has(userId)) {
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