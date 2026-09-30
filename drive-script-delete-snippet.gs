// Paste at the TOP of your existing doPost(e) in the Google Apps Script, then redeploy (New version).
// Existing upload code stays exactly as it is below this block.
function doPost(e) {
  var data = {};
  try { data = JSON.parse(e.postData.contents); } catch (err) {}

  if (data.action === 'delete') {
    try {
      DriveApp.getFileById(data.fileId).setTrashed(true);   // moves the photo to Drive trash
      return ContentService.createTextOutput(JSON.stringify({ status: 'success' }))
        .setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: String(err) }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  // ---- your existing upload code continues here (unchanged) ----
}
