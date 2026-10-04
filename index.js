/**
 * Stationery Tracker - push notifications via OneSignal (works even when the PWA is closed).
 *
 * Triggers on Realtime Database changes and asks OneSignal to deliver the notification to the one
 * active device of each target user. app.js registers it at fcm_tokens/{userId}/os_{deviceId}
 * = { role, name, subscriptionId, updatedAt }.
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
const ONESIGNAL_APP_ID = '87270c54-9e9d-46de-8070-a0c4b66c7478';
// REST API Key is a SECRET: set with  firebase functions:secrets:set ONESIGNAL_API_KEY
const ONESIGNAL_API_KEY = defineSecret('ONESIGNAL_API_KEY');

const DB_OPTS = {
  region: 'us-central1',
  instance: 'stationery-control-system-default-rtdb',
  secrets: [ONESIGNAL_API_KEY],
};

const ADMIN_ROLES = ['ADMIN', 'DEVELOPER', 'SUPER_ADMIN'];
const safeKey = (v) => String(v || 'GUEST').replace(/[.#$\[\]\/]/g, '_');

/**
 * OneSignal subscription ids of the target users. Every user has only ONE active device
 * (app.js keeps a single os_<deviceId> entry with its subscriptionId in fcm_tokens/{userId}).
 */
async function collectSubscriptionIds({ uid, adminsOnly }) {
  const snap = await admin.database().ref('fcm_tokens').get();
  const all = snap.val() || {};
  const out = new Set();
  Object.entries(all).forEach(([userId, devices]) => {
    if (uid && userId !== safeKey(uid)) return;
    Object.entries(devices || {}).forEach(([key, meta]) => {
      if (!key.startsWith('os_') || !meta || !meta.subscriptionId) return; // ignore old FCM tokens
      if (adminsOnly && !ADMIN_ROLES.includes(String(meta.role || '').toUpperCase())) return;
      out.add(meta.subscriptionId);
    });
  });
  return [...out];
}

async function send(subscriptionIds, { title, body, eventKey }) {
  if (!subscriptionIds.length) return;
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
        include_subscription_ids: subscriptionIds,
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
    else logger.info(`Sent "${title}" to ${subscriptionIds.length} device(s): ${text}`);
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
    collectSubscriptionIds({ adminsOnly: true }).then((u) => send(u, {
      title: '🆕 New Order Received',
      body: `Order ${id} from ${order.teacherName || 'a teacher'} (${count} item${count === 1 ? '' : 's'}) is waiting for approval.`,
      eventKey: `new_${id}_admin`,
    })),
    collectSubscriptionIds({ uid: order.teacherUid }).then((u) => send(u, {
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
    await collectSubscriptionIds({ uid: after.teacherUid }).then((u) => send(u, {
      title: '📦 Your Order is Ready!',
      body: `Your items are ready. Please collect them from: ${where}.`,
      eventKey: `approved_${id}_teacher`,
    }));
  }

  if (isDone(after.status) && !isDone(before.status)) {
    await Promise.all([
      collectSubscriptionIds({ uid: after.teacherUid }).then((u) => send(u, {
        title: '✅ Handover Confirmed',
        body: `Order ${id} was handed over and signed. Thank you!`,
        eventKey: `done_${id}_teacher`,
      })),
      collectSubscriptionIds({ adminsOnly: true }).then((u) => send(u, {
        title: '✅ Handover Confirmed',
        body: `Order ${id} was handed over to ${after.teacherName || 'the teacher'} and confirmed.`,
        eventKey: `done_${id}_admin`,
      })),
    ]);
  }
});
