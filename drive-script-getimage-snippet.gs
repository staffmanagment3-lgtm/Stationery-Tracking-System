// =====================================================================================
//  GOOGLE APPS SCRIPT  -  add "getImage" so photos + signatures load in the app
// =====================================================================================
//  Console symptom without this:  "Drive getImage failed: ... reading 'split'"
//  (your OLD script answered the request with its photo-UPLOAD code, which has no "image").
//
//  1. Open your Apps Script project (the one whose URL is saved in the app: Admin Settings -> Drive Connector).
//  2. Find your existing   function doPost(e) {   (there must be only ONE doPost in the project).
//  3. Paste the block between "BEGIN getImage" and "END getImage" on the VERY FIRST lines INSIDE doPost,
//     right after   function doPost(e) {   and before your existing code.
//     The names used here (__req, __blob, __dataUrl) are unique, so they cannot clash with your own variables.
//  4. Click Save (disk icon).
//  5. Deploy -> Manage deployments -> pencil icon -> Version: "New version" -> Deploy.
//     (Saving alone is NOT enough. Keep the SAME deployment so the URL does not change.)
//  6. In the app press Ctrl+Shift+R.
//
//  Your doPost should look like this:
//
//     function doPost(e) {
//       // ---------- BEGIN getImage ----------
//       var __req = null;
//       try { __req = JSON.parse(e.postData.contents); } catch (__x) {}
//       if (__req && __req.action === 'getImage') {
//         try {
//           var __blob = DriveApp.getFileById(__req.fileId).getBlob();
//           var __dataUrl = 'data:' + __blob.getContentType() + ';base64,' + Utilities.base64Encode(__blob.getBytes());
//           return ContentService.createTextOutput(JSON.stringify({ status: 'success', data: __dataUrl }))
//             .setMimeType(ContentService.MimeType.JSON);
//         } catch (__err) {
//           return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'getImage: ' + String(__err) }))
//             .setMimeType(ContentService.MimeType.JSON);
//         }
//       }
//       // ---------- END getImage ----------
//
//       ... your existing doPost code continues here, unchanged ...
//     }
//
//  QUICK TEST (browser console while the app is open; replace FILE_ID with the id from any photo URL):
//     fetch(localStorage.getItem('driveScriptUrl'),{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},
//       body:JSON.stringify({action:'getImage',fileId:'FILE_ID'})}).then(r=>r.text()).then(t=>console.log(t.slice(0,150)))
//     -> {"status":"success","data":"data:image/...   = WORKING
//     -> message contains "split"                       = block not added / new version not deployed yet
//     -> "getImage: Exception: ..."                     = script works, but cannot open that file (read the message)
//
//  Actual code to paste (copy only these lines):

  // ---------- BEGIN getImage ----------
  var __req = null;
  try { __req = JSON.parse(e.postData.contents); } catch (__x) {}
  if (__req && __req.action === 'getImage') {
    try {
      var __blob = DriveApp.getFileById(__req.fileId).getBlob();
      var __dataUrl = 'data:' + __blob.getContentType() + ';base64,' + Utilities.base64Encode(__blob.getBytes());
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', data: __dataUrl }))
        .setMimeType(ContentService.MimeType.JSON);
    } catch (__err) {
      return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'getImage: ' + String(__err) }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }
  // ---------- END getImage ----------
