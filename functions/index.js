const express = require('express');
const cors = require('cors');
const Stripe = require('stripe');
const { onRequest } = require('firebase-functions/v2/https');
const logger = require('firebase-functions/logger');
const { initializeApp, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getDatabase } = require('firebase-admin/database');
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

function toRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value;
}

function toText(value, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function toBool(value, fallback = false) {
  if (value === undefined || value === null) return fallback;
  return value === true;
}

function stripUndefined(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined));
}

function normalizeRole(value) {
  return toText(value).toLowerCase();
}

function sanitizeNotificationMeta(meta) {
  const out = {};
  const raw = toRecord(meta);
  for (const [key, value] of Object.entries(raw)) {
    const safeKey = String(key || '').trim();
    if (!safeKey) continue;
    out[safeKey] = String(value ?? '');
  }
  return out;
}

function normalizeBonusCode(value) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, '');
}

function roundMoney(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return 0;
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

function isExpiredIso(value) {
  const text = toText(value);
  if (!text) return false;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return false;
  return date.getTime() < Date.now();
}

async function writeAuditLog(payload) {
  try {
    const actorId = toText(payload?.actorId);
    if (!actorId) return;
    const db = getDatabase();
    const node = db.ref('auditLogs').push();
    const id = node.key || `audit_${Date.now()}`;
    await node.set(stripUndefined({
      id,
      at: new Date().toISOString(),
      action: toText(payload?.action),
      resource: toText(payload?.resource),
      resourceId: toText(payload?.resourceId) || undefined,
      status: toText(payload?.status, 'success'),
      actorId,
      actorRole: toText(payload?.actorRole, 'authenticated'),
      targetUserId: toText(payload?.targetUserId) || undefined,
      message: toText(payload?.message) || undefined,
      meta: toRecord(payload?.meta)
    }));
  } catch (err) {
    logger.error('audit.log.error', err);
  }
}

async function createBonusNotification(userId, opts) {
  try {
    const safeUserId = toText(userId);
    if (!safeUserId) return;
    const db = getDatabase();
    const node = db.ref(`notifications/${safeUserId}`).push();
    const id = node.key || `ntf_${Date.now()}`;
    await node.set(stripUndefined({
      id,
      userId: safeUserId,
      type: 'bonus',
      title: toText(opts?.title, 'Bonus aggiornato'),
      message: toText(opts?.message, 'Il tuo wallet bonus e stato aggiornato.'),
      link: '/dashboard/buoni',
      priority: toText(opts?.priority, 'normal'),
      createdAt: new Date().toISOString(),
      readAt: null,
      meta: sanitizeNotificationMeta(opts?.meta)
    }));
  } catch (err) {
    logger.error('bonus.notification.error', err);
  }
}

async function resolveActorRole(uid) {
  const db = getDatabase();
  const [adminSnap, roleSnap] = await Promise.all([
    db.ref(`adminUids/${uid}`).get(),
    db.ref(`users/${uid}/role`).get(),
  ]);

  if (adminSnap.exists() && adminSnap.val() === true) return 'admin';
  return normalizeRole(roleSnap.val()) || 'guest';
}

async function requireRole(req, res, next, allowedRoles) {
  try {
    const authHeader = String(req.headers.authorization || '');
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing bearer token' });
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      return res.status(401).json({ error: 'Empty bearer token' });
    }

    const decoded = await getAuth().verifyIdToken(token);
    const uid = String(decoded?.uid ?? '').trim();
    if (!uid) {
      return res.status(401).json({ error: 'Invalid auth token' });
    }

    const role = await resolveActorRole(uid);
    if (!allowedRoles.includes(role)) {
      return res.status(403).json({ error: 'FORBIDDEN' });
    }

    req.actor = { uid, role };
    return next();
  } catch (err) {
    logger.error('auth.middleware.error', err);
    return res.status(401).json({ error: 'AUTH_FAILED' });
  }
}

function requireBackoffice(req, res, next) {
  return requireRole(req, res, next, ['admin', 'staff']);
}

function requireAdmin(req, res, next) {
  return requireRole(req, res, next, ['admin']);
}

