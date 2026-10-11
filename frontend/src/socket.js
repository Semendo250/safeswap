import { io } from 'socket.io-client';

const socket = io(import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000', {
  autoConnect: false, // we'll connect manually once the user is logged in
  // Read fresh on every (re)connect, so the server can verify who is connecting
  auth: (cb) => cb({ token: localStorage.getItem('token') }),
});

export default socket;