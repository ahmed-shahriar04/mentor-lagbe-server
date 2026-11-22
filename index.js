import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';

// Route imports
import tuitionsRouter from './routes/tuitions.js';
import applicationsRouter from './routes/applications.js';
import paymentsRouter from './routes/payments.js';
import usersRouter from './routes/users.js';
import bookmarksRouter from './routes/bookmarks.js';
import reviewsRouter from './routes/reviews.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

// Enable CORS
// Permissive CORS for assignment production & preview domains
app.use(cors({
  origin: (origin, callback) => {
    // Allow any origin in production/test to prevent CORS blocks
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Stripe webhook requires raw body; all other routes use express.json()
app.use((req, res, next) => {
  if (req.originalUrl === '/api/payments/webhook') {
    next();
  } else {
    express.json({ limit: '10mb' })(req, res, next);
  }
});
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Ensure database connection middleware for local & serverless (Vercel) environments
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('[Database Middleware Error]:', err.message);
    res.status(500).json({ success: false, message: 'Database connection failed' });
  }
});

// Health Check
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    project: 'MentorLagbe API',
    version: '1.0.0',
    description: 'Smart Tuition & Mentorship Platform Backend',
    timestamp: new Date(),
  });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Mount API routes
app.use('/api/tuitions', tuitionsRouter);
app.use('/api/applications', applicationsRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/users', usersRouter);
app.use('/api/bookmarks', bookmarksRouter);
app.use('/api/reviews', reviewsRouter);

// 404 Route Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `API Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Global Error]:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

// Purge mock seed purchases & mock student applications so every account is 100% fresh
async function resetMockPurchases() {
  try {
    const { paymentsCollection, applicationsCollection, usersCollection } = getCollections();
    if (!paymentsCollection || !applicationsCollection || !usersCollection) return;

    // Remove any mock payments that gave artificial pro status
    await paymentsCollection.deleteMany({
      $or: [
        { transactionId: { $regex: /^txn_mock_/i } },
        { stripeSessionId: { $regex: /mock/i } },
        { userEmail: 'student.sadia@gmail.com' },
      ],
    });

    // Remove mock applications for demo student
    await applicationsCollection.deleteMany({
      studentEmail: 'student.sadia@gmail.com',
    });

    // Reset plans to free for users who don't have a live Stripe paid payment record
    const realPaidRecords = await paymentsCollection.find({ paymentStatus: 'paid' }).toArray();
    const paidEmails = new Set(realPaidRecords.map((p) => p.userEmail));

    await usersCollection.updateMany(
      { email: { $nin: Array.from(paidEmails) } },
      { $set: { plan: 'free' } }
    );

    console.log('[MentorLagbe] All accounts reset to 100% fresh Free tier with 0 artificial purchases.');
  } catch (err) {
    console.warn('[MentorLagbe] Reset notice:', err.message);
  }
}

// Connect to MongoDB and start server
async function startServer() {
  try {
    await connectDB();
    await resetMockPurchases();
    app.listen(PORT, () => {
      console.log(`[MentorLagbe Server] Server running on port ${PORT}`);
      console.log(`[MentorLagbe Server] Health check available at http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    // Still listen for testing even if DB is initially pending
    app.listen(PORT, () => {
      console.log(`[MentorLagbe Server] Started in fallback mode on port ${PORT}`);
    });
  }
}

startServer();

export default app;
