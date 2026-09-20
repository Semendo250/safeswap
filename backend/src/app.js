const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth.routes');
const chatRoutes = require('./routes/chat.routes');
// Phase 2 onward will add:
const listingsRoutes = require('./routes/listings.routes');
const reportsRoutes = require('./routes/reports.routes');
const adminRoutes = require('./routes/admin.routes');
const paymentsRoutes = require('./routes/payments.routes');
// const listingsRoutes = require('./routes/listings.routes');
// const reportsRoutes = require('./routes/reports.routes');
// const adminRoutes = require('./routes/admin.routes');
// const paymentsRoutes = require('./routes/payments.routes');

const app = express();

app.use(cors({
  origin: [
    'https://safeswap-project.vercel.app',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ],
  credentials: true,
}));
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/listings', listingsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payments', paymentsRoutes);
// app.use('/api/listings', listingsRoutes);
// app.use('/api/reports', reportsRoutes);
// app.use('/api/admin', adminRoutes);
// app.use('/api/payments', paymentsRoutes);

// 404 handler
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong' });
});

module.exports = app;
