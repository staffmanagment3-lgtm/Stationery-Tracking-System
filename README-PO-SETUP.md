# Purchase Orders module (Admin only) - setup

Existing code (app.js, style.css, sw.js, functions ...) ko KOI change nahi. Sirf 2 nayi files + index.html me 4 chhoti lines.

## 1. Files upload karo (same folder jisme index.html hai)
- `po-module.js`   (new)
- `po-module.css`  (new)
- `index.html`     (updated - sirf 4 additions: css link, drawer button, tab container, script tag)

Phir ek baar Ctrl+Shift+R.

## 2. Firebase Realtime Database Rules (zaroori)
Do NAYE nodes hain: `po_orders` aur `po_files`. Inko bhi wahi read/write rule do jo `orders` / `inventory` ko hai.
(Rules me bas `po_orders` aur `po_files` ka block add karke **Publish** karo. Bina iske tab me "Cannot read Purchase Orders" dikhega.)

## 3. Kaise kaam karta hai
1. Admin menu -> **🧾 Purchase Orders (Excel)** -> **Upload Excel**.
2. Sheet / header row / Brand / Item / Quantity columns auto-detect hote hain (galat ho to dropdown se badlo) -> **Create Order Form**.
3. Ek-ek item aata hai: quantity likho -> *Add & Next*, ya *Not needed* (skip). Beech me band karo to progress save rehta hai (kisi bhi phone se continue).
4. **Review -> Submit**: original Excel ke khali Quantity boxes bhar kar file milti hai -> Download ya Share (WhatsApp / Email).
5. Delivery aane par item pe **＋ Receive** -> kitna aaya + date. Pending apne aap dikhta hai (Partial / Done / Extra). Galat entry ho to History se Remove.
6. Sab aa jaye -> **Complete & Remove**: pehle final report Excel download (optional), phir order + file Firebase se delete.

## Notes
- Original Excel `po_files` me base64 me rehti hai (<= 3.5 MB), complete hone par delete ho jati hai. Bigger file ho to clean Excel generate hoti hai.
- Sirf admin ko dikhta hai (button admin menu ke andar hai).
- Hatana ho to: index.html ki 4 lines hata do aur 2 files delete kar do - app pehle jaisa.

---
## v1.1.0
- **⬇ Excel** button ab har screen par: order list card, form fill screen, review screen, tracking screen. Original Excel ke same format me Quantity column bhara hua milta hai (submit karna zaroori nahi).
- **Item picture box**: form me har item ke upar online picture (Openverse + Wikimedia Commons, free, API key nahi). 6 tak pictures, thumbnail tap karke badal sakte ho. Match na ho to **🔍 Google Images** link. Pictures is device me cache hoti hain (dubara net nahi lagta).
- Dark theme me item naam / quantity box light-on-white dikh raha tha - fix.
- Upload: `po-module.js`, `po-module.css`, `index.html` (version 1.1.0) phir Ctrl+Shift+R. Firebase rules me koi naya change nahi.

---
## v1.2.0 - Real product pictures (Google Images)
Pehle wali free sources (Openverse/Wikimedia) galat pictures de rahi thi, isliye hata di. Ab pictures Google Images se aati hain
(Serper.dev ke through, free 2,500 searches, credit card nahi). Aapki existing Apps Script me ek block add karna hai:
1. https://serper.dev par sign up -> API key copy karo.
2. Apps Script -> Project Settings -> Script Properties -> `SERPER_API_KEY` = (key).
3. `drive-script-imagesearch-snippet.gs` kholo, usme likhe steps follow karo (block doPost ke andar paste, `authorizeImageSearch` ek baar Run, Deploy -> New version).
4. Upload: `po-module.js`, `po-module.css`, `index.html` (v1.2.0) -> Ctrl+Shift+R.
Key browser me kabhi nahi dikhti (script ke andar rehti hai). Ek item ek baar search hota hai, phir device me cache.
