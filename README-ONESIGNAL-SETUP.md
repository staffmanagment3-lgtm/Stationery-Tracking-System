# FCM -> OneSignal migration (v2.5.0)

## A) GitHub me upload (sirf ye files)
Replace/upload: `app.js`, `sw.js`, `OneSignalSDKWorker.js`, `firebase-messaging-sw.js`
Naya folder: `functions/` (andar `index.js` aur `package.json`)
Purani root wali `index.js` aur `package.json` delete kar do (ab functions/ folder me hain).
`index.html`, `style.css`, `po-module.*`, `manifest.json` me koi change nahi.

## B) OneSignal dashboard (phone browser me ho jayega)
1. onesignal.com -> New App -> **Web** -> Typical Site.
2. Site URL = jahan app host hai (GitHub Pages ho to poora link, e.g. `https://username.github.io/repo-name/`). Auto Resubscribe ON.
3. Settings -> Keys & IDs se **App ID** aur **REST API Key** copy karo.
4. **App ID** ko 2 jagah paste karo: `app.js` (line `ONESIGNAL_APP_ID = ...`) aur `functions/index.js` (`ONESIGNAL_APP_ID`).

## C) Cloud Function deploy (laptop ke bina: Google Cloud Shell)
1. console.cloud.google.com kholo (project `stationery-control-system`) -> upar `>_` Cloud Shell icon.
2. Commands (apna repo link lagao):
```
git clone https://github.com/USERNAME/REPO.git && cd REPO
npm i -g firebase-tools
firebase login --no-localhost
firebase functions:secrets:set ONESIGNAL_API_KEY --project stationery-control-system
(REST API Key paste karo, Enter)
cd functions && npm install && cd ..
firebase deploy --only functions --project stationery-control-system
```
Blaze plan pehle se zaroori tha (FCM ke time se). Realtime Database rules me koi change nahi (wahi `fcm_tokens` node use hota hai).

## D) Test
Har user: login -> **Enable Notifications** -> Allow. Phir teacher se order submit karo, app band karke admin phone check karo.
iPhone: Safari -> Add to Home Screen -> Home Screen icon se kholo (iOS 16.4+).

## Kaun si notification kisko (pehle jaisi hi)
- Order submit: Admin ko "New Order", Teacher ko "Order Submitted"
- Approved/Ready: Teacher ko "Your Order is Ready" (pickup location ke saath)
- Handover done: Teacher + Admin ko "Handover Confirmed"
App khula ho to in-app banner + bell list (pehle jaisa), band ho to phone notification.
