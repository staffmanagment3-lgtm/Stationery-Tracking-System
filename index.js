/**
 * Stationery Tracker - push notifications (works even when the PWA is closed).
 *
 * Triggers on Realtime Database changes and sends FCM data messages to the saved device tokens
 * (fcm_tokens/{userId}/{token} = { role, name, updatedAt }).
 *
 * Event keys MUST match the ones used in app.js so the app never shows the same alert twice:
 *   new_<orderId>_admin        teacher submitted an order          -> admin
 *   submitted_<orderId>_teacher                                     -> teacher (confirmation)
 *   approved_<orderId>_teacher admin approved / ready for pickup   -> teacher (with pickup location)
 *   done_<orderId>_teacher     handover finished                    -> teacher
 *   done_<orderId>_admin       handover finished                    -> admin
 */
const { onValueCreated, onValueUpdated } = require('firebase-functions/v2/database');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');

admin.initializeApp();

const DB_OPTS = {
  // Realtime Database in us-central1 (databaseURL without a region suffix). Change both if yours differs.
  region: 'us-central1',
  instance: 'stationery-control-system-default-rtdb',
};

const safeKey = (v) => String(v || 'GUEST').replace(/[.#$\[\]\/]/g, '_');

/** Collect tokens: pass { uid } for one user, or { role } for everyone with that role. */
async function collectTokens({ uid, role }) {
  const snap = await admin.database().ref('fcm_tokens').get();
  const all = snap.val() || {};
  const out = [];
  Object.entries(all).forEach(([userId, tokens]) => {
    if (uid && userId !== safeKey(uid)) return;
    Object.entries(tokens || {}).forEach(([token, meta]) => {
      if (role && String((meta && meta.role) || '').toUpperCase() !== role) return;
      out.push({ token, userId });
    });
  });
  return out;
}

async function send(targets, { title, body, eventKey }) {
  if (!targets.length) return;
  const tokens = targets.map((t) => t.token);
  const res = await admin.messaging().sendEachForMulticast({
    tokens,
    // DATA-ONLY on purpose: sw.js builds the notification, and the open app can dedupe by eventKey.
    data: { title, body, eventKey, url: './index.html' },
    webpush: { headers: { Urgency: 'high', TTL: '86400' } },
    android: { priority: 'high' },
  });

  // Remove dead tokens
  const cleanup = [];
  res.responses.forEach((r, i) => {
    const code = r.error && r.error.code;
    if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') {
      cleanup.push(admin.database().ref(`fcm_tokens/${targets[i].userId}/${targets[i].token}`).remove());
    }
  });
  await Promise.all(cleanup);
  logger.info(`Sent "${title}" to ${res.successCount}/${tokens.length} devices`);
}

const isDone = (s) => /done|completed/i.test(s || '');
const isApproved = (s) => /approved|ready/i.test(s || '') && !isDone(s);

// 1) Teacher submits an order -> admin gets alert, teacher gets confirmation
exports.onOrderCreated = onValueCreated({ ...DB_OPTS, ref: '/orders/{orderId}' }, async (event) => {
  const order = event.data.val() || {};
  const id = event.params.orderId;
  if (String(order.status) !== 'Pending Approval') return;

  const count = Array.isArray(order.items) ? order.items.length : Object.keys(order.items || {}).length;
  await Promise.all([
    collectTokens({ role: 'ADMIN' }).then((t) => send(t, {
      title: '🆕 New Order Received',
      body: `Order ${id} from ${order.teacherName || 'a teacher'} (${count} item${count === 1 ? '' : 's'}) is waiting for approval.`,
      eventKey: `new_${id}_admin`,
    })),
    collectTokens({ uid: order.teacherUid }).then((t) => send(t, {
      title: '✅ Order Submitted',
      body: `Your order ${id} has been submitted. Please wait for admin approval.`,
      eventKey: `submitted_${id}_teacher`,
    })),
  ]);
});

// 2) Status changes: approved -> teacher, done -> teacher + admin
exports.onOrderUpdated = onValueUpdated({ ...DB_OPTS, ref: '/orders/{orderId}' }, async (event) => {
  const before = event.data.before.val() || {};
  const after = event.data.after.val() || {};
  const id = event.params.orderId;
  if (before.status === after.status) return;

  if (isApproved(after.status) && !isApproved(before.status) && !isDone(before.status)) {
    const where = after.pickupLocation && after.pickupLocation !== 'Awaiting Admin Details' ? after.pickupLocation : 'the stationery store';
    await collectTokens({ uid: after.teacherUid }).then((t) => send(t, {
      title: '📦 Your Order is Ready!',
      body: `Your items are ready. Please collect them from: ${where}.`,
      eventKey: `approved_${id}_teacher`,
    }));
  }

  if (isDone(after.status) && !isDone(before.status)) {
    await Promise.all([
      collectTokens({ uid: after.teacherUid }).then((t) => send(t, {
        title: '✅ Handover Confirmed',
        body: `Order ${id} was handed over and signed. Thank you!`,
        eventKey: `done_${id}_teacher`,
      })),
      collectTokens({ role: 'ADMIN' }).then((t) => send(t, {
        title: '✅ Handover Confirmed',
        body: `Order ${id} was handed over to ${after.teacherName || 'the teacher'} and confirmed.`,
        eventKey: `done_${id}_admin`,
      })),
    ]);
  }
});
