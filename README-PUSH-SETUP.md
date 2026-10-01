# Push notifications (app band ho tab bhi) - setup

Browser/PWA ko app band hone par notification bhejne ke liye ek SERVER chahiye. Ye kaam
`functions/index.js` (Firebase Cloud Function) karta hai.

1. Firebase Console -> project `stationery-control-system` -> Upgrade to **Blaze** plan (Functions ke liye zaroori; chhote school use me cost almost 0).
2. PC par: `npm i -g firebase-tools` then `firebase login`
3. Is folder me: `cd functions && npm install && cd ..`
4. `firebase deploy --only functions`
5. Realtime Database Rules me `fcm_tokens` ko login ke baad write allow hona chahiye (jaise `orders`/`users` ka rule hai).
6. Sab files (index.html, app.js, style.css, sw.js, firebase-messaging-sw.js, login-waterdrop.css, manifest.json) hosting par upload karein.
7. Har user ek baar login karke "Enable Notifications" dabaye (ya login ke baad aane wala banner).

iPhone: Safari -> Share -> Add to Home Screen, phir Home Screen icon se app kholo (iOS 16.4+), tab hi push milega.
`OneSignalSDKWorker.js` ab use nahi ho raha - delete kar sakte hain.


---
## v2.1.0 - Deleted Items History + Drive photo delete (extra setup)

1. **Realtime Database Rules**: naya node `inventory_history` ko login ke baad read/write allow karo (jaise `inventory` ka rule hai). Bina iske product delete cancel ho jayega (history save nahi hui to delete nahi hota - data safe rehta hai).
2. **Google Drive photo delete**: apni Apps Script ke `doPost(e)` me `drive-script-delete-snippet.gs` ka code sabse upar paste karo, phir *Deploy -> Manage deployments -> New version*. Iske bina Realtime DB se photo delete ho jati hai, lekin Drive file trash nahi hoti (app warning dikhayega).
3. Sab files dobara hosting par upload karo (`index.html, app.js, style.css, sw.js`). Cache version `2.1.0` hai, isliye har device apne aap update ho jayega.


---
## v2.2.0 - Professional Voucher, Print/Download in History, Advanced Notification Center

1. Sab files dobara hosting par upload karo: `index.html, app.js, style.css, sw.js` (cache version `2.2.0`, devices apne aap update honge).
2. **Stock Balance (Original)**: ab handover ke time order me `stockBefore / stockAfter / issuedQty` save hota hai, isliye voucher me hamesha original stock dikhta hai.
   Purane (pehle ke) orders me ye data nahi hota, wahan voucher `≈ (current + issued)` dikhata hai.
3. **Signature / Photo PDF me**: app pehle images ko embed karti hai. Agar phir bhi koi Drive photo browser block kare, to OPTIONAL
   `drive-script-getimage-snippet.gs` apni Apps Script ke `doPost(e)` me paste karke *New version* deploy karo.
4. Cloud Function / Firebase rules me koi change nahi hai.


---
## v2.3.0 - Stock fix, Staff edit/search/designation, Announcements popup, Saved signature, AI photo background

1. Upload ALL of: `index.html, app.js, style.css, sw.js, school-logo.png` (new file - cropped logo for the blue header bar).
2. **Realtime Database Rules** - allow read/write after login for two NEW nodes (same as `orders`/`users`):
   `announcements` (admin announcements popup) and `user_signatures` (saved signature of each staff member).
3. **Stock bug (70 instead of 80) - fixed in code**: the app used to deduct stock a SECOND time for completed orders when it back-filled the Audit Ledger. Now the audit only logs.
   Deleting a batch now also recalculates the product total.
   **One-time repair of already-wrong data**: Master Inventory -> open the product -> batch row -> **Edit** -> type the correct quantity (e.g. 80). Totals update everywhere.
4. Staff Directory: new `designation` field (Teacher, Principal, Vice Principal ...). Old users without it show "Teacher".
5. Photo background removal uses the free @imgly/background-removal library from the CDN (internet needed; first use downloads the AI model, so it can take ~1 minute). If it fails the original photo is used.


---
## v2.3.1 - Photos / signatures not loading (IMPORTANT)

Google Drive now blocks direct image links (403 / CORS in the browser console). Fix:
1. Paste the `getImage` block from `drive-script-getimage-snippet.gs` at the top of `doPost(e)` in your Apps Script, then **Deploy -> Manage deployments -> New version** (same deployment, URL stays the same).
2. Upload `app.js, index.html, sw.js` again and hard-refresh (Ctrl+Shift+R).
3. Pictures that fail to load now fall back to the script automatically, are saved on the device (so they load only once) and also appear in Receipt PDF / Print.
   If a picture still shows the spinner, tap it once to retry.


---
## v2.3.2 - Announcements permission, photo loading diagnostics

1. Upload: `app.js, index.html, sw.js` (only these 3 changed). Cache version `2.3.2`; hard refresh once (Ctrl+Shift+R).
2. **Announcement "PERMISSION_DENIED"**: this is a Firebase rules problem, not an app bug. Add the `announcements` rule in Firebase Console -> Realtime Database -> Rules -> Publish (see `firebase-rules-add.txt`). Same for `user_signatures`.
3. **Photos**: the app now stops waiting after 30 seconds and shows the REAL reason in a red message (script not deployed / file cannot be opened / no internet). Follow `drive-script-getimage-snippet.gs` (paste the block INSIDE the one existing `doPost`, then Deploy -> New version).
4. **Stock showing 70 instead of 80**: the double-deduct bug is already fixed in the code (v2.3.0). Quantity that was already saved wrong stays wrong until corrected once: Admin -> Master Inventory -> product -> batch -> **Edit** -> type 80. Totals everywhere update automatically.

