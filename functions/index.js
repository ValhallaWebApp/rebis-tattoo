const express = require('express');
const cors = require('cors');
const Stripe = require('stripe');
const { onRequest } = require('firebase-functions/v2/https');
const logger = require('firebase-functions/logger');
const { initializeApp, getApps } = require('firebase-admin/app');
require('dotenv').config();

if (getApps().length === 0) {
  initializeApp();
}

const defaultOrigins = [
  'http://localhost:4200',
  'https://rebis-tattoo-55816.web.app',
  'https://rebis-tattoo-55816.firebaseapp.com',
];

const allowedOrigins = (process.env.ALLOWED_ORIGINS || defaultOrigins.join(','))
  .split(',')
  .map((v) => v.trim())
  .filter(Boolean);

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

if (!stripeSecretKey) {
  logger.warn('Missing STRIPE_SECRET_KEY. Payment endpoints will fail until it is configured.');
}

const stripe = stripeSecretKey
  ? Stripe(stripeSecretKey, { apiVersion: '2024-06-20' })
  : null;

const app = express();
const processedEvents = new Set();

const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Stripe-Signature'],
  credentials: false,
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

function normalizeCurrency(value) {
  return String(value || 'eur').trim().toLowerCase();
}

function parseAmount(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return null;
  return n;
}

function isAllowedCurrency(currency) {
  return new Set(['eur', 'usd', 'gbp']).has(currency);
}

async function notifyBookingStatus(bookingId, status, paymentIntentId) {
  const url = process.env.BOOKING_STATUS_CALLBACK_URL;
  if (!url || !bookingId) return;

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId, status, paymentIntentId }),
    });
  } catch (err) {
    logger.error('[payments] booking callback failed', err);
  }
}

app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe) return res.status(500).json({ error: 'Missing STRIPE_SECRET_KEY' });
  if (!stripeWebhookSecret) return res.status(500).json({ error: 'Missing STRIPE_WEBHOOK_SECRET' });

  const signature = req.headers['stripe-signature'];
  if (!signature) return res.status(400).json({ error: 'Missing stripe-signature header' });

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, stripeWebhookSecret);
  } catch (_err) {
    return res.status(400).json({ error: 'Invalid webhook signature' });
  }

  if (processedEvents.has(event.id)) {
    return res.status(200).json({ received: true, duplicate: true });
  }
  processedEvents.add(event.id);

  try {
    if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object;
      await notifyBookingStatus(pi.metadata?.bookingId, 'paid', pi.id);
    } else if (event.type === 'payment_intent.payment_failed') {
      const pi = event.data.object;
      await notifyBookingStatus(pi.metadata?.bookingId, 'payment_failed', pi.id);
    } else if (event.type === 'payment_intent.canceled') {
      const pi = event.data.object;
      await notifyBookingStatus(pi.metadata?.bookingId, 'canceled', pi.id);
    }
    return res.status(200).json({ received: true });
  } catch (err) {
    logger.error('payment.webhook.handle.error', err);
    return res.status(500).json({ error: 'Webhook processing error' });
  }
});

app.use(express.json({ limit: '1mb' }));

app.post('/api/payments/create', async (req, res) => {
  if (!stripe) return res.status(500).json({ error: 'Missing STRIPE_SECRET_KEY' });
  try {
    const {
      amount,
      currency = 'eur',
      description = 'Pagamento Rebis Tattoo',
      bookingId,
    } = req.body || {};

    const safeAmount = parseAmount(amount);
    const safeCurrency = normalizeCurrency(currency);

    if (!safeAmount) {
      return res.status(400).json({ error: 'amount deve essere un intero positivo (centesimi)' });
    }

    if (!isAllowedCurrency(safeCurrency)) {
      return res.status(400).json({ error: 'currency non supportata' });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: safeAmount,
      currency: safeCurrency,
      description,
      automatic_payment_methods: { enabled: true },
      metadata: {
        bookingId: bookingId ? String(bookingId) : '',
      },
    });

    return res.status(200).json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (err) {
    logger.error('payment.create.error', err);
    return res.status(500).json({ error: 'Errore durante la creazione del pagamento' });
  }
});

app.post('/api/payments/confirm', async (req, res) => {
  if (!stripe) return res.status(500).json({ error: 'Missing STRIPE_SECRET_KEY' });
  const allowTestConfirm = process.env.ENABLE_TEST_CONFIRM === 'true';
  if (!allowTestConfirm) return res.status(404).json({ error: 'NOT_FOUND' });

  try {
    const { paymentIntentId, paymentMethod = 'pm_card_visa' } = req.body || {};
    if (!paymentIntentId) return res.status(400).json({ error: 'paymentIntentId e obbligatorio' });

    const confirmed = await stripe.paymentIntents.confirm(paymentIntentId, {
      payment_method: paymentMethod,
    });
    return res.status(200).json({ success: true, payment: confirmed });
  } catch (err) {
    logger.error('payment.confirm.error', err);
    return res.status(500).json({ error: 'Errore durante la conferma del pagamento' });
  }
});

app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true });
});

exports.paymentApi = onRequest(
  {
    region: 'europe-west1',
    timeoutSeconds: 60,
    memory: '256MiB',
    secrets: [
      'STRIPE_SECRET_KEY',
      'STRIPE_WEBHOOK_SECRET',
      'ALLOWED_ORIGINS',
      'ENABLE_TEST_CONFIRM',
    ],
  },
  app,
);
