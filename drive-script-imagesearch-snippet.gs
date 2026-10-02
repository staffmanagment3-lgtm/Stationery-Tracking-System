// =====================================================================================
//  GOOGLE APPS SCRIPT  -  add "imageSearch" so Purchase Orders can show real product pictures
// =====================================================================================
//  What it does: the Purchase Orders form asks this script for pictures of an item
//  (e.g. "Cosmoplast Storage Box"). The script asks Serper.dev (real Google Images results)
//  and sends back up to 8 pictures. Your API key stays INSIDE the script (Script Properties),
//  it is never visible in the browser.
//
//  ---- A. Get a free key (2 minutes, no credit card, 2,500 free searches) ----
//  1. Go to https://serper.dev  ->  Sign up  ->  copy your API key (Dashboard -> API Key).
//
//  ---- B. Save the key inside your Apps Script ----
//  2. Open your Apps Script project (the same one used for Drive photos).
//  3. Left side: Project Settings (gear icon) -> "Script Properties" -> Add script property
//        Property: SERPER_API_KEY        Value: (paste your key)      -> Save.
//
//  ---- C. Paste the code ----
//  4. Find your existing   function doPost(e) {   (there must be only ONE doPost).
//  5. Paste the block between "BEGIN imageSearch" and "END imageSearch" on the first lines INSIDE doPost
//     (above or below your getImage / delete blocks - order does not matter, just before your upload code).
//  6. Paste the small function  authorizeImageSearch()  anywhere OUTSIDE doPost (e.g. at the very bottom).
//  7. Save (disk icon).
//
//  ---- D. Give permission (once) ----
//  8. In the function dropdown at the top choose  authorizeImageSearch  -> click Run -> "Review permissions"
//     -> choose your account -> Advanced -> Go to project (unsafe) -> Allow.
//     (Needed because the script now contacts an external service.)
//
//  ---- E. Deploy ----
//  9. Deploy -> Manage deployments -> pencil icon -> Version: "New version" -> Deploy.
//     (Saving alone is NOT enough. Keep the SAME deployment so the URL does not change.)
// 10. In the app press Ctrl+Shift+R.
//
//  QUICK TEST (browser console while the app is open):
//     fetch(localStorage.getItem('driveScriptUrl'),{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},
//       body:JSON.stringify({action:'imageSearch',q:'Cosmoplast storage box'})}).then(r=>r.text()).then(t=>console.log(t.slice(0,300)))
//     -> {"status":"success","images":[...   = WORKING
//     -> message contains SERPER_API_KEY        = step 3 not done
//     -> not JSON / "split" error               = block not pasted or New version not deployed yet
//
//  Actual code to paste (copy only these lines):

  // ---------- BEGIN imageSearch ----------
  var __iq = null;
  try { __iq = JSON.parse(e.postData.contents); } catch (__x) {}
  if (__iq && __iq.action === 'imageSearch') {
    try {
      var __key = PropertiesService.getScriptProperties().getProperty('SERPER_API_KEY');
      if (!__key) {
        return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'SERPER_API_KEY is not set in Script Properties' }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      var __resp = UrlFetchApp.fetch('https://google.serper.dev/images', {
        method: 'post',
        contentType: 'application/json',
        headers: { 'X-API-KEY': __key },
        payload: JSON.stringify({ q: String(__iq.q || '').slice(0, 200), num: 8 }),
        muteHttpExceptions: true
      });
      var __code = __resp.getResponseCode();
      var __body = {};
      try { __body = JSON.parse(__resp.getContentText()); } catch (__p) {}
      if (__code !== 200) {
        return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Serper HTTP ' + __code + ' ' + (__body.message || '') }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      var __imgs = (__body.images || []).slice(0, 8).map(function (x) {
        return { t: x.thumbnailUrl || x.imageUrl || '', u: x.imageUrl || x.thumbnailUrl || '', s: x.source || x.domain || '' };
      });
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', images: __imgs }))
        .setMimeType(ContentService.MimeType.JSON);
    } catch (__err) {
      return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'imageSearch: ' + String(__err) }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }
  // ---------- END imageSearch ----------


// ---- paste OUTSIDE doPost (run it ONCE from the editor to grant permission, step 8) ----
function authorizeImageSearch() {
  UrlFetchApp.fetch('https://google.serper.dev', { muteHttpExceptions: true });
}
