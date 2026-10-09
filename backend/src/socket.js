const { Server } = require('socket.io');

// Tracks which sockets belong to which logged-in user, for online/offline status.
// A user can have more than one tab/device open, so each maps to a Set of socket ids.
const socketUser = new Map(); // socket.id -> userId
const userSockets = new Map(); // userId -> Set of socket.id

function initSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: '*', // tighten this to your frontend URL before real deployment
    },
  });

  io.on('connection', (socket) => {
    console.log('Socket connected:', socket.id);

    // Identifies this socket as belonging to a logged-in user (called once on app
    // load and again on every reconnect, e.g. after the free-tier server sleeps/wakes)
    socket.on('register', (userId) => {
      if (!userId) return;
      socketUser.set(socket.id, userId);
      if (!userSockets.has(userId)) userSockets.set(userId, new Set());
      const wasOffline = userSockets.get(userId).size === 0;
      userSockets.get(userId).add(socket.id);
      if (wasOffline) io.emit('user_online', { userId });
    });

    // Lets a client ask "is this user online right now" when a chat first opens
    socket.on('check_online', (userId, callback) => {
      const online = (userSockets.get(userId)?.size || 0) > 0;
      if (typeof callback === 'function') callback(online);
    });

    // Client joins a room scoped to a specific (listing, pair of participants)
    // conversation — this is the compound room string computed on the frontend,
    // not just the raw listingId, so different buyers on the same listing don't
    // share a room.
    socket.on('join_chat', (room) => {
      socket.join(room);
    });

    socket.on('send_message', (data) => {
      // data: { room, listingId, senderId, receiverId, content, _id, createdAt }
      io.to(data.room).emit('receive_message', data);

      // If the recipient's app is connected anywhere right now, the message has
      // reached their device — tell the sender so the tick can update
      const recipientOnline = (userSockets.get(data.receiverId)?.size || 0) > 0;
      if (recipientOnline) {
        io.to(data.room).emit('message_delivered', { messageId: data._id });
      }
    });

    socket.on('delete_message', (data) => {
      // data: { room, listingId, messageId, forEveryone }
      io.to(data.room).emit('message_deleted', data);
    });

    // Typing indicator, scoped to the conversation room
    socket.on('typing', ({ room }) => {
      if (room) socket.to(room).emit('typing', { room });
    });
    socket.on('stop_typing', ({ room }) => {
      if (room) socket.to(room).emit('stop_typing', { room });
    });

    // The recipient has the conversation open and has seen this message
    socket.on('message_seen', ({ room, messageId }) => {
      if (room) io.to(room).emit('message_seen', { messageId });
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected:', socket.id);
      const userId = socketUser.get(socket.id);
      socketUser.delete(socket.id);
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

module.exports = initSocket;