function requireAuthenticated(req, res, next) {
  return requireRole(req, res, next, ['admin', 'staff', 'client', 'public', 'guest']);
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

app.post('/api/payments/notifications/create', requireBackoffice, async (req, res) => {
  try {
    const actor = req.actor || {};
    const {
      userId,
      type,
      title,
      message,
      link,
      priority = 'normal',
      meta
    } = req.body || {};

    const safeUserId = toText(userId);
    const safeType = toText(type);
    const safeTitle = toText(title);
    const safeMessage = toText(message);
    const safeLink = toText(link);
    const safePriority = toText(priority, 'normal');

    if (!safeUserId || !safeType || !safeTitle || !safeMessage) {
      return res.status(400).json({ error: 'Missing required notification fields' });
    }

    if (!['booking', 'chat', 'payment', 'bonus', 'system'].includes(safeType)) {
      return res.status(400).json({ error: 'Invalid notification type' });
    }

    if (!['low', 'normal', 'high'].includes(safePriority)) {
      return res.status(400).json({ error: 'Invalid notification priority' });
    }

    const db = getDatabase();
    const node = db.ref(`notifications/${safeUserId}`).push();
    const id = node.key || `ntf_${Date.now()}`;

    await node.set(stripUndefined({
      id,
      userId: safeUserId,
      type: safeType,
      title: safeTitle,
      message: safeMessage,
      link: safeLink || undefined,
      priority: safePriority,
      createdAt: new Date().toISOString(),
      readAt: null,
      meta: sanitizeNotificationMeta(meta),
      createdBy: actor.uid,
      createdByRole: actor.role
    }));

    return res.status(200).json({ success: true, id });
  } catch (err) {
    logger.error('notifications.create.error', err);
    return res.status(500).json({ error: 'NOTIFICATION_CREATE_FAILED' });
  }
});

app.post('/api/payments/staff/sync-profile', requireAdmin, async (req, res) => {
  try {
    const {
      userId,
      currentUser,
      nextUser,
      prevRole,
      nextRole,
      nowIso
    } = req.body || {};

    const safeUserId = toText(userId);
    if (!safeUserId) {
      return res.status(400).json({ error: 'Missing userId' });
    }

    const current = toRecord(currentUser);
    const next = toRecord(nextUser);
    const prevRoleNorm = normalizeRole(prevRole);
    const nextRoleNorm = normalizeRole(nextRole);
    const now = toText(nowIso) || new Date().toISOString();

    const db = getDatabase();
    const profileRef = db.ref(`staffProfiles/${safeUserId}`);
    const publicRef = db.ref(`publicStaff/${safeUserId}`);

    if (prevRoleNorm !== 'staff' && nextRoleNorm === 'staff') {
      const profileSnap = await profileRef.get();
      const existing = toRecord(profileSnap.exists() ? profileSnap.val() : {});

      const staffName = toText(next.name ?? current.name ?? existing.name, safeUserId);
      const photoUrl = toText(next.urlAvatar ?? current.urlAvatar ?? existing.photoUrl);
      const email = toText(next.email ?? current.email ?? existing.email);
      const phone = toText(next.phone ?? current.phone ?? existing.phone);
      const bio = toText(existing.bio, '');
      const role = toText(existing.role, 'altro');
      const isActive = toBool(next.isActive, true);

      await Promise.all([
        profileRef.update({
          id: safeUserId,
          userId: safeUserId,
          name: staffName,
          role,
          bio,
          photoUrl,
          email,
          phone,
          isActive,
          deletedAt: null
        }),
        publicRef.update({
          id: safeUserId,
          userId: safeUserId,
          name: staffName,
          role: 'staff',
          bio,
          photoUrl,
          email,
          phone,
          isActive,
          deletedAt: null
        })
      ]);

      return res.status(200).json({ success: true, mode: 'promote' });
    }

    if (prevRoleNorm === 'staff' && nextRoleNorm !== 'staff') {
      await Promise.all([
        profileRef.update({ isActive: false, deletedAt: now }),
        publicRef.update({ isActive: false, deletedAt: now })
      ]);
      return res.status(200).json({ success: true, mode: 'demote' });
    }

    if (nextRoleNorm === 'staff') {
      const staffName = toText(next.name ?? current.name, safeUserId);
      const photoUrl = toText(next.urlAvatar ?? current.urlAvatar);
      const email = toText(next.email ?? current.email);
      const phone = toText(next.phone ?? current.phone);
      const isActive = toBool(next.isActive, true);

      await Promise.all([
        profileRef.update({
          name: staffName,
          photoUrl,
          email,
          phone,
          isActive
        }),
        publicRef.update({
          id: safeUserId,
          userId: safeUserId,
          name: staffName,
          role: 'staff',
          photoUrl,
          email,
          phone,
          isActive,
          deletedAt: null
        })
      ]);

      return res.status(200).json({ success: true, mode: 'update' });
    }

    return res.status(200).json({ success: true, mode: 'noop' });
  } catch (err) {
    logger.error('staff.sync_profile.error', err);
    return res.status(500).json({ error: 'STAFF_SYNC_FAILED' });
  }
});

app.post('/api/payments/bonus/apply-promo', requireAuthenticated, async (req, res) => {
  try {
    const actor = req.actor || {};
    const uid = toText(actor.uid);
    if (!uid) {
      return res.status(401).json({ error: 'AUTH_FAILED' });
    }

    const code = normalizeBonusCode(req.body?.code);
    if (!code) {
      return res.status(400).json({ error: 'ENTER_PROMO_CODE' });
    }

    const db = getDatabase();
    const promoSnap = await db.ref('bonus/promoCodes').orderByChild('code').equalTo(code).get();
    if (!promoSnap.exists()) {
      return res.status(404).json({ error: 'PROMO_NOT_FOUND' });
    }

    const [promoId, promoRaw] = Object.entries(toRecord(promoSnap.val()))[0] || [];
    const promo = toRecord(promoRaw);
    if (!promoId) {
      return res.status(404).json({ error: 'PROMO_NOT_FOUND' });
    }

    if (promo.active === false) {
      return res.status(409).json({ error: 'PROMO_DISABLED' });
    }
    if (isExpiredIso(promo.expiresAt)) {
      return res.status(409).json({ error: 'PROMO_EXPIRED' });
    }

    const maxUses = Number(promo.maxUses);
    const usedCount = Number(promo.usedCount || 0);
    if (Number.isFinite(maxUses) && maxUses > 0 && usedCount >= maxUses) {
      return res.status(409).json({ error: 'PROMO_EXHAUSTED' });
    }

    const redeemKey = `promo_${promoId}`;
    const redeemRef = db.ref(`bonus/redeems/${uid}/${redeemKey}`);
    const alreadySnap = await redeemRef.get();
    if (alreadySnap.exists()) {
      return res.status(409).json({ error: 'PROMO_ALREADY_USED' });
    }

    const amount = roundMoney(Number(promo.creditAmount || 0));
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(409).json({ error: 'PROMO_INVALID_AMOUNT' });
    }

    const walletSnap = await db.ref(`bonus/wallets/${uid}`).get();
    const wallet = toRecord(walletSnap.exists() ? walletSnap.val() : {});
    const walletBalance = roundMoney(Number(wallet.balance || 0) + amount);
    const now = new Date().toISOString();
    const ledgerNode = db.ref(`bonus/ledger/${uid}`).push();
    const ledgerId = ledgerNode.key || `led_${Date.now()}`;

    await db.ref('bonus').update({
      [`promoCodes/${promoId}/usedCount`]: usedCount + 1,
      [`promoCodes/${promoId}/updatedAt`]: now,
      [`redeems/${uid}/${redeemKey}`]: {
        kind: 'promo',
        code,
        amount,
        sourceId: promoId,
        at: now
      },
      [`wallets/${uid}`]: {
        userId: uid,
        balance: walletBalance,
        updatedAt: now
      },
      [`ledger/${uid}/${ledgerId}`]: {
        id: ledgerId,
        userId: uid,
        type: 'promo',
        code,
        amount,
        sourceId: promoId,
        at: now,
        note: toText(promo.description) || null
      }
    });

    void createBonusNotification(uid, {
      title: 'Promo applicata',
      message: `Codice ${code} applicato: +${amount.toFixed(2)} EUR`,
      priority: 'normal',
      meta: { code }
    });

    void writeAuditLog({
      action: 'bonus.promo.redeem',
      resource: 'bonus_promo',
      resourceId: promoId,
      status: 'success',
      actorId: uid,
      actorRole: toText(actor.role, 'authenticated'),
      targetUserId: uid,
      meta: { code, amount, walletBalance }
    });

    return res.status(200).json({
      success: true,
      code,
      amount,
      walletBalance
    });
  } catch (err) {
    logger.error('bonus.apply_promo.error', err);
    return res.status(500).json({ error: 'BONUS_PROMO_APPLY_FAILED' });
  }
});

