// REQUIRED - photos + signatures load / reload / receipt PDF all use this.
// Google Drive blocks direct image links (403 / CORS). This block lets the app fetch the picture
// THROUGH your Apps Script instead (works even when the file is not public).
//
// !!! IMPORTANT: your Apps Script project must contain exactly ONE  function doPost(e)  !!!
// Do NOT paste this whole function as a second doPost (the last one silently wins and your photo
// UPLOAD stops working). Copy ONLY the part between "getImage block" and "end getImage block"
// and paste it INSIDE your existing doPost(e), at the very top, right after the line that parses
// the request (var data = ... JSON.parse(e.postData.contents) ...). If your code names that variable
// something else (e.g. body, payload, req), use that name instead of "data" below.
//
// THEN: Deploy -> Manage deployments -> pencil icon -> Version: "New version" -> Deploy.
// (Same deployment, so the URL does not change. If you only press Save, the app keeps using the OLD version.)
//
// QUICK TEST (browser console while the app is open, replace FILE_ID with any photo's Drive id):
//   fetch(localStorage.getItem('driveScriptUrl'),{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},
//     body:JSON.stringify({action:'getImage',fileId:'FILE_ID'})}).then(r=>r.text()).then(t=>console.log(t.slice(0,200)))
//   -> {"status":"success","data":"data:image/..."}  = working
//   -> HTML text / "<!DOCTYPE"                       = new version NOT deployed yet
//   -> {"status":"error","message":"..."}           = script runs, but cannot open that file (read the message)

function doPost(e) {
  var data = {};
  try { data = JSON.parse(e.postData.contents); } catch (err) {}

  // ---- getImage block (paste this) ----
  if (data.action === 'getImage') {
    try {
      var blob = DriveApp.getFileById(data.fileId).getBlob();
      var dataUrl = 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes());
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', data: dataUrl }))
        .setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: String(err) }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }
  // ---- end getImage block ----

  // ---- 'delete' block from drive-script-delete-snippet.gs goes here ----
  // ---- your existing upload code continues here (unchanged) ----
}
