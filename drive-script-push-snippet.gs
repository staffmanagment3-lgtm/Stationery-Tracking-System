// =====================================================================================
//  GOOGLE APPS SCRIPT  -  FREE push notifications (OneSignal) - no Firebase Blaze needed
// =====================================================================================
//  Kya karna hai (script.google.com -> apna wahi project jiska URL app me Drive Connector me saved hai):
//
//  STEP 1. Apne existing   function doPost(e) {   ke bilkul upar wali pehli line ke baad,
//          neeche wala  "BEGIN pushNotify ... END pushNotify"  block paste karo
//          (agar getImage/delete wale blocks pehle se hain to unke saath hi, koi problem nahi).
//
//  STEP 2. Is file ke baaki saare functions (PUSH_APP_ID se authorizeOnce tak) apni script ke
//          sabse NEECHE paste karo (doPost ke bahar).
//
//  STEP 3. PUSH_API_KEY me OneSignal ki REST API Key paste karo
//          (OneSignal -> Settings -> Keys & IDs). Ye script kisi ko share mat karna.
//
//  STEP 4. Save (disk icon). Upar function list me  authorizeOnce  chuno -> Run -> Review permissions ->
//          apna account -> Advanced -> Go to project (unsafe) -> Allow.
//
//  STEP 5. Deploy -> Manage deployments -> pencil (edit) -> Version: "New version" -> Deploy.
//          (URL wahi rehta hai. Naya deployment mat banana.)
//
//  --------- doPost ke andar sabse upar paste karo ---------
//
//   // ---------- BEGIN pushNotify ----------
//   var __pq = null;
//   try { __pq = JSON.parse(e.postData.contents); } catch (__x) {}
//   if (__pq && (__pq.action === 'pushNotify' || __pq.action === 'pushClaim')) {
//     return __pushHandle(__pq);
//   }
//   // ---------- END pushNotify ----------
//
//  --------- Neeche wala sab doPost ke BAHAR, file ke end me paste karo ---------

var PUSH_APP_ID  = '87270c54-9e9d-46de-8070-a0c4b66c7478';
var PUSH_API_KEY = 'PASTE_ONESIGNAL_REST_API_KEY_HERE';

function __pushJson(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function __pushCall(method, path, payload) {
  var opt = { method: method, contentType: 'application/json', headers: { Authorization: 'Key ' + PUSH_API_KEY }, muteHttpExceptions: true };
  if (payload) opt.payload = JSON.stringify(payload);
  var r = UrlFetchApp.fetch('https://api.onesignal.com' + path, opt);
  return { code: r.getResponseCode(), text: r.getContentText() };
}

function __pushHandle(q) {
  try {
    if (String(PUSH_API_KEY).indexOf('PASTE') === 0) return __pushJson({ status: 'error', message: 'PUSH_API_KEY not set in Apps Script' });
    var idOk = /^[A-Za-z0-9_\-]{1,100}$/;

    // ---- one active device per user: delete this user's other push subscriptions ----
    if (q.action === 'pushClaim') {
      if (!idOk.test(String(q.externalId || '')) || !q.keepSubscriptionId) return __pushJson({ status: 'error', message: 'bad claim' });
      var g = __pushCall('get', '/apps/' + PUSH_APP_ID + '/users/by/external_id/' + encodeURIComponent(q.externalId));
      if (g.code !== 200) return __pushJson({ status: 'skipped', code: g.code });
      var subs = (JSON.parse(g.text).subscriptions) || [];
      var removed = 0;
      subs.forEach(function (s) {
        if (s && s.id && s.id !== q.keepSubscriptionId && /Push/i.test(String(s.type || ''))) {
          __pushCall('delete', '/apps/' + PUSH_APP_ID + '/subscriptions/' + s.id);
          removed++;
        }
      });
      return __pushJson({ status: 'success', removed: removed });
    }

    // ---- send a notification ----
    var title = String(q.title || '').slice(0, 100);
    var body = String(q.body || '').slice(0, 300);
    var key = String(q.eventKey || '').slice(0, 120);
    if (!title || !body || !key) return __pushJson({ status: 'error', message: 'missing title/body/eventKey' });

    var payload = {
      app_id: PUSH_APP_ID,
      target_channel: 'push',
      headings: { en: title },
      contents: { en: body },
      data: { eventKey: key, title: title, body: body },
      priority: 10,
      ttl: 86400
    };
    if (String(q.url || '').indexOf('https://') === 0) payload.url = String(q.url).slice(0, 300);

    if (q.admins === true) {
      payload.filters = [
        { field: 'tag', key: 'role', relation: '=', value: 'ADMIN' }, { operator: 'OR' },
        { field: 'tag', key: 'role', relation: '=', value: 'DEVELOPER' }, { operator: 'OR' },
        { field: 'tag', key: 'role', relation: '=', value: 'SUPER_ADMIN' }
      ];
    } else if (idOk.test(String(q.externalId || ''))) {
      payload.include_aliases = { external_id: [String(q.externalId)] };
    } else {
      return __pushJson({ status: 'error', message: 'no target' });
    }

    var lock = LockService.getScriptLock();
    lock.waitLock(15000);
    try {
      var cache = CacheService.getScriptCache();
      if (cache.get('push_' + key)) return __pushJson({ status: 'duplicate' });   // same event is sent only once
      var r = __pushCall('post', '/notifications?c=push', payload);
      if (r.code >= 200 && r.code < 300) {
        cache.put('push_' + key, '1', 21600);
        return __pushJson({ status: 'success', response: r.text });
      }
      return __pushJson({ status: 'error', message: 'OneSignal ' + r.code + ': ' + r.text });
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return __pushJson({ status: 'error', message: String(err) });
  }
}

// Run this ONCE from the editor (Run button) so Google asks permission for "external requests".
function authorizeOnce() {
  UrlFetchApp.fetch('https://api.onesignal.com', { muteHttpExceptions: true });
}
