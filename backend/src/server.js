require('dotenv').config();
const http = require('http');
const app = require('./app');
const connectDB = require('./config/db');
const initSocket = require('./socket');

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);
initSocket(server);


connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`SafeSwap backend running on port ${PORT}`);
  });
});