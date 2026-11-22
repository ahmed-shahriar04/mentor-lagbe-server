import express from 'express';
import Stripe from 'stripe';
import { getCollections } from '../config/db.js';
import { verifyToken, verifyAdmin } from '../middlewares/auth.js';
import dotenv from 'dotenv';
dotenv.config();

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || 'sk_test_mock_key';
const stripe = new Stripe(stripeSecretKey);
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

const router = express.Router();

/**
 * Create Stripe Checkout Session
 * POST /api/payments/create-checkout-session
 * Pricing: Pro Tutor Plan = $15, Pro Student Plan = $10
 */
router.post('/create-checkout-session', verifyToken, async (req, res) => {
  try {
    const { planType } = req.body || {};
    // If client specified 'tutor' or 'student', respect it; otherwise fall back to user's registered role
    const effectiveRole = planType === 'tutor' || planType === 'student' ? planType : req.user.role;
    const isTutor = effectiveRole === 'tutor';

    // Pricing: Pro Tutor Plan = $15 (1500 cents), Pro Student Plan = $10 (1000 cents)
    const unitAmount = isTutor ? 1500 : 1000;
    const planName = isTutor ? 'MentorLagbe Pro Tutor Plan' : 'MentorLagbe Pro Student Plan';
    const description = isTutor
      ? 'Unlimited tuition posts, verified tutor badge, higher search ranking'
      : 'Unlimited bookmarks, priority booking, direct mentor messaging';

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: req.user.email,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: planName,
              description: description,
              images: [
                isTutor
                  ? 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?q=80&w=600&auto=format&fit=crop'
                  : 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=600&auto=format&fit=crop',
              ],
            },
            unit_amount: unitAmount,
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId: req.user.id || '',
        userEmail: req.user.email,
        userName: req.user.name,
        userRole: effectiveRole,
        planName: 'pro',
      },
      success_url: `${CLIENT_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${CLIENT_URL}/payment/cancel`,
    });

    res.json({
      success: true,
      url: session.url,
      sessionId: session.id,
    });
  } catch (error) {
    console.error('Error creating Stripe session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initiate Stripe checkout',
      error: error.message,
    });
  }
});

/**
 * Verify Checkout Session and Sync Database (Idempotent)
 * GET /api/payments/verify-session/:sessionId
 */
router.get('/verify-session/:sessionId', verifyToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (!sessionId) {
      return res.status(400).json({ success: false, message: 'Session ID is required' });
    }

    const { paymentsCollection, usersCollection } = getCollections();

    // Check if transaction was already processed (Idempotency check)
    const existingPayment = await paymentsCollection.findOne({ stripeSessionId: sessionId });
    if (existingPayment) {
      return res.json({
        success: true,
        message: 'Payment already processed and verified',
        payment: existingPayment,
      });
    }

    // Retrieve session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Payment has not been completed yet',
        paymentStatus: session.payment_status,
      });
    }

    const userEmail = session.metadata?.userEmail || session.customer_email || req.user.email;
    const userName = session.metadata?.userName || req.user.name;
    const userRole = session.metadata?.userRole || req.user.role;
    const planName = session.metadata?.planName || 'pro';
    const amount = (session.amount_total || 0) / 100;
    const currency = session.currency || 'usd';
    const transactionId = session.payment_intent?.toString() || session.id;

    const paymentRecord = {
      userEmail,
      userName,
      userRole,
      planName,
      amount,
      currency: currency.toUpperCase(),
      transactionId,
      stripeSessionId: sessionId,
      paymentStatus: 'paid',
      paidAt: new Date(),
    };

    await paymentsCollection.insertOne(paymentRecord);

    // Update user's subscription plan to 'pro'
    await usersCollection.updateOne(
      { email: userEmail },
      { $set: { plan: 'pro', updatedAt: new Date() } }
    );

    res.json({
      success: true,
      message: 'Payment successful! Your account is now upgraded to Pro.',
      payment: paymentRecord,
    });
  } catch (error) {
    console.error('Error verifying Stripe session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify payment session',
      error: error.message,
    });
  }
});

/**
 * Stripe Webhook Handler (checkout.session.completed)
 * POST /api/payments/webhook
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    if (webhookSecret && sig) {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } else {
      event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    }
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    try {
      const { paymentsCollection, usersCollection } = getCollections();
      const existing = await paymentsCollection.findOne({ stripeSessionId: session.id });

      if (!existing && session.payment_status === 'paid') {
        const userEmail = session.metadata?.userEmail || session.customer_email;
        const userName = session.metadata?.userName || 'MentorLagbe User';
        const userRole = session.metadata?.userRole || 'student';
        const amount = (session.amount_total || 0) / 100;

        await paymentsCollection.insertOne({
          userEmail,
          userName,
          userRole,
          planName: 'pro',
          amount,
          currency: (session.currency || 'usd').toUpperCase(),
          transactionId: session.payment_intent?.toString() || session.id,
          stripeSessionId: session.id,
          paymentStatus: 'paid',
          paidAt: new Date(),
        });

        await usersCollection.updateOne(
          { email: userEmail },
          { $set: { plan: 'pro', updatedAt: new Date() } }
        );
      }
    } catch (e) {
      console.error('Error in webhook db write:', e);
    }
  }

  res.json({ received: true });
});

/**
 * User: Get my personal payment history & receipts
 * GET /api/payments/my-history
 */
router.get('/my-history', verifyToken, async (req, res) => {
  try {
    const { paymentsCollection } = getCollections();
    const payments = await paymentsCollection
      .find({ userEmail: req.user.email })
      .sort({ paidAt: -1 })
      .toArray();

    res.json({ success: true, data: payments });
  } catch (error) {
    console.error('Error fetching user payment history:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch payment history' });
  }
});

/**
 * Admin: Get all Stripe transaction records
 * GET /api/payments/admin/all
 */
router.get('/admin/all', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { paymentsCollection } = getCollections();
    const payments = await paymentsCollection
      .find({})
      .sort({ paidAt: -1 })
      .toArray();

    res.json({ success: true, data: payments });
  } catch (error) {
    console.error('Error fetching admin payments:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch transaction records' });
  }
});

export default router;
