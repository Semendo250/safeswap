const { Server } = require('socket.io');

function initSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: '*', // tighten this to your frontend URL before real deployment
    },
  });

  io.on('connection', (socket) => {
    console.log('Socket connected:', socket.id);

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
    });

    socket.on('delete_message', (data) => {
      // data: { room, listingId, messageId, forEveryone }
      io.to(data.room).emit('message_deleted', data);
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected:', socket.id);
    });
  });

  return io;
}

module.exports = initSocket;