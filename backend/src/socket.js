const { Server } = require('socket.io');

function initSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: '*', // tighten this to your frontend URL before real deployment
    },
  });

  io.on('connection', (socket) => {
    socket.on('delete_message', (data) => {
  // data: { listingId, messageId, forEveryone }
  io.to(data.listingId).emit('message_deleted', data);
});
    console.log('Socket connected:', socket.id);

    // Client joins a room scoped to a specific listing's conversation
    socket.on('join_chat', (listingId) => {
      socket.join(listingId);
    });

    socket.on('send_message', (data) => {
      // data: { listingId, senderId, receiverId, content }
      io.to(data.listingId).emit('receive_message', data);
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected:', socket.id);
    });
  });

  return io;
}

module.exports = initSocket;