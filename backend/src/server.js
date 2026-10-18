require('dotenv').config();
const http = require('http');
const app = require('./app');
const connectDB = require('./config/db');
const { initSocket } = require('./socket');
const { sweepOffers } = require('./utils/offers');

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);
const io = initSocket(server);
app.set('io', io);

connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`SafeSwap backend running on port ${PORT}`);
  });

  setInterval(() => {
    sweepOffers().catch((err) => console.error('Offer sweep failed:', err.message));
  }, 5 * 60 * 1000);
});