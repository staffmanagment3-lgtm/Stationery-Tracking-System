/**
 * Stationery Tracker - push notifications via OneSignal (works even when the PWA is closed).
 *
 * Triggers on Realtime Database changes and asks OneSignal to deliver the notification to every
 * device of the target user(s). Devices are registered by app.js at fcm_tokens/{userId}/os_{deviceId}
 * = { role, name, updatedAt } and linked in OneSignal with external id = userId.
 *
 * Event keys MUST match app.js so the app never shows the same alert twice:
 *   new_<orderId>_admin        teacher submitted an order          -> admin
 *   submitted_<orderId>_teacher                                     -> teacher (confirmation)
 *   approved_<orderId>_teacher admin approved / ready for pickup   -> teacher (with pickup location)
 *   done_<orderId>_teacher     handover finished                    -> teacher
 *   done_<orderId>_admin       handover finished                    -> admin
 */
const { onValueCreated, onValueUpdated } = require('firebase-functions/v2/database');
const { defineSecret } = require('firebase-functions/params');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');

admin.initializeApp();

// Same App ID as in app.js (OneSignal dashboard -> Settings -> Keys & IDs)
const ONESIGNAL_APP_ID = 'PASTE_YOUR_ONESIGNAL_APP_ID_HERE';
// REST API Key is a SECRET: set with  firebase functions:secrets:set ONESIGNAL_API_KEY
const ONESIGNAL_API_KEY = defineSecret('ONESIGNAL_API_KEY');

const DB_OPTS = {
  region: 'us-central1',
  instance: 'stationery-control-system-default-rtdb',
  secrets: [ONESIGNAL_API_KEY],
};

const ADMIN_ROLES = ['ADMIN', 'DEVELOPER', 'SUPER_ADMIN'];
const safeKey = (v) => String(v || 'GUEST').replace(/[.#$\[\]\/]/g, '_');

/** User ids (= OneSignal external ids) that have at least one registered device. */
async function collectUserIds({ uid, adminsOnly }) {
  const snap = await admin.database().ref('fcm_tokens').get();
  const all = snap.val() || {};
  const out = new Set();
  Object.entries(all).forEach(([userId, devices]) => {
    if (uid && userId !== safeKey(uid)) return;
    Object.entries(devices || {}).forEach(([key, meta]) => {
      if (!key.startsWith('os_')) return; // ignore old FCM tokens
      if (adminsOnly && !ADMIN_ROLES.includes(String((meta && meta.role) || '').toUpperCase())) return;
      out.add(userId);
    });
  });
  return [...out];
}

async function send(userIds, { title, body, eventKey }) {
  if (!userIds.length) return;
  try {
    const res = await fetch('https://api.onesignal.com/notifications?c=push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: `Key ${ONESIGNAL_API_KEY.value()}`,
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        target_channel: 'push',
        include_aliases: { external_id: userIds },
        headings: { en: title },
        contents: { en: body },
        data: { eventKey, title, body },
        collapse_id: eventKey, // same event never stacks twice
        priority: 10,
        ttl: 86400,
      }),
    });
    const text = await res.text();
    if (!res.ok) logger.error(`OneSignal error ${res.status} for "${title}": ${text}`);
    else logger.info(`Sent "${title}" to ${userIds.length} user(s): ${text}`);
  } catch (e) {
    logger.error('OneSignal request failed', e);
  }
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
    collectUserIds({ adminsOnly: true }).then((u) => send(u, {
      title: '🆕 New Order Received',
      body: `Order ${id} from ${order.teacherName || 'a teacher'} (${count} item${count === 1 ? '' : 's'}) is waiting for approval.`,
      eventKey: `new_${id}_admin`,
    })),
    collectUserIds({ uid: order.teacherUid }).then((u) => send(u, {
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
    await collectUserIds({ uid: after.teacherUid }).then((u) => send(u, {
      title: '📦 Your Order is Ready!',
      body: `Your items are ready. Please collect them from: ${where}.`,
      eventKey: `approved_${id}_teacher`,
    }));
  }

  if (isDone(after.status) && !isDone(before.status)) {
    await Promise.all([
      collectUserIds({ uid: after.teacherUid }).then((u) => send(u, {
        title: '✅ Handover Confirmed',
        body: `Order ${id} was handed over and signed. Thank you!`,
        eventKey: `done_${id}_teacher`,
      })),
      collectUserIds({ adminsOnly: true }).then((u) => send(u, {
        title: '✅ Handover Confirmed',
        body: `Order ${id} was handed over to ${after.teacherName || 'the teacher'} and confirmed.`,
        eventKey: `done_${id}_admin`,
      })),
    ]);
  }
});