app.post('/api/payments/bonus/redeem-gift', requireAuthenticated, async (req, res) => {
  try {
    const actor = req.actor || {};
    const uid = toText(actor.uid);
    if (!uid) {
      return res.status(401).json({ error: 'AUTH_FAILED' });
    }

    const code = normalizeBonusCode(req.body?.code);
    if (!code) {
      return res.status(400).json({ error: 'ENTER_GIFT_CODE' });
    }

    const db = getDatabase();
    const giftSnap = await db.ref('bonus/giftCards').orderByChild('code').equalTo(code).get();
    if (!giftSnap.exists()) {
      return res.status(404).json({ error: 'GIFT_NOT_FOUND' });
    }

    const [giftId, giftRaw] = Object.entries(toRecord(giftSnap.val()))[0] || [];
    const gift = toRecord(giftRaw);
    if (!giftId) {
      return res.status(404).json({ error: 'GIFT_NOT_FOUND' });
    }

    if (gift.active === false) {
      return res.status(409).json({ error: 'GIFT_DISABLED' });
    }
    if (isExpiredIso(gift.expiresAt)) {
      return res.status(409).json({ error: 'GIFT_EXPIRED' });
    }

    const amount = roundMoney(Number(gift.balance ?? gift.initialAmount ?? 0));
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(409).json({ error: 'GIFT_ALREADY_REDEEMED' });
    }

    const walletSnap = await db.ref(`bonus/wallets/${uid}`).get();
    const wallet = toRecord(walletSnap.exists() ? walletSnap.val() : {});
    const walletBalance = roundMoney(Number(wallet.balance || 0) + amount);
    const now = new Date().toISOString();
    const ledgerNode = db.ref(`bonus/ledger/${uid}`).push();
    const ledgerId = ledgerNode.key || `led_${Date.now()}`;
    const usesCount = Number(gift.usesCount || 0);
    const redeemKey = `gift_${giftId}`;

    await db.ref('bonus').update({
      [`giftCards/${giftId}/balance`]: 0,
      [`giftCards/${giftId}/active`]: false,
      [`giftCards/${giftId}/redeemedBy`]: uid,
      [`giftCards/${giftId}/redeemedAt`]: now,
      [`giftCards/${giftId}/usesCount`]: usesCount + 1,
      [`giftCards/${giftId}/updatedAt`]: now,
      [`redeems/${uid}/${redeemKey}`]: {
        kind: 'gift_card',
        code,
        amount,
        sourceId: giftId,
        at: now
      },
      [`wallets/${uid}`]: {
        userId: uid,
        balance: walletBalance,
        updatedAt: now
      },
      [`ledger/${uid}/${ledgerId}`]: {
        id: ledgerId,
        userId: uid,
        type: 'gift_card',
        code,
        amount,
        sourceId: giftId,
        at: now,
        note: toText(gift.note) || null
      }
    });

    void createBonusNotification(uid, {
      title: 'Gift card riscattata',
      message: `Gift card ${code} riscattata: +${amount.toFixed(2)} EUR`,
      priority: 'high',
      meta: { code }
    });

    void writeAuditLog({
      action: 'bonus.gift.redeem',
      resource: 'gift_card',
      resourceId: giftId,
      status: 'success',
      actorId: uid,
      actorRole: toText(actor.role, 'authenticated'),
      targetUserId: uid,
      meta: { code, amount, walletBalance }
    });

    return res.status(200).json({
      success: true,
      code,
      amount,
      walletBalance
    });
  } catch (err) {
    logger.error('bonus.redeem_gift.error', err);
    return res.status(500).json({ error: 'BONUS_GIFT_REDEEM_FAILED' });
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
