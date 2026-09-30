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
