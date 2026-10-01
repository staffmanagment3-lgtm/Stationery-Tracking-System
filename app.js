// Firebase SDK imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getDatabase, ref, get, child, set, push, onValue, update, remove } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-analytics.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging.js";

// Define Current App Version
const APP_VERSION = "2.3.3";

// ==================== LOGIN SECURITY: RATE LIMITING (v1.8.87) ====================
// Locks the login form for a short cooldown after repeated failed attempts.
// Purely additive — does not touch any existing auth/session/drive logic.
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MS = 2 * 60 * 1000; // 2 minutes

window.checkLoginLockout = function() {
    const lockUntil = parseInt(localStorage.getItem('login_lock_until') || '0', 10);
    const remainingMs = lockUntil - Date.now();
    if (remainingMs > 0) {
        return Math.ceil(remainingMs / 1000);
    }
    if (lockUntil) {
        localStorage.removeItem('login_lock_until');
        localStorage.removeItem('login_failed_attempts');
    }
    return 0;
};

window.registerFailedLoginAttempt = function() {
    const attempts = (parseInt(localStorage.getItem('login_failed_attempts') || '0', 10)) + 1;
    if (attempts >= LOGIN_MAX_ATTEMPTS) {
        localStorage.setItem('login_lock_until', String(Date.now() + LOGIN_LOCKOUT_MS));
        localStorage.setItem('login_failed_attempts', '0');
        return LOGIN_LOCKOUT_MS / 1000;
    }
    localStorage.setItem('login_failed_attempts', String(attempts));
    return 0;
};

window.clearLoginAttempts = function() {
    localStorage.removeItem('login_failed_attempts');
    localStorage.removeItem('login_lock_until');
};

// ==================== IDLE SESSION TIMEOUT (v1.8.87) ====================
// Auto-logs out an inactive user after a period of no interaction, for security.
// Purely additive — reuses existing session-clearing keys, does not alter login/drive logic.
const IDLE_SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
let idleSessionTimer = null;

window.startIdleSessionTimer = function() {
    clearTimeout(idleSessionTimer);
    idleSessionTimer = setTimeout(window.silentIdleLogout, IDLE_SESSION_TIMEOUT_MS);
};

window.silentIdleLogout = function() {
    if (typeof currentUser === 'undefined' || !currentUser) return;
    console.log("Session expired due to inactivity.");
    try {
        localStorage.removeItem('stationery_user_adec');
        localStorage.removeItem('currentUserPass');
        localStorage.removeItem('currentUserRole');
        localStorage.removeItem('currentUserName');
        localStorage.removeItem('teacherStationeryCart');
        sessionStorage.removeItem('isAdminAuthenticated');
        sessionStorage.clear();
        if (typeof cleanupListeners === 'function') cleanupListeners();
    } catch (e) { console.warn("Idle logout cleanup warning:", e); }
    alert("⏱️ Session expired due to inactivity. Please login again.\n⏱️ انتهت الجلسة بسبب عدم النشاط. الرجاء تسجيل الدخول مرة أخرى.");
    window.location.reload();
};

['mousemove', 'keydown', 'click', 'touchstart', 'scroll'].forEach(function(evt) {
    document.addEventListener(evt, function() {
        if (typeof currentUser !== 'undefined' && currentUser) {
            window.startIdleSessionTimer();
        }
    }, { passive: true });
});

// Global Full-Screen Loader Helpers
window.showGlobalLoader = function(message = "Processing, please wait...") {
    const loader = document.getElementById('globalLoader');
    const textEl = document.getElementById('globalLoaderText');
    if (textEl) textEl.textContent = message;
    if (loader) {
        loader.classList.remove('d-none');
        loader.style.display = 'flex';
    }
};

window.hideGlobalLoader = function() {
    const loader = document.getElementById('globalLoader');
    if (loader) {
        loader.classList.add('d-none');
        loader.style.display = 'none';
    }
};

// ==================== CLEAN TABLE SIGNATURE RENDERER v1.8.85 ====================
window.renderTableSignature = function(signData) {
    if (!signData || typeof signData !== 'string') {
        return `<span class="badge bg-light text-secondary">N/A</span>`;
    }
    const cleanData = signData.trim();
    if (!cleanData ||
        cleanData === 'N/A' ||
        cleanData === 'null' ||
        cleanData === 'undefined' ||
        cleanData === 'Teacher Sign' ||
        cleanData === 'Issuer Sign' ||
        cleanData.length < 20) {
        return `<span class="badge bg-light text-secondary">N/A</span>`;
    }

    const isValidSign = cleanData.startsWith('data:image/') ||
                        cleanData.startsWith('http://') ||
                        cleanData.startsWith('https://');

    if (!isValidSign) {
        return `<span class="badge bg-light text-secondary">N/A</span>`;
    }

    return `<img src="${cleanData}" alt="Sign" class="table-sign-img" style="max-height: 35px; max-width: 90px; object-fit: contain;">`;
};

// Complete 27 Category List
const ALL_STATIONERY_CATEGORIES = [
    "Writing & Marking",
    "Paper & Coloured Paper",
    "Sticky Notes & Notepads",
    "Boards & Display Boards",
    "Classroom Display & Decoration",
    "Files & Folders",
    "Dividers & Labels",
    "Binding & Binding Supplies",
    "Adhesives & Glue",
    "Tapes & Tape Accessories",
    "Clips & Fasteners",
    "Stapling & Punching",
    "Cutting Tools",
    "Rulers & Measuring Tools",
    "Envelopes & Mailing",
    "Lamination",
    "Office Equipment",
    "Art & Craft Supplies",
    "Electrical & Power",
    "HDMI & Network Cables",
    "Computer & IT Accessories",
    "Batteries",
    "Whiteboard Accessories",
    "Storage & Organization",
    "Shredding & Waste Management",
    "Certificate & Document Supplies",
    "Identification & Lanyards",
    "Others"
];
window.ALL_STATIONERY_CATEGORIES = ALL_STATIONERY_CATEGORIES;

// Category to Actual Stationery Products Master Mapping
const STATIONERY_CATEGORY_ITEMS_MASTER = {
    "Writing & Marking": [
        { name: "Ball Pen - (Blue)" },
        { name: "Ball Pen - (Black)" },
        { name: "Ball Pen - (Red)" },
        { name: "Ball Pen - (Green)" },
        { name: "Uniball Eye Micro Roller UB-157 (Blue)" },
        { name: "Uniball Eye Micro Roller UB-157 (Black)" },
        { name: "Uniball Eye Micro Roller UB-157 (Red)" },
        { name: "Uniball Eye Micro Roller UB-157 (Green)" },
        { name: "Highlighter" },
        { name: "Pencils Staedtler HB" },
        { name: "Felt Tip Pens" },
        { name: "Correction Pen" },
        { name: "Whiteboard Markers - Blue" },
        { name: "Whiteboard Markers - Black" },
        { name: "Whiteboard Markers - Red" },
        { name: "Whiteboard Markers - Green" },
        { name: "Permanenet Markers - (Black, Blue, Green, Red)" },
        { name: "Chalk White" },
        { name: "Chalk Colored" },
        { name: "Color Pencils Faber Castell 12 Colors" },
        { name: "Faber Castell Crayons Medium Size" }
    ],
    "Paper & Coloured Paper": [
        { name: "A4 Paper - 80 GSM" },
        { name: "A4 Paper - 100 GSM" },
        { name: "A4 Paper - 80 GSM (Light Pink, Light Green, Light Blue, Light Yellow)" },
        { name: "A4 Paper - 160/180 GSM (White, Pink, Blue, Yellow)" },
        { name: "A4 Paper - 160 /180GSM (Muli Colors)" },
        { name: "A3 Paper- 80 Gsm" },
        { name: "Bristol Card 70 X 100 x 180 GSM (Multi Colors)" },
        { name: "Bristol Card - 70 x 100 - 180 GSM - Black" }
    ],
    "Sticky Notes & Notepads": [
        { name: "Sticky Notes 3x3 Yellow" },
        { name: "Sticky Notes 3x3 Neon Colors" },
        { name: "Sticky Notes 2x3 Yellow" },
        { name: "Page Markers / Index Flags" },
        { name: "Cube Sticky Notes 4x4" },
        { name: "Spiral Notepad A5" },
        { name: "Writing Pad A4" },
        { name: "Executive Notepad" }
    ],
    "Boards & Display Boards": [
        { name: "Cork Board 90x60cm" },
        { name: "Cork Board 120x90cm" },
        { name: "Magnetic Whiteboard 90x60cm" },
        { name: "Magnetic Whiteboard 120x90cm" },
        { name: "Felt Notice Board Green 90x60cm" },
        { name: "Felt Notice Board Blue 120x90cm" },
        { name: "Flipchart Easel Stand" }
    ],
    "Classroom Display & Decoration": [
        { name: "Classroom Border Rolls Assorted" },
        { name: "Display Paper Rolls (Red, Blue, Green, Yellow)" },
        { name: "Lettering Sets for Displays" },
        { name: "Decorative Cutouts & Shapes" },
        { name: "Poster Rolls 80GSM Assorted" },
        { name: "Wall Mounting Putty / Tack" }
    ],
    "Files & Folders": [
        { name: "Ring Binder A4 2-Ring" },
        { name: "Lever Arch File A4 75mm" },
        { name: "Clear Sleeve Folder 20 Pockets" },
        { name: "Clear Sleeve Folder 40 Pockets" },
        { name: "Document Wallet Button Folder A4" },
        { name: "Expanding File 12 Pockets" },
        { name: "Report Cover Folder Clear Front" },
        { name: "Clip Folder A4" },
        { name: "Suspension Files A4" }
    ],
    "Dividers & Labels": [
        { name: "A4 Subject Dividers 1-5 Tab" },
        { name: "A4 Subject Dividers 1-10 Tab" },
        { name: "A4 Subject Dividers Jan-Dec" },
        { name: "Address Labels 21 per Sheet A4" },
        { name: "Multipurpose Round Labels" },
        { name: "Name Badge Labels Self-Adhesive" },
        { name: "Color Coding Dots Assorted" }
    ],
    "Binding & Binding Supplies": [
        { name: "Plastic Binding Combs 8mm (Pack of 100)" },
        { name: "Plastic Binding Combs 10mm (Pack of 100)" },
        { name: "Plastic Binding Combs 12mm (Pack of 100)" },
        { name: "Binding Covers Clear PVC A4" },
        { name: "Binding Covers Leathergrain Back A4" },
        { name: "Thermal Binding Covers A4" },
        { name: "Wire Binding Spines 3:1 Pitch" }
    ],
    "Adhesives & Glue": [
        { name: "Glue Stick 21g UHU/Pritt" },
        { name: "Glue Stick 40g UHU/Pritt" },
        { name: "Liquid PVA School Glue 500ml" },
        { name: "Super Glue Precision 3g" },
        { name: "Wood Glue D3 250ml" },
        { name: "Adhesive Putty / Blu-Tack 75g" },
        { name: "Glue Dots Roll" }
    ],
    "Tapes & Tape Accessories": [
        { name: "Clear Stationery Tape 18mm x 33m" },
        { name: "Clear Packing Tape 48mm x 50m" },
        { name: "Brown Packing Tape 48mm x 50m" },
        { name: "Masking Tape 24mm x 50m" },
        { name: "Double-Sided Foam Tape 18mm" },
        { name: "Double-Sided Tissue Tape 12mm" },
        { name: "Heavy Duty Desktop Tape Dispenser" },
        { name: "Packing Tape Hand Dispenser" }
    ],
    "Clips & Fasteners": [
        { name: "Paper Clips 33mm Plain (Box of 100)" },
        { name: "Paper Clips 50mm Jumbo (Box of 100)" },
        { name: "Binder Clips 19mm Small (Box of 12)" },
        { name: "Binder Clips 25mm Medium (Box of 12)" },
        { name: "Binder Clips 32mm Large (Box of 12)" },
        { name: "Binder Clips 51mm Extra Large (Box of 12)" },
        { name: "Treasury Tags 25mm (Pack of 100)" },
        { name: "Push Pins / Map Tacks Assorted (Box of 100)" }
    ],
    "Stapling & Punching": [
        { name: "Desktop Stapler 24/6 No.10" },
        { name: "Heavy Duty Stapler 100 Sheet Capacity" },
        { name: "Staples 24/6 Standard (Box of 5000)" },
        { name: "Staples 26/6 Premium (Box of 5000)" },
        { name: "Heavy Duty Staples 23/13 (Box of 1000)" },
        { name: "Staple Remover Claw Type" },
        { name: "2-Hole Paper Punch 20 Sheet" },
        { name: "Heavy Duty 2-Hole Punch 65 Sheet" },
        { name: "4-Hole Punch A4 Standard" }
    ],
    "Cutting Tools": [
        { name: "Scissors 7.5\"" },
        { name: "Scissors small" },
        { name: "3SCR Student Scissors Blister Pack 3 Pieces" },
        { name: "Scissors with safety features for Cycle 1 students" },
        { name: "Paper Knife Smaller" },
        { name: "Paper knife Big Size" },
        { name: "A3 Metal Base Paper Cutter" },
        { name: "PAPER CUTTER A3" },
        { name: "PAPER CUTTER A4" },
        { name: "Cutting Mat 600x450mm" }
    ],
    "Rulers & Measuring Tools": [
        { name: "Plastic Ruler 30cm / 12 Inch Clear" },
        { name: "Plastic Ruler 15cm / 6 Inch Clear" },
        { name: "Aluminium Safety Ruler 30cm" },
        { name: "Stainless Steel Ruler 60cm / 24 Inch" },
        { name: "Geometry Set 8-Piece Metal Case" },
        { name: "Fiberglass Measuring Tape 15m" },
        { name: "Chalkboard Compass & Protractor Set" }
    ],
    "Envelopes & Mailing": [
        { name: "Envelope DL White Self-Seal (Box of 500)" },
        { name: "Envelope C5 White Self-Seal (Box of 250)" },
        { name: "Envelope C4 Brown Manila Board-Backed (Box of 125)" },
        { name: "Envelope C4 White Self-Seal (Box of 250)" },
        { name: "Bubble Padded Envelope Size 1 DL" },
        { name: "Bubble Padded Envelope Size 4 A4" },
        { name: "Postal Mailing Tubes A1 Size" }
    ],
    "Lamination": [
        { name: "Laminating Pouches A4 80 Micron (Pack of 100)" },
        { name: "Laminating Pouches A4 125 Micron (Pack of 100)" },
        { name: "Laminating Pouches A3 80 Micron (Pack of 100)" },
        { name: "Laminating Pouches ID Card Size 100 Micron" },
        { name: "A3 Heavy Duty Laminator Machine" }
    ],
    "Office Equipment": [
        { name: "Desktop Scientific Calculator 12-Digit" },
        { name: "Cross-Cut Paper Shredder 10-Sheet" },
        { name: "Electric Heavy Duty Pencil Sharpener" },
        { name: "Thermal Label Printer USB" },
        { name: "Cash Box 12 Inch Metal Key Lock" }
    ],
    "Art & Craft Supplies": [
        { name: "Acrylic Paint Set 12 Colors x 12ml" },
        { name: "Water Color Paint Set 24 Pan Palette" },
        { name: "Paint Brushes Assorted Synthetic Set of 6" },
        { name: "Modeling Clay 500g Non-Toxic" },
        { name: "Origami Paper Pack 15x15cm 100 Sheets" },
        { name: "Craft Glitter Shakers Pack of 6 Colors" },
        { name: "Craft Foam Sheets A4 Assorted Pack of 10" }
    ],
    "Electrical & Power": [
        { name: "Power Extension Socket 4-Way 3 Meter" },
        { name: "Power Extension Socket 6-Way 5 Meter" },
        { name: "Cable Reel Heavy Duty 15 Meter" },
        { name: "UK 3-Pin Plug Adapter 13A" },
        { name: "Universal Travel Adapter with USB" }
    ],
    "HDMI & Network Cables": [
        { name: "HDMI Cable High Speed 1.8 Meter" },
        { name: "HDMI Cable High Speed 3.0 Meter" },
        { name: "HDMI Cable High Speed 5.0 Meter" },
        { name: "CAT6 Ethernet Patch Network Cable 2M" },
        { name: "CAT6 Ethernet Patch Network Cable 5M" },
        { name: "VGA to HDMI Adapter Converter Cable" },
        { name: "DisplayPort to HDMI Adapter Cable" }
    ],
    "Computer & IT Accessories": [
        { name: "USB Wireless Mouse Optical" },
        { name: "USB Wired Ergonomic Keyboard" },
        { name: "USB Flash Drive 32GB 3.0" },
        { name: "USB Flash Drive 64GB 3.0" },
        { name: "USB 3.0 Multi-Port Hub 4-Port" },
        { name: "External Hard Drive 1TB USB 3.0" },
        { name: "Screen Cleaning Wipes Pack of 100" }
    ],
    "Batteries": [
        { name: "AA Alkaline Batteries 1.5V (Pack of 12)" },
        { name: "AAA Alkaline Batteries 1.5V (Pack of 12)" },
        { name: "9V Block Battery Alkaline (Pack of 2)" },
        { name: "C Size Batteries Alkaline (Pack of 4)" },
        { name: "D Size Batteries Alkaline (Pack of 4)" },
        { name: "CR2032 Lithium Coin Cell 3V (Pack of 5)" }
    ],
    "Whiteboard Accessories": [
        { name: "Whiteboard Eraser Magnetic Foam" },
        { name: "Whiteboard Cleaner Spray 250ml" },
        { name: "Whiteboard Cleaner Wipes Container of 100" },
        { name: "Magnetic Button Pins Assorted (Pack of 10)" },
        { name: "Whiteboard Tape Grid Lines Black 3mm" }
    ],
    "Storage & Organization": [
        { name: "Plastic Storage Box 24 Liter Clear" },
        { name: "Plastic Storage Box 42 Liter Clear" },
        { name: "Desktop Magazine Rack File Holder 3-Slot" },
        { name: "Desk Organizer Pen Stand Mesh Metal" },
        { name: "Drawer Organizer Tray 4-Compartment" }
    ],
    "Shredding & Waste Management": [
        { name: "Waste Paper Bin Mesh Metal 15 Liter" },
        { name: "Heavy Duty Trash Bags 50 Liter (Roll of 20)" },
        { name: "Shredder Oil Lubricant Sheets Pack of 12" },
        { name: "Shredder Waste Bags 50 Liter Pack of 50" }
    ],
    "Certificate & Document Supplies": [
        { name: "Certificate Paper Heavy Weight A4 Pack of 50" },
        { name: "Certificate Holders Leatherette Navy Blue" },
        { name: "Certificate Gold Foil Seals Pack of 100" },
        { name: "Document Presentation Folder A4 Premium" }
    ],
    "Identification & Lanyards": [
        { name: "Lanyard Flat Polyester Blue with Clip (Pack of 10)" },
        { name: "Lanyard Flat Polyester Red with Clip (Pack of 10)" },
        { name: "ID Card Badge Holder Clear Rigid Plastic A1" },
        { name: "ID Card Badge Holder Soft Vinyl Vertical" },
        { name: "Retractable Badge Reel Clip Black (Pack of 5)" }
    ]
};
window.STATIONERY_CATEGORY_ITEMS_MASTER = STATIONERY_CATEGORY_ITEMS_MASTER;

function assignCategoryToItem(item) {
    if (!item) return "Writing & Marking";
    if (item.category && item.category !== 'Other' && item.category.trim()) return item.category.trim();
    if (item.itemCategory && item.itemCategory !== 'Other' && item.itemCategory.trim()) return item.itemCategory.trim();

    const name = ((item.itemName || item.name || '') + ' ' + (item.description || '')).toLowerCase();

    if (/pen|pencil|marker|highlighter|correction|chalk|crayon|felt|sharpie/i.test(name)) return "Writing & Marking";
    if (/paper|a4|a3|coloured paper|gsm|register|sheet/i.test(name)) return "Paper & Coloured Paper";
    if (/sticky|notepad|post-it|pad|note/i.test(name)) return "Sticky Notes & Notepads";
    if (/board|display board|notice|cork/i.test(name)) return "Boards & Display Boards";
    if (/classroom|decoration|border|chart|banner/i.test(name)) return "Classroom Display & Decoration";
    if (/file|folder|binder|portfolio|ring/i.test(name)) return "Files & Folders";
    if (/divider|label|sticker|tag/i.test(name)) return "Dividers & Labels";
    if (/binding|comb|spiral|spine|cover/i.test(name)) return "Binding & Binding Supplies";
    if (/adhesive|glue|gum|stick|blu-tack/i.test(name)) return "Adhesives & Glue";
    if (/tape|dispenser|sellotape|masking/i.test(name)) return "Tapes & Tape Accessories";
    if (/clip|fastener|paperclip|binder clip|treasury/i.test(name)) return "Clips & Fasteners";
    if (/staple|stapler|punch|puncher|remover/i.test(name)) return "Stapling & Punching";
    if (/scissors|cutter|knife|mat|cutting/i.test(name)) return "Cutting Tools";
    if (/ruler|scale|measure|tape measure/i.test(name)) return "Rulers & Measuring Tools";
    if (/envelope|mailing|mail|padded/i.test(name)) return "Envelopes & Mailing";
    if (/lamination|laminating|pouch/i.test(name)) return "Lamination";
    if (/equipment|calculator|shredder|machine/i.test(name)) return "Office Equipment";
    if (/art|craft|paint|brush|glitter|clay/i.test(name)) return "Art & Craft Supplies";
    if (/electrical|power|extension|plug|socket/i.test(name)) return "Electrical & Power";
    if (/hdmi|network|cable|lan|ethernet|vga/i.test(name)) return "HDMI & Network Cables";
    if (/computer|mouse|keyboard|usb|it|adapter/i.test(name)) return "Computer & IT Accessories";
    if (/battery|batteries|aa|aaa|9v|cell/i.test(name)) return "Batteries";
    if (/whiteboard|eraser|cleaner|duster/i.test(name)) return "Whiteboard Accessories";
    if (/storage|organization|box|tray|organizer/i.test(name)) return "Storage & Organization";
    if (/shredding|waste|bin/i.test(name)) return "Shredding & Waste Management";
    if (/certificate|document|certificate holder/i.test(name)) return "Certificate & Document Supplies";
    if (/identification|lanyard|badge|holder|id/i.test(name)) return "Identification & Lanyards";

    return "Writing & Marking";
}
window.assignCategoryToItem = assignCategoryToItem;

window.isSystemReady = false;
setTimeout(() => {
    window.isSystemReady = true;
    console.log("⏱️ Automatic 3-Second Timeout Fallback: System marked Ready.");
}, 3000);

// ==================== CONSTANTS ====================
const PAGE_SIZE = 10;
const IMG_RETRY_LIMIT = 3;
const IMG_RETRY_BASE_MS = 1000;

const OFF_SVG = "<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23e0e0e0'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='%23757575' font-size='12' font-family='sans-serif'>No Image</text></svg>";
// Quotes/brackets are percent-encoded: this string is injected inside onerror="this.src='...'" attributes,
// and raw single quotes (xmlns='http://...') broke the JS there -> "Unexpected identifier 'http'".
const OFFLINE_PLACEHOLDER = "data:image/svg+xml;utf8," + OFF_SVG.replace(/50%'/g, "50%25'").replace(/'/g, '%27').replace(/</g, '%3C').replace(/>/g, '%3E');
const FALLBACK_IMG = OFFLINE_PLACEHOLDER;

// Firebase config
const firebaseConfig = {
    apiKey: "AIzaSyC34JvIlqAC0Rqb9wBIed3kNdvrEpy16P8",
    authDomain: "stationery-control-system.firebaseapp.com",
    databaseURL: "https://stationery-control-system-default-rtdb.firebaseio.com",
    projectId: "stationery-control-system",
    storageBucket: "stationery-control-system.firebasestorage.app",
    messagingSenderId: "342613102896",
    appId: "1:342613102896:web:5ddd185f3d2085661278f5",
    measurementId: "G-Y0J1GNVG1G"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const messaging = getMessaging(app);
try { getAnalytics(app); } catch (e) { console.warn("Analytics blocked"); }

// ==================== FIREBASE CLOUD MESSAGING (FCM) ====================

window.updateFcmUIStatus = function() {
    if (!('Notification' in window)) return;

    const btnAdmin = document.getElementById('enable-notifications-btn-admin');
    const btnTeacher = document.getElementById('enable-notifications-btn-teacher');
    const status = Notification.permission;

    let text = "🔔 Enable Notifications";
    let className = "drawer-item";

    if (status === 'granted') {
        text = "✅ Push Notifications Active";
        className = "drawer-item text-success fw-bold";
    } else if (status === 'denied') {
        text = "⚠️ Notifications Blocked";
        className = "drawer-item text-warning";
    }

    [btnAdmin, btnTeacher].forEach(btn => {
        if (btn) {
            btn.textContent = text;
            btn.className = className;
        }
    });
};

window.getPushServiceWorker = async function() {
    // ONE service worker (sw.js) handles both offline cache and push. Registering a second
    // worker on the same scope would replace this one.
    await navigator.serviceWorker.register(`./sw.js?v=${APP_VERSION}`);
    return await navigator.serviceWorker.ready;
};

const fcmSafeKey = (v) => String(v || 'GUEST').replace(/[.#$\[\]\/]/g, '_');

// Saves this device's push token under the logged-in user so the server can reach it
// even when the app is closed.
window.syncFcmToken = async function() {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return null;
    if (Notification.permission !== 'granted' || !currentUser) return null;

    const swReg = await window.getPushServiceWorker();
    const token = await getToken(messaging, { serviceWorkerRegistration: swReg });
    if (!token) return null;

    const uid = fcmSafeKey(currentUser.adecPassNumber || currentUser.uid);
    const role = String(currentUser.role || 'TEACHER').toUpperCase();

    await set(ref(db, `fcm_tokens/${uid}/${token}`), {
        role: role,
        name: currentUser.name || uid,
        updatedAt: new Date().toISOString(),
        device: (navigator.userAgent || '').slice(0, 120)
    });
    localStorage.setItem('fcm_token_current', token);
    localStorage.setItem('fcm_token_uid', uid);
    return token;
};

window.enableFcmNotifications = async function() {
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
        alert(isIOS && !standalone
            ? "On iPhone/iPad: tap Share → 'Add to Home Screen', then open the app from the Home Screen icon and tap Enable Notifications again."
            : "This browser does not support Web Push Notifications.");
        return;
    }

    if (Notification.permission === 'denied') {
        alert("⚠️ Notifications are blocked in your browser settings.\n\nTo enable notifications:\n1. Click the lock icon near the website URL bar (or App info → Notifications on the phone).\n2. Set Notifications to 'Allow'.\n3. Reload the app.");
        return;
    }

    try {
        const btnAdmin = document.getElementById('enable-notifications-btn-admin');
        const btnTeacher = document.getElementById('enable-notifications-btn-teacher');
        [btnAdmin, btnTeacher].forEach(b => { if (b) b.textContent = "⏳ Enabling..."; });

        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            const token = await window.syncFcmToken();
            if (token) showToast("🎉 Push Notifications Enabled Successfully!", "success");
            else showToast("⚠️ Could not retrieve notification token.", "error");
        } else {
            showToast("Notification permission was not granted.", "error");
        }
        const banner = document.getElementById('push-prompt-banner');
        if (banner) banner.remove();
        window.updateFcmUIStatus();
    } catch (err) {
        console.error("FCM Registration Error:", err);
        showToast("Notification error: " + err.message, "error");
        window.updateFcmUIStatus();
    }
};

// Called after every login: refresh token silently, or gently ask for permission.
window.initPushForSession = function() {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return;
    window.updateFcmUIStatus();
    if (Notification.permission === 'granted') {
        window.syncFcmToken().catch(e => console.warn('FCM token sync failed:', e));
        return;
    }
    if (Notification.permission === 'default' && !sessionStorage.getItem('push_banner_dismissed')) {
        showPushPromptBanner();
    }
};

function showPushPromptBanner() {
    if (document.getElementById('push-prompt-banner')) return;
    const b = document.createElement('div');
    b.id = 'push-prompt-banner';
    b.style.cssText = 'position:fixed;left:12px;right:12px;bottom:max(12px,env(safe-area-inset-bottom));z-index:3500;background:#0f172a;color:#fff;border-radius:14px;padding:12px 14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;box-shadow:0 10px 30px rgba(0,0,0,.35);font-size:14px;';
    b.innerHTML = '<span style="flex:1;min-width:200px">🔔 Turn on notifications to get order updates even when the app is closed.</span>' +
        '<button id="push-prompt-enable" style="border:0;border-radius:999px;padding:8px 16px;font-weight:700;background:#3b82f6;color:#fff">Enable</button>' +
        '<button id="push-prompt-later" style="border:0;border-radius:999px;padding:8px 14px;background:transparent;color:#cbd5e1">Later</button>';
    document.body.appendChild(b);
    document.getElementById('push-prompt-enable').onclick = () => window.enableFcmNotifications();
    document.getElementById('push-prompt-later').onclick = () => {
        sessionStorage.setItem('push_banner_dismissed', '1');
        b.remove();
    };
}

// App is open (foreground): show it in-app. When app is closed/hidden, sw.js shows the system notification.
try {
    onMessage(messaging, (payload) => {
        console.log("🔔 Foreground Push Message Received:", payload);
        const d = payload.data || {};
        const n = payload.notification || {};
        pushInAppNotification({
            key: d.eventKey,
            title: d.title || n.title || "Stationery Alert",
            body: d.body || n.body || "New update received"
        });
    });
} catch (e) {
    console.warn("FCM Foreground listener exception caught silently:", e);
}

// ==================== STATIONERY RAIN ANIMATION ====================

function getStationeryItemSize() {
    const screenWidth = window.innerWidth;
    if (screenWidth >= 1200) {
        // Large Desktop / PC Screens: 80px to 110px (Very clear & large)
        return Math.floor(Math.random() * 30) + 80;
    } else if (screenWidth >= 768) {
        // Tablets / Laptops: 55px to 75px
        return Math.floor(Math.random() * 20) + 55;
    } else {
        // Mobile Devices: 35px to 50px
        return Math.floor(Math.random() * 15) + 35;
    }
}
window.getStationeryItemSize = getStationeryItemSize;

window.initStationeryRain = function() {
    const container = document.getElementById('stationery-rain-container') || document.getElementById('rain');
    if (!container) return;

    const shapes = [
      ['s-pencil', 16, 64], ['s-pencil', 16, 64], ['s-pen', 14, 64], ['s-marker', 18, 56],
      ['s-ruler', 18, 64], ['s-eraser', 32, 20], ['s-clip', 14, 36], ['s-book', 28, 36], ['s-scissors', 30, 40]
    ];
    const count = window.innerWidth < 600 ? 14 : window.innerWidth < 1100 ? 22 : 32;
    const rnd = (a, b) => a + Math.random() * (b - a);

    container.innerHTML = '';

    for (let i = 0; i < count; i++) {
        const [id, w, h] = shapes[i % shapes.length];
        const scale = rnd(0.7, 1.3);
        const el = document.createElement('div');
        el.className = 'drop-item';
        el.style.left = rnd(0, 100) + '%';
        el.style.width = (w * scale) + 'px';
        el.style.height = (h * scale) + 'px';
        el.style.setProperty('--dur', rnd(7, 15) + 's');
        el.style.setProperty('--delay', '-' + rnd(0, 15) + 's');
        el.style.setProperty('--sway', rnd(-40, 40) + 'px');
        el.style.setProperty('--rot-start', rnd(-40, 40) + 'deg');
        el.style.setProperty('--spin', rnd(-180, 180) + 'deg');
        el.style.setProperty('--static-top', rnd(5, 90) + '%');
        el.innerHTML = '<svg><use href="#' + id + '"/></svg>';
        container.appendChild(el);
    }
};

window.addEventListener('resize', () => {
    const loginView = document.getElementById('login-view');
    if (loginView && loginView.style.display !== 'none' && !loginView.classList.contains('hidden')) {
        window.initStationeryRain();
    }
});

// ==================== IMAGE UTILITIES ====================
function isValidImageUrl(url) {
    if (!url) return false;
    const cleanUrl = String(url).trim().toLowerCase();
    return cleanUrl !== '' && cleanUrl !== 'undefined' && cleanUrl !== 'null' && cleanUrl !== '[object object]';
}

window.handleProductImageError = function(imgEl) {
    if (!imgEl) return;
    const tryN = parseInt(imgEl.dataset.try || '0', 10);
    const baseSrc = imgEl.getAttribute('data-src') || '';
    if (tryN < 2 && /(?:id=|\/d\/)([a-zA-Z0-9_-]{25,})/.test(baseSrc) && typeof getDirectDriveUrl === 'function') {
        imgEl.dataset.try = String(tryN + 1);
        imgEl.src = getDirectDriveUrl(baseSrc, tryN + 1);
        return;
    }
    imgEl.style.display = 'none';
    const container = imgEl.parentElement;
    if (!container) return;

    let retryBtn = container.querySelector('.img-retry-btn');
    if (!retryBtn) {
        retryBtn = document.createElement('button');
        retryBtn.className = 'img-retry-btn';
        retryBtn.type = 'button';
        retryBtn.setAttribute('aria-label', 'Tap to reload image');
        retryBtn.innerHTML = '⟳ Tap to reload';
        retryBtn.style.cssText = 'min-height: 44px; padding: 10px 18px; background-color: #2563eb; color: #ffffff; font-weight: bold; border: none; border-radius: 12px; cursor: pointer; z-index: 10; margin: auto; display: inline-flex; align-items: center; justify-content: center; font-size: 14px; box-shadow: 0 4px 12px rgba(37,99,235,0.3); transition: transform 0.15s ease;';

        retryBtn.onclick = function(e) {
            if (e) {
                e.stopPropagation();
                e.preventDefault();
            }
            retryBtn.style.display = 'none';
            imgEl.dataset.try = '0';
            imgEl.style.display = 'block';

            const origSrc = imgEl.getAttribute('data-src') || imgEl.src;
            if (origSrc) {
                const cleanSrc = origSrc.replace(/([?&])r=\d+/, '');
                const sep = cleanSrc.includes('?') ? '&' : '?';
                imgEl.src = cleanSrc + sep + 'r=' + Date.now();
            }
        };
        container.appendChild(retryBtn);
    } else {
        retryBtn.style.display = 'inline-flex';
    }
};

window.addEventListener('online', () => {
    console.log("🌐 Network online restored - retrying failed images after 3s...");
    setTimeout(() => {
        document.querySelectorAll('.img-retry-btn').forEach(btn => {
            if (btn && btn.style.display !== 'none') {
                btn.click();
            }
        });
    }, 3000);
});

window.createReloadableImgHtml = function(imgSrc, altText = "Image", customStyle = "", isThumb = true) {
    const validSrc = isValidImageUrl(imgSrc) ? imgSrc : FALLBACK_IMG;
    const styleAttr = customStyle || (isThumb ? "width: 40px; height: 40px; object-fit: contain; border-radius: 4px;" : "max-height: 60px; object-fit: contain;");
    return `<img src="${validSrc}" alt="${escapeHtml(altText || 'Image')}" class="audit-thumb" data-url="${validSrc}" style="${styleAttr}" loading="lazy" onerror="this.onerror=null; this.src='${FALLBACK_IMG}';">`;
};

function getItemImageHtml(imageUrl) {
    const src = isValidImageUrl(imageUrl) ? imageUrl : OFFLINE_PLACEHOLDER;
    return `<img src="${src}"
                 alt="Item Image"
                 class="img-thumbnail"
                 style="width: 50px; height: 50px; object-fit: cover; border-radius: 6px;"
                 loading="lazy"
                 onerror="this.onerror=null; this.src='${OFFLINE_PLACEHOLDER}';" />`;
}

function getCatalogCardImageHtml(item) {
    const imgUrl = item.imageUrl || item.image || item.photoUrl;
    const validSrc = isValidImageUrl(imgUrl) ? imgUrl : OFFLINE_PLACEHOLDER;
    return `
        <div class="card-img-wrapper" style="width: 100%; height: 130px; background: #f8f9fa; display: flex; align-items: center; justify-content: center; border-radius: 8px; overflow: hidden; margin-bottom: 10px;">
            <img src="${validSrc}"
                 alt="${escapeHtml(item.name || item.itemName || 'Item Image')}"
                 style="max-width: 100%; max-height: 100%; object-fit: contain;"
                 onerror="this.onerror=null; this.src='${OFFLINE_PLACEHOLDER}';" />
        </div>
    `;
}

function getDirectDriveUrl(url, endpointIndex = 0) {
    if (!url) return FALLBACK_IMG;
    if (url.startsWith('data:image')) return url;
    const match = url.match(/(?:id=|\/d\/|\/file\/d\/)([a-zA-Z0-9_-]{25,})/);
    if (!match || !match[1]) return url;
    const fileId = match[1];
    const endpoints = [
        `https://lh3.googleusercontent.com/d/${fileId}`,
        `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`,
        `https://drive.google.com/uc?export=view&id=${fileId}`
    ];
    return endpoints[endpointIndex % endpoints.length];
}

function safeSetImage(imgElement, url) {
    if (!imgElement) return;
    imgElement.onerror = () => {
        imgElement.onerror = null;
        imgElement.src = OFFLINE_PLACEHOLDER;
    };
    if (!isValidImageUrl(url)) {
        imgElement.src = OFFLINE_PLACEHOLDER;
        return;
    }
    imgElement.src = getDirectDriveUrl(url);
}

function attachSmartImage(imgEl, rawUrl) {
    imgEl.loading = "lazy";
    window.loadCachedImage(imgEl, rawUrl);
}

// ==================== IMAGE CACHE (IndexedDB) ====================
const ImageCache = {
    dbName: 'StationeryAppImageCache',
    storeName: 'cached_images',
    async openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName);
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },
    async get(key) {
        try {
            const db = await this.openDB();
            return new Promise((resolve) => {
                const tx = db.transaction(this.storeName, 'readonly');
                const store = tx.objectStore(this.storeName);
                const req = store.get(key);
                req.onsuccess = () => resolve(req.result || null);
                req.onerror = () => resolve(null);
            });
        } catch (e) { return null; }
    },
    async set(key, value) {
        try {
            const db = await this.openDB();
            const tx = db.transaction(this.storeName, 'readwrite');
            const store = tx.objectStore(this.storeName);
            store.put(value, key);
        } catch (e) { console.warn("Failed to cache image locally", e); }
    }
};


// ==================== v2.3.1 DRIVE IMAGE FALLBACK (photos + signatures) ====================
// Google blocks direct <img>/fetch hot-linking of Drive files (403 / CORS). When any Drive image fails to load,
// we ask the Apps Script ("getImage") for the file as base64, cache it on the device (IndexedDB) and show it.
// This also feeds the Receipt PDF / Print. Needs the getImage block in the Apps Script (see .gs file).
function extractDriveId(url) {
    const m = String(url || '').match(/(?:id=|\/d\/|\/file\/d\/)([a-zA-Z0-9_-]{25,})/);
    return m ? m[1] : null;
}
window.extractDriveId = extractDriveId;

const _drvMem = new Map();
const _drvPending = new Map();
let _drvActive = 0;
const _drvWaiters = [];
let _drvWarned = false;

async function _drvAcquire() {
    if (_drvActive < 3) { _drvActive++; return; }
    await new Promise(r => _drvWaiters.push(r));
    _drvActive++;
}
function _drvRelease() { _drvActive--; const n = _drvWaiters.shift(); if (n) n(); }

window.driveImageViaScript = function(rawUrl, maxSide = 700) {
    const id = extractDriveId(rawUrl);
    if (!id) return Promise.resolve(null);
    if (_drvMem.has(id)) return Promise.resolve(_drvMem.get(id));
    if (_drvPending.has(id)) return _drvPending.get(id);

    const p = (async () => {
        const cached = await ImageCache.get('drv:' + id);
        if (cached) { _drvMem.set(id, cached); return cached; }

        const scriptUrl = window.GOOGLE_SCRIPT_URL || localStorage.getItem('driveScriptUrl');
        if (!scriptUrl) return null;

        await _drvAcquire();
        try {
            // v2.3.2: every request has a 30s timeout (a hung Apps Script call used to block the whole queue, so
            // photos stayed on the spinner forever) and the toast now says WHY it failed.
            const warnOnce = (why) => {
                if (_drvWarned) return;
                _drvWarned = true;
                console.warn('Drive getImage failed:', why);
                try { showToast('Photos could not load: ' + why, 'error'); } catch (e) { }
            };
            for (let attempt = 0; attempt < 2; attempt++) {
                const ctrl = new AbortController();
                const timer = setTimeout(() => ctrl.abort(), 30000);
                try {
                    const r = await fetch(scriptUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'getImage', fileId: id }), signal: ctrl.signal });
                    const txt = await r.text();
                    let j = null;
                    try { j = JSON.parse(txt); } catch (pe) { }
                    if (j && j.status === 'success' && j.data) {
                        let data = j.data;
                        if (data.length > 450000 && typeof _rcptNormalize === 'function') {
                            const norm = await _rcptNormalize(data, maxSide, /image\/png/.test(data.slice(0, 30)));
                            if (norm) data = norm;
                        }
                        _drvMem.set(id, data);
                        ImageCache.set('drv:' + id, data);
                        return data;
                    }
                    if (!j) { warnOnce('Apps Script did not return JSON. Deploy a NEW VERSION of the script that contains the getImage block (see drive-script-getimage-snippet.gs).'); return null; }
                    const em = j.message ? String(j.message) : '';
                    if (!em || /split|undefined|is not defined|Cannot read|not a function/i.test(em)) {
                        // The old upload code answered (it expects "image"): the getImage block is not live on Google yet.
                        warnOnce('your Google Apps Script is still the OLD version (it does not know "getImage"). Add the getImage block and Deploy > Manage deployments > New version. [' + em.slice(0, 80) + ']');
                    } else {
                        warnOnce(em.slice(0, 140));
                    }
                    return null;
                } catch (e) {
                    if (attempt === 1) {
                        console.warn('getImage request failed', e);
                        warnOnce(e && e.name === 'AbortError' ? 'Apps Script took more than 30 seconds to answer.' : 'could not reach the Apps Script (internet or wrong Drive Connector URL).');
                    }
                } finally { clearTimeout(timer); }
            }
            return null;
        } finally { _drvRelease(); }
    })();

    _drvPending.set(id, p);
    p.finally(() => _drvPending.delete(id));
    return p;
};

// Any <img> (history lists, admin tables, signatures, catalog...) that fails to load from Google gets the fallback.
document.addEventListener('error', async (ev) => {
    const img = ev.target;
    if (!(img instanceof HTMLImageElement)) return;
    const src = img.currentSrc || img.src || '';
    if (!/google|googleusercontent/i.test(src) || img.dataset.drvTried === '1') return;
    const id = extractDriveId(src) || extractDriveId(img.dataset.url);
    if (!id) return;
    img.dataset.drvTried = '1';
    img.dataset.drvOrig = src;
    const data = await window.driveImageViaScript(src);
    if (data) {
        img.src = data;
        img.classList.add('loaded');
        img.parentElement && img.parentElement.classList.remove('skeleton');
    } else {
        img.dataset.drvFailed = '1';
        img.title = 'Tap to retry loading this picture';
    }
}, true);

// Tap a picture that failed -> try again
document.addEventListener('click', (ev) => {
    const img = ev.target;
    if (!(img instanceof HTMLImageElement) || img.dataset.drvFailed !== '1') return;
    const orig = img.dataset.drvOrig;
    if (!orig) return;
    delete img.dataset.drvFailed; delete img.dataset.drvTried;
    img.src = orig;
});

window.loadCachedImage = async function(imgElement, imageSrcOrId) {
    if (!imgElement) return;
    imgElement.onerror = () => {
        imgElement.onerror = null;
        imgElement.src = OFFLINE_PLACEHOLDER;
    };
    if (!isValidImageUrl(imageSrcOrId) || imageSrcOrId === FALLBACK_IMG) {
        imgElement.src = OFFLINE_PLACEHOLDER;
        return;
    }
    const directUrl = getDirectDriveUrl(imageSrcOrId);
    imgElement.src = directUrl;
    const isExternal = directUrl.includes('drive.google.com') ||
                       directUrl.includes('googleusercontent.com') ||
                       directUrl.includes('firebasestorage');
    if (isExternal) {
        imgElement.classList.add('loaded');
        return;
    }
    const cacheKey = imageSrcOrId;
    const cachedData = await ImageCache.get(cacheKey);
    if (cachedData) {
        imgElement.src = cachedData;
        imgElement.classList.add('loaded');
        imgElement.parentElement?.classList.remove('skeleton');
        return;
    }
    if (directUrl.startsWith('data:image')) {
        imgElement.classList.add('loaded');
        await ImageCache.set(cacheKey, directUrl);
        return;
    }
};

// ==================== IMAGE PROCESSING ====================
window.compressBase64Image = async function(base64Str, maxWidth = 800, quality = 0.6) {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = base64Str;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            if (width > maxWidth) {
                height = Math.round((height * maxWidth) / width);
                width = maxWidth;
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => resolve(base64Str);
    });
};

window.compressAndScaleImage = function(file, maxWidth = 800, quality = 0.85) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
        };
    });
};

window.generateStudioProductPhoto = async function(base64OrFile) {
    try {
        console.log("🤖 Processing AI Background Removal for Studio Look...");
        try { showToast("AI is removing the photo background... (first time can take a minute)"); } catch (e) { }
        const blob = await imglyRemoveBackground(base64OrFile);
        const transparentUrl = URL.createObjectURL(blob);
        return new Promise((resolve) => {
            const img = new Image();
            img.src = transparentUrl;
            img.onerror = () => resolve(typeof base64OrFile === 'string' ? base64OrFile : null);
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = 800;
                canvas.height = 800;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                const padding = 80;
                const maxDim = 800 - (padding * 2);
                const scale = Math.min(maxDim / img.width, maxDim / img.height);
                const x = (canvas.width - img.width * scale) / 2;
                const y = (canvas.height - img.height * scale) / 2;
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
                URL.revokeObjectURL(transparentUrl);
                resolve(canvas.toDataURL('image/jpeg', 0.85));
            };
        });
    } catch (err) {
        console.warn("AI Processing Warning, falling back to compressed photo:", err);
        try { showToast("Background removal unavailable (check internet). Original photo used.", "error"); } catch (e) { }
        return typeof base64OrFile === 'string' ? base64OrFile : await window.compressAndScaleImage(base64OrFile);
    }
};

// ==================== UTILITIES ====================
function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}

function sanitizeForFirebase(obj) {
    return JSON.parse(JSON.stringify(obj, (key, value) => {
        return value === undefined ? "" : value;
    }));
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function addListener(dbRef, callback) {
    const unsub = onValue(dbRef, callback);
    unsubscribeListeners.push(unsub);
    return unsub;
}

function cleanupListeners() {
    unsubscribeListeners.forEach(unsub => { try { unsub(); } catch (e) { } });
    unsubscribeListeners = [];
}

const $ = (id) => document.getElementById(id);

// ==================== STATE ====================
let currentUser = null;
window.stationeryCart = [];
let inventoryData = {};
let unsubscribeListeners = [];
let html5QrCode = null;
let ocrStream = null;
let currentOcrTarget = null;
let notificationsList = [];

let adminPad = null;
let teacherPad = null;
let teacherRequestPad = null;
let handoverPad = null;
let selectedOrderIdForApproval = null;
window.activeHandoverRequestId = null;
window.currentHandoverOrder = null;

const catalogState = { allItems: [], filtered: [], currentPage: 1, searchTerm: '' };
const adminInventoryState = { allItems: [], filtered: [], currentPage: 1, searchTerm: '' };
const auditLedgerState = { allItems: [], filtered: [], currentPage: 1 };
const teacherOrdersState = { allItems: [], filtered: [], currentPage: 1 };
let teacherAnalyticsData = [];

const alertedRequests = new Set();

// ==================== ✅ NEW: ATOMIC IDEMPOTENT STOCK DEDUCTION ====================
/**
 * Safely deducts stock ONCE per order using Firebase Transactions + Idempotency Guard.
 * Single Source of Truth: /inventory/{serialNumber}/
 * @param {Object} order - The completed order object
 * @returns {Object} { success, reason, results }
 */
async function executeSingleStockDeduction(order) {
    if (!order || !order.orderId) {
        console.warn("executeSingleStockDeduction: Invalid order object");
        return { success: false, reason: 'invalid_order' };
    }

    const orderRef = ref(db, `orders/${order.orderId}`);

    // ─────────────────────────────────────────────────────────
    // STEP 1: IDEMPOTENCY CHECK
    // ─────────────────────────────────────────────────────────
    try {
        const orderSnap = await get(orderRef);
        if (orderSnap.exists() && orderSnap.val().stockDeducted === true) {
            console.warn(`⚠️ Stock already deducted for Order ${order.orderId}. Skipping duplicate execution.`);
            return { success: true, reason: 'already_deducted' };
        }
    } catch (e) {
        console.error("Idempotency check failed:", e);
        return { success: false, reason: 'check_failed', error: e.message };
    }

    // ─────────────────────────────────────────────────────────
    // STEP 2: NORMALIZE ITEMS ARRAY
    // ─────────────────────────────────────────────────────────
    const itemsList = Array.isArray(order.items)
        ? order.items
        : Object.values(order.items || {});

    if (itemsList.length === 0) {
        console.warn(`Order ${order.orderId} has no items. Marking as deducted anyway.`);
        await update(orderRef, {
            stockDeducted: true,
            stockDeductedAt: new Date().toISOString()
        });
        return { success: true, reason: 'no_items' };
    }

    // ─────────────────────────────────────────────────────────
    // STEP 3: ATOMIC TRANSACTION PER ITEM (SINGLE ROOT: /inventory)
    // ─────────────────────────────────────────────────────────
    const deductionResults = [];

    for (const item of itemsList) {
        const serialNo = String(
            item.serialNumber ||
            item.batchSerialNumber ||
            item.sn ||
            item.barcode ||
            item.itemSn ||
            item.itemId ||
            item.itemName ||
            ''
        ).trim();

        const qtyIssued = parseInt(
            item.requestQuantity ?? item.quantity ?? item.requestedQty ?? 0,
            10
        );

        if (!serialNo || qtyIssued <= 0) {
            console.warn("Skipping invalid item:", item);
            deductionResults.push({ serialNo, qtyIssued, status: 'skipped' });
            continue;
        }

        // Try the canonical serial number first, then fall back to itemName
        const invRef = ref(db, `inventory/${serialNo}`);

        try {
            await executeRealtimeStockDeduction(serialNo, qtyIssued);
            deductionResults.push({ serialNo, qtyIssued, status: 'deducted' });
            console.log(`✅ Realtime Deducted ${qtyIssued} from SN: ${serialNo}`);
        } catch (txnErr) {
            console.error(`Transaction failed for SN: ${serialNo}`, txnErr);
            deductionResults.push({ serialNo, qtyIssued, status: 'error', error: txnErr.message });
        }
    }

    // ─────────────────────────────────────────────────────────
    // STEP 4: MARK ORDER AS DEDUCTED
    // ─────────────────────────────────────────────────────────
    try {
        await update(orderRef, {
            stockDeducted: true,
            stockDeductedAt: new Date().toISOString(),
            status: 'Done',
            completedAt: new Date().toISOString()
        });
    } catch (e) {
        console.error("Failed to mark order as stockDeducted:", e);
    }

    return { success: true, reason: 'completed', results: deductionResults };
}
window.executeSingleStockDeduction = executeSingleStockDeduction;


// ---------- v2.3.0 stock consistency helpers ----------
// Parent totals must ALWAYS equal the sum of its batches (this is what the admin dashboard shows).
async function recalcParentTotals(itemId) {
    const parentRef = ref(db, `inventory/${itemId}`);
    const snap = await get(parentRef);
    if (!snap.exists()) return null;
    const p = snap.val();
    const batches = (p.batches && typeof p.batches === 'object') ? Object.values(p.batches) : [];
    if (!batches.length) return null; // legacy item without batches keeps its own value
    const total = batches.reduce((sum, b) => sum + Math.max(0, parseInt(b?.currentStock ?? b?.currentQty ?? b?.quantity ?? 0, 10) || 0), 0);
    await update(parentRef, {
        currentQty: total, currentStock: total, quantity: total, availableStock: total, stock: total,
        status: total > 0 ? (total <= 5 ? 'Low Stock' : 'In Stock') : 'Out of Stock',
        lastUpdated: new Date().toISOString()
    });
    return total;
}
window.recalcParentTotals = recalcParentTotals;

// ==================== REALTIME FIREBASE STOCK DEDUCTION ====================
async function executeRealtimeStockDeduction(itemId, orderedQty) {
    if (!itemId) return;
    const cleanId = String(itemId).trim();
    if (!cleanId) return;

    let targetKey = cleanId;
    let itemData = inventoryData ? inventoryData[cleanId] : null;

    if (!itemData && inventoryData) {
        const cleanLower = cleanId.toLowerCase();
        const foundKey = Object.keys(inventoryData).find(k => {
            const node = inventoryData[k];
            if (!node) return false;
            const nodeSN = (node.serialNumber || node.batchNo || '').toString().trim().toLowerCase();
            const nodeName = (node.itemName || node.name || '').toString().trim().toLowerCase();
            return k.toLowerCase() === cleanLower || nodeSN === cleanLower || nodeName === cleanLower;
        });
        if (foundKey) {
            targetKey = foundKey;
            itemData = inventoryData[foundKey];
        }
    }

    const itemRef = ref(db, `inventory/${targetKey}`);
    // v2.3.0: always deduct from the LIVE database value (the cached copy can be stale right after another change)
    try {
        const snapshot = await get(itemRef);
        if (snapshot.exists()) itemData = snapshot.val();
    } catch (e) {
        console.error("Failed to fetch item for deduction:", e);
    }

    if (!itemData) {
        console.warn("executeRealtimeStockDeduction: Item node not found for ID:", targetKey);
        return;
    }

    let qtyToDeduct = parseInt(orderedQty, 10) || 0;
    if (qtyToDeduct <= 0) return;

    const updates = {};

    if (itemData.batches && typeof itemData.batches === 'object' && Object.keys(itemData.batches).length > 0) {
        const sortedBatches = Object.entries(itemData.batches)
            .map(([bId, b]) => ({ bId, ...b, qty: parseInt(b.currentQty ?? b.currentStock ?? b.quantity ?? 0, 10) }))
            .filter(b => b.qty > 0)
            .sort((a, b) => new Date(a.receivedDate || a.createdAt || '1970-01-01') - new Date(b.receivedDate || b.createdAt || '1970-01-01'));

        for (const batch of sortedBatches) {
            if (qtyToDeduct <= 0) break;
            const deduct = Math.min(batch.qty, qtyToDeduct);
            const newBatchQty = Math.max(0, batch.qty - deduct);

            updates[`batches/${batch.bId}/currentQty`] = newBatchQty;
            updates[`batches/${batch.bId}/currentStock`] = newBatchQty;
            updates[`batches/${batch.bId}/quantity`] = newBatchQty;
            updates[`batches/${batch.bId}/status`] = newBatchQty > 0 ? "In Stock" : "Depleted";
            qtyToDeduct -= deduct;
        }

        let remainingSum = 0;
        Object.entries(itemData.batches).forEach(([bKey, b]) => {
            const bQty = updates[`batches/${bKey}/currentQty`] !== undefined
                ? updates[`batches/${bKey}/currentQty`]
                : parseInt(b.currentQty ?? b.currentStock ?? b.quantity ?? 0, 10);
            remainingSum += Math.max(0, bQty);
        });

        updates[`currentQty`] = remainingSum;
        updates[`currentStock`] = remainingSum;
        updates[`quantity`] = remainingSum;
        updates[`availableStock`] = remainingSum;
        updates[`stock`] = remainingSum;
        updates[`status`] = remainingSum > 0 ? (remainingSum <= 5 ? "Low Stock" : "In Stock") : "Out of Stock";
    } else {
        const currentVal = parseInt(itemData.currentQty ?? itemData.currentStock ?? itemData.quantity ?? itemData.availableStock ?? 0, 10);
        const newVal = Math.max(0, currentVal - qtyToDeduct);
        updates[`currentQty`] = newVal;
        updates[`currentStock`] = newVal;
        updates[`quantity`] = newVal;
        updates[`availableStock`] = newVal;
        updates[`stock`] = newVal;
        updates[`status`] = newVal > 0 ? (newVal <= 5 ? "Low Stock" : "In Stock") : "Out of Stock";
    }

    await update(itemRef, updates);

    window.masterInventoryList = getFlatInventoryList();
    if (typeof renderMasterInventory === 'function') renderMasterInventory();
    if (typeof renderMasterInventoryReport === 'function') renderMasterInventoryReport();
    if (typeof renderTeacherCatalog === 'function') renderTeacherCatalog();
}
window.executeRealtimeStockDeduction = executeRealtimeStockDeduction;

// ==================== AUTO FIFO MULTI-BATCH CALCULATION ====================
function calculateBatchDispatchSplit(item, requestedQty) {
    let remainingToFulfill = parseInt(requestedQty, 10) || 0;
    const itemNode = item || {};
    const batchesObj = itemNode.batches || {};

    const activeBatches = Object.entries(batchesObj)
        .map(([id, b]) => ({
            id,
            ...b,
            currentQty: parseInt(b.currentQty ?? b.currentStock ?? b.quantity ?? 0, 10),
            brand: b.brandName || b.brand || b.manufacturer || itemNode.brand || 'Standard',
            serialNumber: b.serialNumber || b.batchNo || itemNode.serialNumber || 'N/A',
            receivedDate: b.receivedDate || b.createdAt || (itemNode.createdAt ? itemNode.createdAt.split('T')[0] : '1970-01-01')
        }))
        .filter(b => b.currentQty > 0)
        .sort((a, b) => new Date(a.receivedDate) - new Date(b.receivedDate)); // Oldest first (FIFO)

    const splitPlan = [];

    if (activeBatches.length > 0) {
        for (const batch of activeBatches) {
            if (remainingToFulfill <= 0) break;

            const deductAmount = Math.min(batch.currentQty, remainingToFulfill);
            splitPlan.push({
                batchId: batch.id,
                brand: batch.brand || 'Standard',
                serialNumber: batch.serialNumber || 'N/A',
                deductQty: deductAmount,
                remainingQtyAfter: batch.currentQty - deductAmount
            });

            remainingToFulfill -= deductAmount;
        }
    } else {
        // Fallback for legacy items without nested batch objects
        const mainQty = parseInt(itemNode.quantity ?? itemNode.availableStock ?? itemNode.currentStock ?? 0, 10);
        if (mainQty > 0 && remainingToFulfill > 0) {
            const deductAmount = Math.min(mainQty, remainingToFulfill);
            splitPlan.push({
                batchId: 'MAIN_STOCK',
                brand: itemNode.brand || 'Standard',
                serialNumber: itemNode.serialNumber || 'N/A',
                deductQty: deductAmount,
                remainingQtyAfter: mainQty - deductAmount
            });
            remainingToFulfill -= deductAmount;
        }
    }

    return {
        isFullyCovered: remainingToFulfill === 0,
        unfulfilledQty: Math.max(0, remainingToFulfill),
        splitPlan: splitPlan
    };
}
window.calculateBatchDispatchSplit = calculateBatchDispatchSplit;

// ==================== HANDOVER BATCH OPTIONS ====================
function buildHandoverBatchOptions(item, fullInventory) {
    if (!fullInventory) return '<option value="">-- No Stock Available --</option>';

    const itemNameLower = String(item.itemName || item.name || '').trim().toLowerCase();
    const itemSN = String(item.serialNumber || item.sn || item.itemId || item.id || '').trim();

    let matchedSN = null;
    let matchedItem = null;

    if (itemSN && fullInventory[itemSN]) {
        matchedSN = itemSN;
        matchedItem = fullInventory[itemSN];
    } else {
        matchedSN = Object.keys(fullInventory).find(key => {
            const invItem = fullInventory[key];
            if (!invItem || typeof invItem !== 'object') return false;
            const invName = String(invItem.itemName || invItem.name || '').trim().toLowerCase();
            const invSN = String(invItem.serialNumber || invItem.sn || invItem.barcode || '').trim().toLowerCase();
            return (invName === itemNameLower) || (itemSN && invSN === itemSN.toLowerCase()) || (key.toLowerCase() === itemNameLower);
        });
        if (matchedSN) {
            matchedItem = fullInventory[matchedSN];
        }
    }

    if (!matchedItem) {
        console.warn(`⚠️ Item not found in inventory for handover:`, item);
        return `<option value="MAIN_${itemSN || 'UNKNOWN'}" selected>Main Stock (SN: ${escapeHtml(itemSN || 'N/A')}) - Avail: 0 Pcs</option>`;
    }

    const totalQty = parseInt(
        matchedItem.quantity ?? matchedItem.availableStock ?? matchedItem.currentStock ?? matchedItem.stock ?? 0,
        10
    );
    const snDisplay = matchedItem.serialNumber || matchedSN || itemSN || 'MAIN-STOCK';

    let optionsHTML = '<option value="">-- Choose Batch / SN --</option>';

    const hasBatches = matchedItem.batches && typeof matchedItem.batches === 'object' && Object.keys(matchedItem.batches).length > 0;
    let hasActiveBatchOptions = false;

    if (hasBatches) {
        Object.keys(matchedItem.batches).forEach(batchKey => {
            const bData = matchedItem.batches[batchKey];
            const bStock = parseInt(bData.currentStock ?? bData.quantity ?? bData.initialQty ?? 0, 10);
            if (bStock > 0) {
                optionsHTML += `<option value="${batchKey}" data-sn="${matchedSN}" data-stock="${bStock}">
                    Batch: ${escapeHtml(bData.brandName || bData.batchNo || batchKey)} (SN: ${escapeHtml(bData.serialNumber || snDisplay)}) - Avail: ${bStock} Pcs
                </option>`;
                hasActiveBatchOptions = true;
            }
        });
    }

    // Only append Main Stock fallback option if item.batches is null, empty, undefined, or has no active batch options
    if (!hasActiveBatchOptions) {
        optionsHTML += `<option value="MAIN_STOCK_${matchedSN}" data-sn="${matchedSN}" data-stock="${totalQty}" selected>
            Main Stock (SN: ${escapeHtml(snDisplay)}) - Avail: ${totalQty} Pcs
        </option>`;
    }

    return optionsHTML;

    return optionsHTML;
}
window.buildHandoverBatchOptions = buildHandoverBatchOptions;

// ==================== SIGNATURE PAD ====================
// ==================== ZOOMABLE & FULL-SCREEN SIGNATURE PAD SYSTEM v1.8.80 ====================
window._canvasZoomScales = window._canvasZoomScales || {};

window.zoomSignatureCanvas = function(canvasId, factor) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    window._canvasZoomScales[canvasId] = (window._canvasZoomScales[canvasId] || 1) * factor;
    window._canvasZoomScales[canvasId] = Math.max(0.5, Math.min(window._canvasZoomScales[canvasId], 3.0));

    canvas.style.transform = `scale(${window._canvasZoomScales[canvasId]})`;
    canvas.style.transformOrigin = `center center`;
    showToast(`Signature Pad Zoom: ${Math.round(window._canvasZoomScales[canvasId] * 100)}%`, "info");
};

window.resetSignatureCanvasZoom = function(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    window._canvasZoomScales[canvasId] = 1;
    canvas.style.transform = `scale(1)`;
    showToast("Signature Pad Zoom Reset (100%)", "info");
};

window._originalPadParents = window._originalPadParents || {};

window.toggleFullScreenSignature = function(wrapperId, canvasId) {
    const wrapper = document.getElementById(wrapperId);
    const canvas = document.getElementById(canvasId);
    if (!wrapper || !canvas) return;

    if (!wrapper.classList.contains('signature-fullscreen-active')) {
        // Save original parent container
        if (!window._originalPadParents[wrapperId]) {
            window._originalPadParents[wrapperId] = {
                parent: wrapper.parentElement,
                nextSibling: wrapper.nextSibling
            };
        }

        // True Breakout: move directly to document.body
        document.body.appendChild(wrapper);
        wrapper.classList.add('signature-fullscreen-active');
        document.body.style.overflow = 'hidden';

        // Recalculate canvas size for full viewport
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        const fullW = Math.max(window.innerWidth - 32, 300);
        const fullH = Math.max(window.innerHeight - 160, 200);

        canvas.width = fullW * ratio;
        canvas.height = fullH * ratio;

        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.scale(ratio, ratio);
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.strokeStyle = '#000000';
        }

        showToast("📱 Full-Screen Signature Pad Active. Draw smoothly!", "info");
    } else {
        window.confirmFullScreenSignature(wrapperId, canvasId);
    }
};

window.confirmFullScreenSignature = function(wrapperId, canvasId) {
    const wrapper = document.getElementById(wrapperId);
    const canvas = document.getElementById(canvasId);
    if (!canvas || !wrapper) return;

    if (typeof isCanvasBlank === 'function' && !isCanvasBlank(canvas)) {
        window.isSignatureProvided = true;
    }

    window.resetSignatureCanvasZoom(canvasId);

    if (wrapper.classList.contains('signature-fullscreen-active')) {
        wrapper.classList.remove('signature-fullscreen-active');
        document.body.style.overflow = '';

        // Restore back to original modal parent
        const savedInfo = window._originalPadParents[wrapperId];
        if (savedInfo && savedInfo.parent) {
            if (savedInfo.nextSibling) {
                savedInfo.parent.insertBefore(wrapper, savedInfo.nextSibling);
            } else {
                savedInfo.parent.appendChild(wrapper);
            }
        }

        // Resize canvas back to modal width
        if (canvasId === 'teacher-request-canvas' && teacherRequestPad && teacherRequestPad.resizeCanvas) {
            teacherRequestPad.resizeCanvas();
        } else if (canvasId === 'handover-signature-pad') {
            window.initSignaturePad('handover-signature-pad', 'clear-handover-sig');
        }
    }

    showToast("✅ Signature Confirmed & Captured! Scroll down to submit.", "success");
};

window.initSignaturePad = function(canvasId, clearBtnId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;

    const ctx = canvas.getContext('2d');
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const parentRect = canvas.parentElement ? canvas.parentElement.getBoundingClientRect() : canvas.getBoundingClientRect();
    canvas.width = (parentRect.width || canvas.offsetWidth || 400) * ratio;
    canvas.height = 180 * ratio;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(ratio, ratio);
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    let isDrawing = false;

    function getPos(e) {
        const r = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const scaleX = (canvas.width / ratio) / (r.width || 1);
        const scaleY = (canvas.height / ratio) / (r.height || 1);
        return {
            x: (clientX - r.left) * scaleX,
            y: (clientY - r.top) * scaleY
        };
    }

    function startDraw(e) {
        if (e.cancelable) e.preventDefault();
        isDrawing = true;
        const pos = getPos(e);
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
    }

    function draw(e) {
        if (!isDrawing) return;
        if (e.cancelable) e.preventDefault();
        const pos = getPos(e);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        window.isSignatureProvided = true;
    }

    function stopDraw() { isDrawing = false; }

    canvas.onmousedown = startDraw;
    canvas.onmousemove = draw;
    canvas.onmouseup = stopDraw;

    canvas.addEventListener('touchstart', startDraw, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', stopDraw);

    const clearBtn = document.getElementById(clearBtnId);
    if (clearBtn) {
        clearBtn.onclick = function() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            window.isSignatureProvided = false;
        };
    }

    return canvas;
};

function setupResponsiveSignaturePad(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;

    const ctx = canvas.getContext('2d');
    let isDrawing = false;

    function resizeCanvas() {
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        const parentRect = canvas.parentElement ? canvas.parentElement.getBoundingClientRect() : canvas.getBoundingClientRect();
        canvas.width = (parentRect.width || canvas.offsetWidth || 340) * ratio;
        canvas.height = 180 * ratio;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(ratio, ratio);
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#000000';
    }

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    function getCoordinates(e) {
        const rect = canvas.getBoundingClientRect();
        let clientX, clientY;
        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }
        const scaleX = (canvas.width / (window.devicePixelRatio || 1)) / (rect.width || 1);
        const scaleY = (canvas.height / (window.devicePixelRatio || 1)) / (rect.height || 1);
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    }

    function startDrawing(e) {
        if (e.cancelable) e.preventDefault();
        isDrawing = true;
        const pos = getCoordinates(e);
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
    }

    function draw(e) {
        if (!isDrawing) return;
        if (e.cancelable) e.preventDefault();
        const pos = getCoordinates(e);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
    }

    function stopDrawing(e) {
        if (isDrawing) {
            isDrawing = false;
            ctx.closePath();
        }
    }

    canvas.onmousedown = startDrawing;
    canvas.onmousemove = draw;
    canvas.onmouseup = stopDrawing;
    canvas.onmouseleave = stopDrawing;

    canvas.addEventListener('touchstart', startDrawing, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', stopDrawing, { passive: false });

    return {
        clear: () => ctx.clearRect(0, 0, canvas.width, canvas.height),
        isEmpty: () => {
            const pixelBuffer = new Uint32Array(ctx.getImageData(0, 0, canvas.width, canvas.height).data.buffer);
            return !pixelBuffer.some(color => color !== 0);
        },
        getDataUrl: () => canvas.toDataURL('image/png'),
        resizeCanvas
    };
}

function isCanvasBlank(canvas) {
    if (!canvas) return true;
    try {
        const context = canvas.getContext('2d');
        const pixelData = context.getImageData(0, 0, canvas.width, canvas.height).data;
        return !pixelData.some(channel => channel !== 0);
    } catch (e) {
        return true;
    }
}

function getStatusBadge(qty) {
    const numericQty = Number(qty) || 0;
    if (numericQty <= 0) return `<span class="badge bg-secondary text-white">❌ Out of Stock (0)</span>`;
    if (numericQty <= 5) return `<span class="badge bg-danger text-white animate-pulse">⚠️ Emergency Reorder (${numericQty})</span>`;
    if (numericQty < 20) return `<span class="badge bg-warning text-dark">Low Stock (${numericQty})</span>`;
    return `<span class="badge bg-success text-white">In Stock</span>`;
}

// ==================== ADMIN AUTH ====================
window.openAdminModal = function(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    console.log("Opening Developer Direct Access Modal...");

    const isAuthenticated = sessionStorage.getItem('isAdminAuthenticated');
    const savedUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    if (isAuthenticated === 'true' && savedUser.role === 'developer') {
        window.renderDashboardForRole('developer', 'DEV001');
        return;
    }

    const modalEl = document.getElementById('adminAuthModal') || document.getElementById('admin-auth-modal');
    if (modalEl) {
        if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            const modalInstance = bootstrap.Modal.getOrCreateInstance(modalEl);
            modalInstance.show();
        } else {
            modalEl.classList.add('show');
            modalEl.style.display = 'block';
            document.body.classList.add('modal-open');
        }
    } else {
        const pass = prompt("Enter Developer Passcode:");
        if (pass === "Asif8013@#$") {
            window.verifyAdminByPassword("Asif8013@#$");
        } else if (pass) {
            alert("Incorrect Developer Passcode!");
        }
    }
};

window.verifyAdminByPassword = function(password) {
    if (password === "Asif8013@#$") {
        console.log("Developer Direct Access Granted");
        sessionStorage.setItem('isAdminAuthenticated', 'true');
        currentUser = {
            role: 'developer',
            name: 'Developer Mode',
            uid: 'DEV001',
            adecPassNumber: 'DEV001'
        };
        localStorage.setItem('stationery_user_adec', 'DEV001');
        localStorage.setItem('currentUser', JSON.stringify(currentUser));

        const loginEl = document.getElementById('login-view');
        if (loginEl) {
            loginEl.classList.add('d-none');
            loginEl.style.display = 'none';
        }

        const modalEl = document.getElementById('adminAuthModal') || document.getElementById('admin-auth-modal');
        if (modalEl) {
            if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
                const modalInstance = bootstrap.Modal.getInstance(modalEl);
                if (modalInstance) modalInstance.hide();
            }
            modalEl.classList.remove('show');
            modalEl.style.display = 'none';
        }

        document.body.classList.remove('modal-open');
        document.querySelectorAll('.modal-backdrop').forEach(b => b.remove());
        document.body.style.overflow = 'auto';

        window.renderDashboardForRole('developer', 'DEV001');
        showToast("Welcome, Developer", "success");
    } else {
        alert("Invalid Developer Passcode. Please try again.");
    }
};

window.submitAdminDirectLogin = function() {
    const passInput = document.getElementById('direct-admin-pass-input');
    if (passInput) {
        window.verifyAdminByPassword(passInput.value.trim());
    }
};

// ==================== SCANNER / OCR ====================
window.openBarcodeScanner = function(targetInputId) {
    console.log("Barcode Scanner Triggered for:", targetInputId);
    currentOcrTarget = targetInputId;
    const modal = document.getElementById('qr-scanner-modal');
    if (modal) {
        if (typeof initScanner === 'function') initScanner();
    } else {
        alert("Scanner modal not found!");
    }
};

window.openTextScanner = function(targetInputId) {
    console.log("Text Scanner Triggered for:", targetInputId);
    currentOcrTarget = targetInputId;
    resetOcrUi();
    if (typeof startOcrCamera === 'function') startOcrCamera();
};

async function initScanner() {
    if (!html5QrCode) html5QrCode = new Html5Qrcode("reader", { experimentalFeatures: { useBarCodeDetectorIfSupported: true }, verbose: false });
    const config = {
        fps: 20,
        // wide scan box so the barcode does not have to fill the screen (no need to move the phone very close)
        qrbox: (vw, vh) => ({ width: Math.floor(Math.min(vw * 0.92, 520)), height: Math.floor(Math.min(vh * 0.45, 220)) }),
        disableFlip: true,
        // HD camera: digital zoom stays sharp
        videoConstraints: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } }
    };

    const modal = $('qr-scanner-modal');
    if (modal) {
        modal.classList.add('active');
        modal.style.display = 'flex';
        modal.style.visibility = 'visible';
        modal.style.opacity = '1';
        modal.style.zIndex = '1070';
        modal.style.pointerEvents = 'auto';
    }

    try {
        await html5QrCode.start({ facingMode: "environment" }, config, (decodedText) => {
            const input = $('inv-serial-number');
            if (input) { input.value = decodedText; input.dispatchEvent(new Event('input')); }
            showToast("Code Scanned!", "success");
            stopScanner();
        }, () => { });
        setTimeout(setupScannerCameraControls, 400);
    } catch (err) {
        console.error("Scanner Error:", err);
        showToast("Camera error: Check permissions.", "error");
        stopScanner();
    }
}

// Zoom slider (real camera zoom), continuous autofocus, tap-to-focus and torch
function setupScannerCameraControls() {
    const reader = document.getElementById('reader');
    const video = reader && reader.querySelector('video');
    const track = video && video.srcObject && video.srcObject.getVideoTracks && video.srcObject.getVideoTracks()[0];
    if (!track) return;
    const caps = (track.getCapabilities && track.getCapabilities()) || {};
    const apply = (adv) => track.applyConstraints({ advanced: [adv] }).catch(() => {});

    if (caps.focusMode && caps.focusMode.includes('continuous')) apply({ focusMode: 'continuous' });

    let box = document.getElementById('scanner-cam-controls');
    if (box) box.remove();
    box = document.createElement('div');
    box.id = 'scanner-cam-controls';

    if (caps.zoom && caps.zoom.max > caps.zoom.min) {
        const min = caps.zoom.min, max = Math.min(caps.zoom.max, 8);
        const step = caps.zoom.step || 0.1;
        const range = document.createElement('input');
        range.type = 'range'; range.min = min; range.max = max; range.step = step; range.value = min;
        range.setAttribute('aria-label', 'Camera zoom');
        const setZ = (v) => { v = Math.max(min, Math.min(max, v)); range.value = v; apply({ zoom: v }); };
        const minus = document.createElement('button'); minus.type = 'button'; minus.textContent = '−';
        const plus = document.createElement('button'); plus.type = 'button'; plus.textContent = '+';
        minus.onclick = () => setZ(parseFloat(range.value) - Math.max(step, (max - min) / 10));
        plus.onclick = () => setZ(parseFloat(range.value) + Math.max(step, (max - min) / 10));
        range.oninput = () => setZ(parseFloat(range.value));
        box.append(minus, range, plus);
    }

    if (caps.torch) {
        let on = false;
        const t = document.createElement('button'); t.type = 'button'; t.textContent = '🔦';
        t.onclick = () => { on = !on; t.classList.toggle('on', on); apply({ torch: on }); };
        box.append(t);
    }

    const hint = document.createElement('p');
    hint.className = 'hint';
    hint.textContent = 'Barcode se 15-25 cm door rakhein aur zoom slider use karein. Focus ke liye camera par tap karein.';
    box.append(hint);
    reader.insertAdjacentElement('afterend', box);

    // tap on the camera view = refocus
    video.style.cursor = 'pointer';
    video.onclick = () => {
        if (caps.focusMode && caps.focusMode.includes('single-shot')) {
            apply({ focusMode: 'single-shot' });
            setTimeout(() => { if (caps.focusMode.includes('continuous')) apply({ focusMode: 'continuous' }); }, 1500);
        } else if (caps.focusMode && caps.focusMode.includes('continuous')) {
            apply({ focusMode: 'manual' });
            setTimeout(() => apply({ focusMode: 'continuous' }), 300);
        }
    };
}

async function stopScanner() {
    const camBox = document.getElementById('scanner-cam-controls');
    if (camBox) camBox.remove();
    const modal = $('qr-scanner-modal');
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
        modal.style.visibility = 'hidden';
        modal.style.opacity = '0';
        modal.style.pointerEvents = 'none';
    }
    if (html5QrCode && html5QrCode.isScanning) {
        try {
            await html5QrCode.stop();
        } catch (e) {
            console.warn("Scanner stop error:", e);
        }
    }
}

async function startOcrCamera() {
    stopOcrCamera();
    const videoEl = $('ocr-video');
    const fallbackInput = $('ocr-file-fallback');
    const scannerModal = $('ocr-scanner-modal');

    const constraintsList = [
        { video: { facingMode: "environment", width: { ideal: 1920, min: 1280 }, height: { ideal: 1080, min: 720 } } },
        { video: { facingMode: "user" } },
        { video: true }
    ];

    let activeStream = null;
    for (const constraints of constraintsList) {
        try {
            activeStream = await navigator.mediaDevices.getUserMedia(constraints);
            if (activeStream) {
                const track = activeStream.getVideoTracks()[0];
                const capabilities = track.getCapabilities ? track.getCapabilities() : {};
                if (capabilities.focusMode && capabilities.focusMode.includes('continuous')) {
                    track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(() => {});
                }
                break;
            }
        } catch (e) { }
    }

    if (activeStream && videoEl) {
        ocrStream = activeStream;

        if (scannerModal) {
            scannerModal.classList.add('active');
            scannerModal.style.display = 'flex';
            scannerModal.style.visibility = 'visible';
            scannerModal.style.opacity = '1';
            scannerModal.style.zIndex = '1070';
            scannerModal.style.pointerEvents = 'auto';
        }

        videoEl.srcObject = activeStream;
        videoEl.setAttribute('playsinline', 'true');
        videoEl.setAttribute('autoplay', 'true');
        videoEl.setAttribute('muted', 'true');
        videoEl.muted = true;

        videoEl.play().then(() => {
            console.log("OCR Camera video stream playing successfully");
        }).catch(err => {
            console.error("Video play error:", err);
            showToast("Camera playback failed. Please check permissions.", "error");
        });
    } else {
        console.log("Live stream failed. Opening native camera...");
        if (fallbackInput) {
            showOcrModalOnly();
            showToast("Live camera not available. Use Gallery or Camera App button.", "error");
        } else {
            showToast("Camera error: Access denied or not found.", "error");
        }
    }
}

function stopOcrCamera() {
    if (ocrStream) {
        ocrStream.getTracks().forEach(track => {
            track.stop();
        });
        ocrStream = null;
    }
    const videoElement = $('ocr-video');
    if (videoElement) {
        videoElement.srcObject = null;
        videoElement.pause();
    }
    if ($('ocr-loader')) $('ocr-loader').style.display = 'none';
    const modal = $('ocr-scanner-modal');
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
        modal.style.visibility = 'hidden';
        modal.style.opacity = '0';
        modal.style.pointerEvents = 'none';
    }
}

function preprocessImageForOcr(sourceCanvas) {
    const width = sourceCanvas.width;
    const height = sourceCanvas.height;
    const processedCanvas = document.createElement('canvas');
    processedCanvas.width = width;
    processedCanvas.height = height;
    const ctx = processedCanvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(sourceCanvas, 0, 0);

    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    const contrast = 1.5;
    const threshold = 130;

    for (let i = 0; i < data.length; i += 4) {
        let gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        gray = (gray - 128) * contrast + 128;
        const v = gray > threshold ? 255 : 0;
        data[i] = data[i + 1] = data[i + 2] = v;
    }

    ctx.putImageData(imgData, 0, 0);
    return processedCanvas;
}

function speakExtractedText(text) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    if (!text || text.trim().length === 0) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US'; utterance.rate = 1.0;
    window.speechSynthesis.speak(utterance);
}

// ---------- Advanced Text Scanner (v1.9.19) ----------
function resetOcrUi() {
    const panel = $('ocr-result-panel');
    if (panel) panel.style.display = 'none';
    ['ocr-camera-wrap', 'ocr-tools', 'ocr-actions', 'ocr-hint'].forEach(id => { const e = $(id); if (e) e.style.display = ''; });
    const loader = $('ocr-loader');
    if (loader) loader.style.display = 'none';
}

function showOcrModalOnly() {
    const m = $('ocr-scanner-modal');
    if (!m) return;
    m.classList.add('active');
    Object.assign(m.style, { display: 'flex', visibility: 'visible', opacity: '1', zIndex: '1070', pointerEvents: 'auto' });
}

function ocrGrayStretch(src, maxW) {
    const w = src.width, h = src.height;
    const scale = w < 1400 ? Math.min(2, 1400 / w) : Math.min(1, maxW / w);
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * scale));
    c.height = Math.max(1, Math.round(h * scale));
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, 0, 0, c.width, c.height);
    const img = ctx.getImageData(0, 0, c.width, c.height);
    const d = img.data, hist = new Uint32Array(256);
    for (let i = 0; i < d.length; i += 4) {
        const g = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) | 0;
        d[i] = d[i + 1] = d[i + 2] = g; hist[g]++;
    }
    const total = c.width * c.height;
    let lo = 0, hi = 255, acc = 0;
    for (lo = 0; lo < 255; lo++) { acc += hist[lo]; if (acc > total * 0.01) break; }
    acc = 0;
    for (hi = 255; hi > 0; hi--) { acc += hist[hi]; if (acc > total * 0.01) break; }
    const range = Math.max(1, hi - lo);
    for (let i = 0; i < d.length; i += 4) {
        const v = Math.max(0, Math.min(255, ((d[i] - lo) * 255) / range));
        d[i] = d[i + 1] = d[i + 2] = v;
    }
    ctx.putImageData(img, 0, 0);
    return c;
}

function ocrOtsu(src) {
    const c = document.createElement('canvas');
    c.width = src.width; c.height = src.height;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(src, 0, 0);
    const img = ctx.getImageData(0, 0, c.width, c.height);
    const d = img.data, hist = new Array(256).fill(0);
    for (let i = 0; i < d.length; i += 4) hist[d[i]]++;
    const total = c.width * c.height;
    let sum = 0; for (let t = 0; t < 256; t++) sum += t * hist[t];
    let sumB = 0, wB = 0, best = 0, thr = 128;
    for (let t = 0; t < 256; t++) {
        wB += hist[t]; if (!wB) continue;
        const wF = total - wB; if (!wF) break;
        sumB += t * hist[t];
        const mB = sumB / wB, mF = (sum - sumB) / wF;
        const between = wB * wF * (mB - mF) * (mB - mF);
        if (between > best) { best = between; thr = t; }
    }
    for (let i = 0; i < d.length; i += 4) { const v = d[i] > thr ? 255 : 0; d[i] = d[i + 1] = d[i + 2] = v; }
    ctx.putImageData(img, 0, 0);
    return c;
}

async function ocrDetectBarcodes(canvas) {
    try {
        if (!('BarcodeDetector' in window)) return [];
        const found = await new BarcodeDetector().detect(canvas);
        return found.map(b => b.rawValue).filter(Boolean);
    } catch (e) { return []; }
}

async function runOcrScan(canvasElement) {
    const loader = $('ocr-loader');
    const statusText = $('ocr-status-text');
    showOcrModalOnly();
    if (loader) loader.style.display = 'flex';

    try {
        if (statusText) statusText.textContent = "Enhancing image...";
        const gray = ocrGrayStretch(canvasElement, 2600);
        const codes = await ocrDetectBarcodes(canvasElement);

        if (statusText) statusText.textContent = "Reading text...";
        const worker = await Tesseract.createWorker($('ocr-lang')?.value || 'eng');
        await worker.setParameters({ tessedit_pageseg_mode: Tesseract.PSM.AUTO, preserve_interword_spaces: '1' });
        let { data } = await worker.recognize(gray);

        if ((data.confidence || 0) < 65) {
            if (statusText) statusText.textContent = "Improving accuracy...";
            const second = await worker.recognize(ocrOtsu(gray));
            if ((second.data.confidence || 0) > (data.confidence || 0)) data = second.data;
        }
        await worker.terminate();

        const clean = t => String(t || '').replace(/\s+/g, ' ').trim();
        let lines = (data.lines || []).map(l => ({ text: clean(l.text), conf: Math.round(l.confidence || 0) }));
        if (!lines.length) lines = String(data.text || '').split('\n').map(t => ({ text: clean(t), conf: Math.round(data.confidence || 0) }));
        lines = lines.filter(l => l.text.length > 1 && /[\p{L}\p{N}]/u.test(l.text) && l.conf >= 25);

        if (loader) loader.style.display = 'none';
        if (!lines.length && !codes.length) {
            showToast("No clear text found. Try better light or move closer.", "error");
            return;
        }
        showOcrResults(lines, codes);
    } catch (error) {
        console.error("OCR Error:", error);
        showToast("OCR processing error.", "error");
        if (loader) loader.style.display = 'none';
    }
}

function showOcrResults(lines, codes) {
    ['ocr-camera-wrap', 'ocr-tools', 'ocr-actions', 'ocr-hint'].forEach(id => { const e = $(id); if (e) e.style.display = 'none'; });
    const panel = $('ocr-result-panel');
    if (panel) panel.style.display = 'block';

    const labels = { 'inv-item-name': 'Item Name', 'inv-description': 'Description', 'inv-serial-number': 'Serial No.' };
    const tBtn = $('ocr-send-target');
    if (tBtn) tBtn.textContent = 'Use for ' + (labels[currentOcrTarget] || 'field');

    const box = $('ocr-lines');
    const edit = $('ocr-text-edit');
    box.innerHTML = '';
    const sync = () => { edit.value = [...box.querySelectorAll('.ocr-line.on')].map(b => b.dataset.t).join('\n'); };

    lines.forEach(l => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'ocr-line' + (l.conf >= 60 ? ' on' : '');
        b.dataset.t = l.text;
        const sp = document.createElement('span'); sp.textContent = l.text;
        const em = document.createElement('em'); em.textContent = l.conf + '%';
        b.append(sp, em);
        b.onclick = () => { b.classList.toggle('on'); sync(); };
        box.appendChild(b);
    });

    const nums = new Set(codes);
    (lines.map(l => l.text).join(' ').match(/\b\d{8,14}\b/g) || []).forEach(n => nums.add(n));
    const sug = $('ocr-suggest');
    sug.innerHTML = '';
    nums.forEach(n => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'ocr-line num'; b.textContent = n;
        b.onclick = () => setOcrField('inv-serial-number', n, false);
        sug.appendChild(b);
    });
    sug.style.display = nums.size ? 'flex' : 'none';
    sync();
}

function setOcrField(id, value, multiline) {
    const el = $(id);
    if (!el) return;
    let v = String(value || '').trim();
    if (id === 'inv-serial-number') v = v.replace(/\s+/g, '');
    else if (!multiline) v = v.replace(/\s+/g, ' ');
    if (!v) { showToast("Select some text first.", "error"); return; }
    el.value = v;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    showToast("Filled: " + v.slice(0, 40), "success");
}

function ocrFileToScan(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width; canvas.height = img.height;
            canvas.getContext('2d').drawImage(img, 0, 0);
            runOcrScan(canvas);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

document.addEventListener('change', (e) => {
    if (e.target && e.target.id === 'ocr-gallery-input') {
        ocrFileToScan(e.target.files[0]);
        e.target.value = '';
    }
});

document.addEventListener('click', async (e) => {
    const t = e.target;
    if (!t || !t.closest) return;
    if (t.closest('#ocr-gallery-btn')) { $('ocr-gallery-input')?.click(); return; }
    if (t.closest('#ocr-torch-btn')) {
        const track = ocrStream && ocrStream.getVideoTracks()[0];
        try {
            const on = !(track && track.__torch);
            await track.applyConstraints({ advanced: [{ torch: on }] });
            track.__torch = on;
        } catch (err) { showToast("Flash is not supported on this device.", "error"); }
        return;
    }
    if (t.closest('#ocr-rescan-btn')) {
        resetOcrUi();
        if (!ocrStream) startOcrCamera();
        return;
    }
    if (t.closest('#ocr-done-btn')) { stopOcrCamera(); return; }
    const send = t.closest('[data-ocr-send]');
    if (send) {
        const target = send.dataset.ocrSend === 'target' ? currentOcrTarget : send.dataset.ocrSend;
        setOcrField(target, $('ocr-text-edit')?.value || '', target === 'inv-description');
    }
});

// ==================== HANDOVER ====================
window.openHandoverSignatureModal = async function(orderId) {
    window.handleFinalHandover(null, orderId);
};

window.handleFinalHandover = async function(event, orderId) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    console.log("Initiating Batch-Aware Handover for Order:", orderId);
    window.activeHandoverRequestId = orderId;

    const summaryEl = $('handover-order-summary');
    const selectionEl = $('handover-batch-selection');
    const existingSigEl = document.getElementById('existingReceiverSigPreview');

    if (selectionEl) selectionEl.innerHTML = '<div class="text-center p-3"><div class="spinner-border spinner-border-sm text-primary"></div> Loading batches...</div>';

    try {
        const [orderSnap, invSnap] = await Promise.all([
            get(ref(db, `orders/${orderId}`)),
            get(ref(db, 'inventory'))
        ]);

        if (orderSnap.exists()) {
            const order = orderSnap.val();
            const fullInventory = invSnap.exists() ? invSnap.val() : {};
            window.currentHandoverOrder = order;

            if (summaryEl) {
                summaryEl.innerHTML = `
                    <div class="d-flex justify-content-between">
                        <span><strong>Staff:</strong> ${escapeHtml(order.teacherName || order.user || 'Teacher')}</span>
                        <span class="badge bg-white text-primary border">${order.items?.length || 0} Items</span>
                    </div>
                `;
            }

            if (existingSigEl) {
                const savedSig = order.teacherRequestSignature || order.signatureUrl || order.receiverSignature;
                if (savedSig) {
                    const srcUrl = (savedSig.startsWith('data:') || savedSig.startsWith('http')) ? savedSig : `data:image/png;base64,${savedSig}`;
                    existingSigEl.innerHTML = `
                        <div class="p-2 border rounded bg-light mb-3 text-start">
                            <p class="text-muted small mb-1 fw-bold">Stored Request Signature:</p>
                            <img src="${srcUrl}" style="max-height:80px; border:1px solid #ddd; border-radius:4px; background:white; padding:2px;" onerror="this.onerror=null; this.parentElement.innerHTML='<span class=\\'text-danger\\' style=\\'font-size:12px;\\'>Signature Load Failed</span>';">
                        </div>`;
                } else {
                    existingSigEl.innerHTML = '';
                }
            }

            if (selectionEl) {
                let html = '<h6 class="fw-bold mb-3 text-dark d-flex align-items-center gap-2"><i class="bi bi-diagram-3-fill text-primary"></i> AUTOMATIC FIFO MULTI-BATCH DISPATCH ALLOCATION:</h6>';

                const items = Array.isArray(order.items) ? order.items : Object.values(order.items || {});
                window.currentHandoverSplitPlans = [];

                items.forEach((item, index) => {
                    const reqQty = parseInt(item.requestQuantity || item.quantity || item.reqQty || 1, 10);
                    const itemSN = String(item.serialNumber || item.sn || item.barcode || item.itemId || item.id || '').trim();
                    const itemNameLower = String(item.itemName || item.name || '').trim().toLowerCase();

                    const matchedItem = (itemSN && fullInventory[itemSN])
                        ? fullInventory[itemSN]
                        : Object.values(fullInventory).find(v => v && String(v.itemName || v.name || '').trim().toLowerCase() === itemNameLower);

                    const { isFullyCovered, unfulfilledQty, splitPlan } = calculateBatchDispatchSplit(matchedItem || {}, reqQty);

                    window.currentHandoverSplitPlans.push({
                        item,
                        matchedSN: matchedItem?.serialNumber || itemSN || 'N/A',
                        reqQty,
                        isFullyCovered,
                        unfulfilledQty,
                        splitPlan
                    });

                    html += `
                        <div class="item-dispatch-card mb-3 p-3 border rounded bg-white shadow-sm text-start">
                            <div class="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom">
                                <span class="fw-bold text-dark fs-6">${index + 1}. ${escapeHtml(item.itemName || item.name)}</span>
                                <span class="badge bg-primary fs-6">Req: ${reqQty} Pcs</span>
                            </div>
                            <div class="dispatch-breakdown bg-light p-2.5 rounded border mb-2">
                                <div class="fw-bold text-muted small mb-2 d-flex align-items-center gap-1">
                                    <i class="bi bi-box-seam me-1"></i> Dispatch Allocation Breakdown (FIFO - Oldest First):
                                </div>`;

                    if (splitPlan.length > 0) {
                        splitPlan.forEach(sp => {
                            html += `
                                <div class="d-flex justify-content-between text-sm py-1 border-bottom border-light">
                                    <span class="text-dark small"><i class="bi bi-tag-fill me-1 text-secondary"></i>Batch: <strong>${escapeHtml(sp.brand)}</strong> (SN: <code>${escapeHtml(sp.serialNumber)}</code>)</span>
                                    <span class="fw-bold text-danger text-sm">-${sp.deductQty} Pcs <small class="text-muted fw-normal">(Remaining: ${sp.remainingQtyAfter})</small></span>
                                </div>`;
                        });
                    } else {
                        html += `<div class="text-danger small py-1"><i class="bi bi-exclamation-triangle-fill me-1"></i> No active batches found for this item!</div>`;
                    }

                    html += `</div>`;

                    if (!isFullyCovered) {
                        html += `<div class="alert alert-warning py-1 px-2 mb-0 small text-danger fw-bold"><i class="bi bi-exclamation-circle-fill me-1"></i> Warning: Stock short by ${unfulfilledQty} Pcs! Insufficient inventory to fully cover request.</div>`;
                    }

                    html += `</div>`;
                });
                selectionEl.innerHTML = html;
            }
        }
    } catch (err) {
        console.error("Order fetch error:", err);
        if (selectionEl) selectionEl.innerHTML = `<div class="alert alert-danger">Failed to load order data.</div>`;
    }

    const modalEl = document.getElementById('handoverModal');
    if (modalEl) {
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();

        if (!modalEl.hasAttribute('data-listener-attached')) {
            modalEl.addEventListener('shown.bs.modal', function () {
                window.initSignaturePad('handover-signature-pad', 'clear-handover-sig');
                window.isSignatureProvided = false;
            });
            modalEl.setAttribute('data-listener-attached', 'true');
        }
    }
};

// ==================== ✅ FIXED: submitHandoverWithSignature ====================
window.submitHandoverWithSignature = async function(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    // Guard 1: Prevent double-tap execution
    if (window._handoverInProgress) {
        console.warn("Handover already in progress. Ignoring duplicate click.");
        return;
    }
    window._handoverInProgress = true;

    const completeBtn = document.getElementById('complete-order-btn');
    if (completeBtn) {
        completeBtn.disabled = true;
        completeBtn.textContent = "Processing...";
    }

    try {
        const orderId = window.activeHandoverRequestId;
        const canvas = document.getElementById('handover-signature-pad');
        const currentOrder = window.currentHandoverOrder;

        if (!orderId) {
            alert("No active order selected.");
            return;
        }

        // Guard 2: Server-side idempotency check
        const orderCheckSnap = await get(ref(db, `orders/${orderId}`));
        if (!orderCheckSnap.exists()) {
            alert("Order not found.");
            return;
        }
        const freshOrder = orderCheckSnap.val();
        if (freshOrder.stockDeducted === true) {
            alert("This order has already been completed and stock deducted.");
            const modalEl = document.getElementById('handoverModal');
            if (modalEl) bootstrap.Modal.getInstance(modalEl)?.hide();
            return;
        }

        // Determine handover signature
        let handoverSignature = null;
        const canvasIsBlank = isCanvasBlank(canvas);

        if (!canvasIsBlank) {
            handoverSignature = canvas.toDataURL('image/png');
        } else if (currentOrder && (currentOrder.teacherRequestSignature || currentOrder.signatureUrl || currentOrder.receiverSignature)) {
            handoverSignature = currentOrder.teacherRequestSignature || currentOrder.signatureUrl || currentOrder.receiverSignature;
        }

        if (!handoverSignature) {
            alert("Receiver signature is required to complete handover.");
            return;
        }

        const adminName = sessionStorage.getItem('userName') ||
                         (currentUser && currentUser.name) || 'Admin';

        window.showGlobalLoader("Processing Handover & Updating Stock...");
        showToast("Processing handover and updating stock...", "info");

        // Optional signature upload (non-blocking on failure)
        let driveSignatureUrl = handoverSignature;
        if (handoverSignature.startsWith('data:image')) {
            try {
                const compressedSig = await window.compressBase64Image(handoverSignature);
                const uploadedUrl = await uploadToGoogleDrive(compressedSig, `Handover_${orderId}.jpg`, 'admin_sig');
                if (uploadedUrl) driveSignatureUrl = uploadedUrl;
            } catch (e) {
                console.warn("Signature upload fallback:", e);
            }
        }

        const rawItems = Array.isArray(freshOrder.items) ? freshOrder.items : Object.values(freshOrder.items || {});
        const updatedItems = rawItems.map(item => ({
            itemName: item.itemName || item.name,
            serialNumber: item.serialNumber || item.batchSerialNumber || item.sn || item.itemId || item.id,
            requestQuantity: parseInt(item.requestQuantity || item.quantity || item.reqQty || 1, 10)
        }));

        // Snapshot the ORIGINAL stock (before this order is deducted) so the voucher always shows it.
        let voucherItems = null;
        try {
            const invNowSnap = await get(ref(db, 'inventory'));
            const invNow = invNowSnap.val() || {};
            const plans = window.currentHandoverSplitPlans || [];
            voucherItems = rawItems.map((it, idx) => {
                const node = _rcptFindInvNode(invNow, it);
                const before = node ? _rcptNodeQty(node) : null;
                const req = updatedItems[idx].requestQuantity;
                const issued = before !== null ? Math.min(req, before) : req;
                const plan = (plans[idx] && Array.isArray(plans[idx].splitPlan)) ? plans[idx].splitPlan : [];
                return {
                    ...it,
                    issuedQty: issued,
                    stockBefore: before,
                    stockAfter: before !== null ? Math.max(0, before - issued) : null,
                    batchInfo: plan.map(sp => `${sp.brand} (${sp.serialNumber}) x${sp.deductQty}`).join(', ')
                };
            });
        } catch (snapErr) {
            console.warn("Stock snapshot for voucher failed (voucher will use fallback):", snapErr);
        }

        // ATOMIC DEDUCTION — the ONLY place stock changes
        const orderPayload = {
            orderId: orderId,
            items: updatedItems
        };

        const deductionResult = await executeSingleStockDeduction(orderPayload);

        if (!deductionResult.success) {
            throw new Error(`Stock deduction failed: ${deductionResult.reason}`);
        }

        // Finalize order metadata with cross-compatible signature fields
        const reqSig = currentOrder?.teacherRequestSignature || currentOrder?.requesterSignature || currentOrder?.teacherSign || currentOrder?.signature || handoverSignature;
        const authSig = driveSignatureUrl || handoverSignature;

        await update(ref(db, `orders/${orderId}`), {
            handoverSignatureUrl: authSig,
            authorizedSignature: authSig,
            issuerSign: authSig,
            adminSign: authSig,
            storekeeperSign: authSig,
            teacherRequestSignature: reqSig,
            requesterSignature: reqSig,
            teacherSign: reqSig,
            signature: reqSig,
            handedOverBy: adminName,
            issuedBy: adminName,
            ...(voucherItems ? { items: sanitizeForFirebase(voucherItems) } : {}),
            status: 'Done'
        });

        const modalEl = document.getElementById('handoverModal');
        if (modalEl) {
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();
        }

        showToast("Handover Complete! FIFO Multi-Batch stock deducted.", "success");
        await logActivity("Handover Complete", `Order ${orderId} finalized by ${adminName}`);

    } catch (err) {
        console.error("Handover Crash:", err);
        alert("Transaction failed: " + err.message);
    } finally {
        window._handoverInProgress = false;
        window.hideGlobalLoader();
        if (completeBtn) {
            completeBtn.disabled = false;
            completeBtn.textContent = "Complete Handover & Close Order";
        }
    }
};

// ==================== BIOMETRIC ====================
const strToBuffer = (str) => new TextEncoder().encode(str);

window.isBiometricEnrolled = function() {
    return localStorage.getItem('biometric_enrolled') === 'true';
};

window.checkBiometricSupport = async function() {
    if (!window.PublicKeyCredential) return false;
    try {
        return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch (e) {
        return false;
    }
};

window.enrollBiometrics = async function(adecNumber) {
    if (!adecNumber) return;

    try {
        const challenge = window.crypto.getRandomValues(new Uint8Array(32));
        const userID = strToBuffer(adecNumber);

        const createCredentialOptions = {
            publicKey: {
                challenge: challenge,
                rp: { name: "Stationery Tracker System" },
                user: {
                    id: userID,
                    name: adecNumber,
                    displayName: adecNumber,
                },
                pubKeyCredParams: [{ alg: -7, type: "public-key" }, { alg: -257, type: "public-key" }],
                authenticatorSelection: {
                    authenticatorAttachment: "platform",   // fingerprint / face / phone screen lock (PIN, pattern)
                    userVerification: "required",
                    residentKey: "discouraged"
                },
                timeout: 60000,
                attestation: "none"
            }
        };

        const credential = await navigator.credentials.create(createCredentialOptions);

        if (credential) {
            localStorage.setItem('biometric_enrolled', 'true');
            localStorage.setItem('biometric_adec', adecNumber);
            localStorage.setItem('biometric_cred_id', btoa(String.fromCharCode(...new Uint8Array(credential.rawId))));
            localStorage.setItem('biometricEnabled', 'true');
            if (typeof window.syncBiometricToggles === 'function') window.syncBiometricToggles();
            showToast("Biometric login enabled!", "success");
            const modal = bootstrap.Modal.getInstance($('biometricEnrollModal'));
            if (modal) modal.hide();
        }
    } catch (err) {
        console.error("Biometric Enrollment Error:", err);
        showToast("Biometric enrollment failed.", "error");
    }
};

window.loginWithBiometrics = async function() {
    const credIdStr = localStorage.getItem('biometric_cred_id');
    const adecNumber = localStorage.getItem('biometric_adec');

    if (!credIdStr || !adecNumber) {
        showToast("Biometric data missing. Please login manually first.", "error");
        return Promise.reject("Missing data");
    }

    try {
        const challenge = window.crypto.getRandomValues(new Uint8Array(32));
        const credId = new Uint8Array(atob(credIdStr).split("").map(c => c.charCodeAt(0)));

        const getCredentialOptions = {
            publicKey: {
                challenge: challenge,
                allowCredentials: [{ id: credId, type: 'public-key' }],
                userVerification: "required",
                timeout: 60000,
            }
        };

        const assertion = await navigator.credentials.get(getCredentialOptions);

        if (assertion) {
            console.log("Biometric Auth Successful for:", adecNumber);
            localStorage.setItem('stationery_user_adec', adecNumber);
            handleUserRole(adecNumber);
            showToast(`Welcome back!`, "success");
            return Promise.resolve();
        }
    } catch (err) {
        console.error("Biometric Login Error:", err);
        showToast("Biometric authentication failed or canceled.", "error");
        return Promise.reject(err);
    }
};

window.syncBiometricToggles = function() {
    const on = window.isBiometricEnrolled() && localStorage.getItem('biometricEnabled') === 'true';
    ['biometric-toggle-admin', 'biometric-toggle-drawer', 'biometric-toggle-teacher'].forEach(id => { const e = document.getElementById(id); if (e) e.checked = on; });
    const bb = document.getElementById('biometric-login-btn');
    if (bb) bb.classList.toggle('d-none', !window.isBiometricEnrolled());
};

window.toggleBiometricAuth = async function(event) {
    const isChecked = event.target.checked;
    if (isChecked) {
        const supported = await window.checkBiometricSupport();
        if (!supported) {
            alert("Biometric / phone-lock login is not supported on this device or browser (HTTPS is required).\nهذا الجهاز أو المتصفح لا يدعم الدخول البيومتري.");
            event.target.checked = false;
            return;
        }

        const adec = localStorage.getItem('stationery_user_adec');
        if (!adec) {
            alert("Please login manually first to link your device lock.");
            event.target.checked = false;
            return;
        }

        await window.enrollBiometrics(adec);

        if (window.isBiometricEnrolled()) {
            localStorage.setItem('biometricEnabled', 'true');
            showToast("Biometric lock enabled!");
        } else {
            event.target.checked = false;
        }
    } else {
        ['biometric_enrolled', 'biometric_adec', 'biometric_cred_id'].forEach(k => localStorage.removeItem(k));
        localStorage.setItem('biometricEnabled', 'false');
        window.syncBiometricToggles();
        showToast("Biometric lock disabled.");
    }
};

// ==================== DASHBOARD NAV ====================
window.showDashboardSection = function(sectionId) {
    const sections = document.querySelectorAll('.dashboard-section');
    sections.forEach(s => s.classList.add('d-none'));

    const target = $(sectionId);
    if (target) {
        target.classList.remove('d-none');
        document.querySelectorAll('.drawer-item').forEach(btn => {
            if (btn.getAttribute('onclick')?.includes(sectionId)) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }
};

// ==================== LOGIN ====================
window.hideLoginSection = function() {
    const loginModal = document.getElementById('loginModal') ||
                       document.getElementById('loginSection') ||
                       document.getElementById('login-view') ||
                       document.querySelector('.login-container');
    if (loginModal) {
        loginModal.style.display = 'none';
        loginModal.style.visibility = 'hidden';
        loginModal.classList.add('hidden');
        loginModal.classList.add('d-none');
        loginModal.classList.remove('active');
    }

    // Ensure backdrop overlay is also removed
    const backdrops = document.querySelectorAll('.modal-backdrop, .overlay');
    backdrops.forEach(b => b.remove());
};

window.handleUserLogin = async function(event) {
    if (event) event.preventDefault();
    console.log("--> Direct On-Demand Login Triggered!");

    const passInput = $('login-pass-number');
    const passwordInput = $('login-password');
    const loginError = $('login-error');
    const loginBtn = $('login-btn');

    if (!passInput || !passwordInput) {
        alert("Critical Error: Login Input Elements not found in HTML.");
        return;
    }

    const passNumber = passInput.value.trim().toUpperCase();
    const password = passwordInput.value.trim();

    const lockedSecondsRemaining = window.checkLoginLockout();
    if (lockedSecondsRemaining > 0) {
        if (loginError) {
            loginError.classList.add('login-lockout-message');
            loginError.textContent = `🔒 Too many failed attempts. Try again in ${lockedSecondsRemaining}s. / حاولت كثيرًا، حاول مرة أخرى بعد ${lockedSecondsRemaining} ثانية.`;
        }
        return;
    }

    if (!passNumber || !password) {
        alert("⚠️ Please enter credentials.\n⚠️ يرجى إدخال بيانات الدخول.");
        return;
    }

    if (passNumber === "ASIF" && password === "Asif8013@#$") {
        console.log("Bypass Login Successful for Admin: Asif");
        window.clearLoginAttempts();
        localStorage.setItem('last_used_adec', 'Asif');
        sessionStorage.setItem('isAdminAuthenticated', 'true');
        currentUser = { role: 'ADMIN', name: 'Asif', uid: 'Asif', adecPassNumber: 'Asif' };
        localStorage.setItem('stationery_user_adec', 'Asif');
        localStorage.setItem('currentUser', JSON.stringify(currentUser));

        window.hideLoginSection();
        window.renderDashboardForRole('ADMIN', 'Asif');
        if (loginError) loginError.textContent = "";
        return;
    }

    if (loginBtn) {
        loginBtn.disabled = true;
        loginBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Authenticating...';
    }

    try {
        console.log("Attempting direct user lookup for:", passNumber);

        let userData = null;
        let matchedKey = passNumber;

        // 1. Direct On-Demand lookup by user key
        const directSnap = await get(child(ref(db), `users/${passNumber}`));
        if (directSnap.exists()) {
            userData = directSnap.val();
        } else {
            // 2. Search users node case-insensitively
            const snapshot = await get(ref(db, 'users'));
            if (snapshot.exists()) {
                const users = snapshot.val();
                matchedKey = Object.keys(users).find(key => key.toUpperCase() === passNumber.toUpperCase());
                if (matchedKey) userData = users[matchedKey];
            }
        }

        if (userData) {
            const savedPassword = String(userData.password || userData.pass || "").trim();
            const inputPassword = String(password).trim();

            if (savedPassword === inputPassword) {
                console.log("✅ On-Demand Login Successful for:", matchedKey);
                window.clearLoginAttempts();
                localStorage.setItem('last_used_adec', matchedKey);
                localStorage.setItem('stationery_user_adec', matchedKey);

                const role = userData.role || 'TEACHER';
                currentUser = {
                    role: role,
                    name: userData.name || matchedKey,
                    uid: matchedKey,
                    adecPassNumber: matchedKey
                };
                localStorage.setItem('currentUser', JSON.stringify(currentUser));

                window.hideLoginSection();
                if (loginError) loginError.textContent = "";
                window.renderDashboardForRole(role, matchedKey);

                const isEnrolled = window.isBiometricEnrolled();
                const isSupported = await window.checkBiometricSupport();
                if (!isEnrolled && isSupported) {
                    const enrollModal = new bootstrap.Modal($('biometricEnrollModal'));
                    enrollModal.show();
                    if ($('enable-biometric-btn')) {
                        $('enable-biometric-btn').onclick = () => window.enrollBiometrics(matchedKey);
                    }
                }
            } else {
                const lockSecs = window.registerFailedLoginAttempt();
                if (lockSecs > 0) {
                    alert(`🔒 Too many failed attempts. Login locked for ${Math.ceil(lockSecs/60)} minute(s).\n🔒 محاولات فاشلة كثيرة. تم قفل الدخول لمدة ${Math.ceil(lockSecs/60)} دقيقة.`);
                } else {
                    alert("⚠️ Incorrect Password. Please try again.\n⚠️ كلمة المرور غير صحيحة. يرجى المحاولة مرة أخرى.");
                }
            }
        } else {
            const lockSecs = window.registerFailedLoginAttempt();
            if (lockSecs > 0) {
                alert(`🔒 Too many failed attempts. Login locked for ${Math.ceil(lockSecs/60)} minute(s).\n🔒 محاولات فاشلة كثيرة. تم قفل الدخول لمدة ${Math.ceil(lockSecs/60)} دقيقة.`);
            } else {
                alert("⚠️ ADEK Pass Number not found. Please check your credentials or contact administrator.\n⚠️ رقم البطاقة غير موجود. يرجى التحقق من البيانات أو الاتصال بالمسؤول.");
            }
        }
    } catch (error) {
        console.error("Login Error:", error);
        alert("Login failed: " + error.message);
    } finally {
        if (loginBtn) {
            loginBtn.disabled = false;
            loginBtn.textContent = "Login to Dashboard";
        }
    }
};

window.handleUserLogout = function(event) {
    if (event) event.preventDefault();
    // keep the device's fingerprint / face / phone-lock enrollment and the saved notification history
    const keep = {};
    ['biometric_enrolled','biometric_adec','biometric_cred_id','biometricEnabled'].forEach(k => { const v = localStorage.getItem(k); if (v !== null) keep[k] = v; });
    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('stationery_notifs_') || k.startsWith('stationery_notif_seen_'))) keep[k] = localStorage.getItem(k);
    }
    const token = localStorage.getItem('fcm_token_current');
    const tokenUid = localStorage.getItem('fcm_token_uid');

    const finish = () => {
        localStorage.clear();
        sessionStorage.clear();
        Object.entries(keep).forEach(([k, v]) => localStorage.setItem(k, v));
        location.reload();
    };

    // Stop pushes for this user on this device after logout (shared phones)
    if (token && tokenUid) {
        Promise.race([
            remove(ref(db, `fcm_tokens/${tokenUid}/${token}`)).catch(() => {}),
            new Promise(r => setTimeout(r, 1500))
        ]).finally(finish);
    } else {
        finish();
    }
};

window.safeShowView = function(viewIdToShow) {
    if (viewIdToShow === 'login-view') document.body.classList.remove('teacher-mode');
    if (viewIdToShow !== 'login-view') {
        window.hideLoginSection();
    }
    const allViews = document.querySelectorAll('.view, .dashboard-view');

    let targetFound = false;
    allViews.forEach(view => {
        if (view) {
            if (view.id === viewIdToShow) {
                view.classList.add('active');
                view.classList.remove('d-none');
                view.classList.remove('hidden');
                view.style.display = 'flex';
                view.style.visibility = 'visible';
                view.style.opacity = '1';
                targetFound = true;
            } else {
                view.classList.remove('active');
                view.classList.add('d-none');
                view.style.display = 'none';
            }
        }
    });

    if (!targetFound) {
        console.warn(`Target view #${viewIdToShow} not found! Fallback to login-view`);
        const fallbackView = $('login-view');
        if (fallbackView) {
            fallbackView.classList.add('active');
            fallbackView.classList.remove('d-none');
            fallbackView.classList.remove('hidden');
            fallbackView.style.display = 'flex';
            fallbackView.style.visibility = 'visible';
        }
    }
};

window.addEventListener('error', function(e) {
    console.error("Global JS Error caught:", e.error);
    // Preserves active dashboard view cleanly without forcing redirect to teacher view
});

// ==================== CATEGORIES ====================
window.fetchCategories = function() {
    if (typeof window.listenAndPopulateCategories === 'function') {
        window.listenAndPopulateCategories();
        return;
    }

    onValue(ref(db, 'settings/categories'), (snapshot) => {
        const dropdowns = document.querySelectorAll('#item-category-dropdown, .category-select-element');
        let options = '<option value="" disabled selected>Select Category</option>';
        if (snapshot.exists()) {
            const data = snapshot.val();
            Object.values(data).forEach(name => {
                options += `<option value="${name}">${name}</option>`;
            });
        }
        options += '<option value="Other">Other (Custom)</option>';
        dropdowns.forEach(el => { if (el) el.innerHTML = options; });
    });
};

window.addEventListener('wheel', function(e) {
    e.stopPropagation();
}, { passive: true });

window.addEventListener('touchmove', function(e) {
    e.stopPropagation();
}, { passive: true });

window.forceGlobalScrollUnlock = function() {
    document.documentElement.style.overflow = 'auto';
    document.body.style.overflow = 'auto';
    document.body.style.overflowY = 'auto';
    document.body.style.position = 'relative';
    document.body.style.height = 'auto';
    document.body.style.touchAction = 'pan-y';
    document.body.classList.remove('modal-open');

    const openModals = document.querySelectorAll('.modal.show');
    if (openModals.length === 0) {
        document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
    }
};

window.wipeScrollLocks = function() {
    document.documentElement.removeAttribute('style');
    document.body.classList.remove('modal-open');

    ['overflow', 'overflow-y', 'position', 'height', 'max-height', 'touch-action'].forEach(prop => {
        document.body.style.removeProperty(prop);
        document.documentElement.style.removeProperty(prop);
    });

    const backdrops = document.querySelectorAll('.modal-backdrop');
    if (!document.querySelector('.modal.show')) {
        backdrops.forEach(b => b.remove());
    }

    document.documentElement.style.overflowY = 'auto';
    document.body.style.overflowY = 'auto';
    document.body.style.pointerEvents = 'auto';
};

setInterval(() => {
    if (!document.querySelector('.modal.show') && document.body.classList.contains('modal-open')) {
        window.wipeScrollLocks();
    }
}, 1000);

// ==================== GOOGLE DRIVE CONNECTOR ====================
function initDriveConnector() {
    onValue(ref(db, 'settings/driveScriptUrl'), (snapshot) => {
        const scriptUrl = snapshot.val();
        if (scriptUrl) {
            window.GOOGLE_SCRIPT_URL = scriptUrl;
            localStorage.setItem('driveScriptUrl', scriptUrl);
            const urlInput = $('drive-script-url-input');
            if (urlInput) urlInput.value = scriptUrl;

            checkDriveConnectionHealth(scriptUrl);
        } else {
            updateDriveUIStatus(false, "URL Not Configured");
        }
    });
}

window.saveDriveScriptUrl = async function() {
    const inputEl = $('drive-script-url-input');
    const newUrl = inputEl ? inputEl.value.trim() : '';

    if (!newUrl.startsWith('https://script.google.com')) {
        alert("Please enter a valid Google Apps Script Web App URL.");
        return;
    }

    try {
        await set(ref(db, 'settings/driveScriptUrl'), newUrl);
        alert("Google Drive Connector URL saved globally! Connection established 24/7.");
        checkDriveConnectionHealth(newUrl);
    } catch (err) {
        console.error("Failed to save Drive URL:", err);
        alert("Database write error: " + err.message);
    }
};

window.checkDriveConnectionHealth = async function(scriptUrl) {
    const statusEl = $('drive-connection-status');
    if (!scriptUrl || !scriptUrl.startsWith('https://script.google.com')) {
        if (statusEl) statusEl.innerHTML = `<span class="badge bg-danger">🔴 Invalid URL</span>`;
        return;
    }
    if (statusEl) statusEl.innerText = "Checking...";

    try {
        const response = await fetch(scriptUrl, { method: 'GET', mode: 'no-cors' });
        if (response.type === 'opaque' || response.ok) {
            updateDriveUIStatus(true, "Active (24/7)");
        } else {
            updateDriveUIStatus(false, "Connection Warning");
        }
    } catch (err) {
        console.warn("Drive connection warning (non-critical):", err.message);
        updateDriveUIStatus(false, "Offline / Error");
    }
};

function updateDriveUIStatus(isConnected, message) {
    const statusEl = $('drive-connection-status');
    if (!statusEl) return;

    if (isConnected) {
        statusEl.innerHTML = `<span class="badge bg-success">🟢 ${message}</span>`;
    } else {
        statusEl.innerHTML = `<span class="badge bg-danger">🔴 ${message}</span>`;
    }
}

async function uploadToGoogleDrive(base64Image, fileName, folderType = 'product') {
    const url = window.GOOGLE_SCRIPT_URL || localStorage.getItem('driveScriptUrl');
    if (!url) {
        alert("Google Drive Connector URL missing! Please save valid URL in Admin Settings.");
        return null;
    }

    try {
        console.log(`Compressing and uploading photo (${folderType}) to Google Drive...`);
        const compressed = await window.compressBase64Image(base64Image);

        const payload = {
            image: compressed,
            filename: fileName || `Item_${Date.now()}.jpg`,
            folderType: folderType // 'product' | 'teacher_sig' | 'admin_sig'
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (result.status === 'success') {
            return result.fileUrl;
        } else {
            console.error("Drive upload failed:", result.message);
            return null;
        }
    } catch (error) {
        console.error("Google Drive Fetch Error:", error);
        return null;
    }
}
window.uploadToGoogleDrive = uploadToGoogleDrive;
window.uploadPhotoToGoogleDrive = uploadToGoogleDrive;

// ==================== SEED / CART ====================
async function seedDefaultCategoriesIfEmpty() {
    const categoriesRef = ref(db, 'settings/categories');
    const snapshot = await get(categoriesRef);
    if (!snapshot.exists()) {
        console.log("No categories found. Seeding all 27 default stationery categories...");
        for (const cat of ALL_STATIONERY_CATEGORIES) {
            await push(categoriesRef, cat);
        }
    }
}

window.updateCartBadge = function() {
    const count = window.stationeryCart.reduce((sum, item) => sum + item.requestQuantity, 0);
    const badge = $('cart-count');
    if (badge) badge.textContent = count;
};

window.saveCartToStorage = function() {
    localStorage.setItem('teacherStationeryCart', JSON.stringify(window.stationeryCart));
    window.updateCartBadge();
};

window.loadCartFromStorage = function() {
    const savedCart = localStorage.getItem('teacherStationeryCart');
    if (savedCart) {
        window.stationeryCart = JSON.parse(savedCart);
        window.updateCartBadge();
    }
};

window.renderCartModalItems = function() {
    const container = document.getElementById('cart-items-container');
    if (!container) {
        console.error("Cart container #cart-items-container not found!");
        return;
    }
    const cart = window.stationeryCart || [];

    if (cart.length === 0) {
        container.innerHTML = `<div class="text-center py-4"><p class="text-muted fs-5 mb-0">🛒 Your cart is empty.</p></div>`;
        return;
    }

    let html = '<ul class="list-group list-group-flush">';
    cart.forEach((item, index) => {
        const unitLabel = item.unit || 'Pcs';
        html += `<li class="list-group-item d-flex justify-content-between align-items-center py-3 flex-wrap gap-2">
            <div class="d-flex align-items-center gap-3">
                <img src="${item.imageUrl || item.image || FALLBACK_IMG}" class="cart-item-img" onerror="this.onerror=null; this.src='${FALLBACK_IMG}';">
                <div>
                    <h6 class="mb-0 fw-bold text-dark">${escapeHtml(item.itemName || 'Stationery Item')}</h6>
                    <small class="text-muted">SN: ${escapeHtml(item.serialNumber || 'N/A')}</small>
                </div>
            </div>
            <div class="d-flex align-items-center gap-2 ms-auto">
                <div class="qty-counter-container">
                    <button class="btn btn-outline-secondary btn-sm fw-bold" style="width: 32px; height: 32px; padding: 0;" onclick="window.updateCartQty(${index}, -1)">-</button>
                    <input type="text" class="cart-qty-input qty-counter-input" value="${item.requestQuantity || 1}" readonly>
                    <button class="btn btn-outline-secondary btn-sm fw-bold" style="width: 32px; height: 32px; padding: 0;" onclick="window.updateCartQty(${index}, 1)">+</button>
                </div>
                <span class="fw-bold small text-muted me-2">${escapeHtml(unitLabel)}</span>
                <button class="btn btn-outline-danger btn-sm" onclick="window.removeFromCart(${index})" title="Remove item">🗑️</button>
            </div>
        </li>`;
    });
    html += '</ul>';

    container.innerHTML = html;
};

function makeModalDraggable(modalHeaderId, modalDialogId) {
    const header = document.getElementById(modalHeaderId);
    const dialog = document.querySelector(modalDialogId);
    if (!header || !dialog) return;

    let isDragging = false, startX, startY, initialLeft, initialTop;

    header.onmousedown = function(e) {
        if (window.innerWidth < 768) return; // Disable drag on small touch screens
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;

        const rect = dialog.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;

        dialog.style.position = 'fixed';
        dialog.style.margin = '0';
        dialog.style.left = initialLeft + 'px';
        dialog.style.top = initialTop + 'px';

        document.onmousemove = function(e) {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            dialog.style.left = (initialLeft + dx) + 'px';
            dialog.style.top = (initialTop + dy) + 'px';
        };

        document.onmouseup = function() {
            isDragging = false;
            document.onmousemove = null;
            document.onmouseup = null;
        };
    };
}
window.makeModalDraggable = makeModalDraggable;

document.getElementById('cartModal')?.addEventListener('shown.bs.modal', function () {
    makeModalDraggable('cartModalHeader', '#cartModal .modal-dialog');
});

window.openCartModal = function(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }

    console.log("Opening Cart Modal...");

    try {
        window.renderCartModalItems();
    } catch (err) {
        console.error("Error rendering cart items:", err);
    }

    document.querySelectorAll('.modal-backdrop').forEach(b => b.remove());

    const modalEl = document.getElementById('cartModal');
    if (modalEl) {
        const modalInstance = bootstrap.Modal.getOrCreateInstance(modalEl);
        modalInstance.show();

        setTimeout(() => {
            if (!modalEl.classList.contains('show')) {
                modalEl.classList.add('show');
                modalEl.style.display = 'block';
                document.body.classList.add('modal-open');
            }
        }, 100);
    } else {
        alert("Error: Cart modal HTML element missing!");
    }
};

window.showCartModal = window.openCartModal;

window.hideCartModal = function() {
    const modalEl = document.getElementById('cartModal');
    if (modalEl) {
        const modalInstance = bootstrap.Modal.getInstance(modalEl);
        if (modalInstance) modalInstance.hide();
        modalEl.classList.remove('show');
        modalEl.style.display = 'none';
        window.wipeScrollLocks();
    }
};

window.updateCartQty = function(index, delta) {
    const item = window.stationeryCart[index];
    if (!item) return;

    let newQty = (item.requestQuantity || 1) + delta;
    if (newQty < 1) return;

    const catalogItem = (window.allCatalogItems || []).find(c => c.id === item.id);
    const totalStock = catalogItem ? getItemTotalAvailableStock(catalogItem.data) : (parseInt(item.quantity) || 999);

    if (newQty > totalStock) {
        showToast(`Only ${totalStock} Pcs currently available in total stock.`, "warning");
        return;
    }

    item.requestQuantity = newQty;
    window.saveCartToStorage();
    window.renderCartModalItems();
};

window.removeFromCart = function(index) {
    window.stationeryCart.splice(index, 1);
    window.saveCartToStorage();
    window.renderCartModalItems();
};

window.clearCart = function() {
    if (window.stationeryCart.length === 0) return;
    if (confirm("Are you sure you want to clear all items from your cart?")) {
        window.stationeryCart = [];
        window.saveCartToStorage();
        window.renderCartModalItems();
    }
};

window.submitCartOrder = function() {
    if (window.stationeryCart.length === 0) {
        showToast("Your cart is empty", "error");
        return;
    }
    const modalEl = document.getElementById('cartModal');
    if (modalEl) {
        const modalInstance = bootstrap.Modal.getInstance(modalEl);
        if (modalInstance) modalInstance.hide();
    }
    submitRequisitionRequest();
};

// ==================== MAIN LIFECYCLE ====================
document.addEventListener('DOMContentLoaded', () => {
    console.log("App Initialized");
    window.initStationeryRain();
    window.updateFcmUIStatus();
    window.loadCartFromStorage();
    seedDefaultCategoriesIfEmpty();
    initDriveConnector();
    listenAndPopulateCategories();

    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            if (typeof window.handleUserLogin === 'function') {
                window.handleUserLogin(e);
            }
        });
    }

    // Password show/hide toggle (v1.8.87 - Login UX Enhancement)
    const pwToggleBtn = $('toggle-password-visibility');
    if (pwToggleBtn) {
        pwToggleBtn.addEventListener('click', () => {
            const pwInput = $('login-password');
            if (!pwInput) return;
            const isHidden = pwInput.type === 'password';
            pwInput.type = isHidden ? 'text' : 'password';
            pwToggleBtn.innerHTML = isHidden ? '<i class="bi bi-eye-slash"></i>' : '<i class="bi bi-eye"></i>';
            pwToggleBtn.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
        });
    }

    // Remember last-used ADEK Pass Number for faster re-login (v1.8.87)
    const passNumberInput = $('login-pass-number');
    const lastUsedAdec = localStorage.getItem('last_used_adec');
    if (passNumberInput && lastUsedAdec && !passNumberInput.value) {
        passNumberInput.value = lastUsedAdec;
    }

    // Show remaining lockout time on load, if currently locked out
    const initialLockSecs = window.checkLoginLockout ? window.checkLoginLockout() : 0;
    if (initialLockSecs > 0) {
        const loginErrorEl = $('login-error');
        if (loginErrorEl) {
            loginErrorEl.classList.add('login-lockout-message');
            loginErrorEl.textContent = `🔒 Too many failed attempts. Try again in ${initialLockSecs}s. / حاولت كثيرًا، حاول مرة أخرى بعد ${initialLockSecs} ثانية.`;
        }
    }

    window.addEventListener('resize', () => {
        window.forceGlobalScrollUnlock();
        window.initStationeryRain();
    });

    const directAdminBtn = document.getElementById('direct-admin-btn') || document.querySelector('.btn-purple') || document.querySelector('.quick-access-btn') || document.querySelector('[data-admin-trigger]');
    if (directAdminBtn) {
        directAdminBtn.addEventListener('click', window.openAdminModal);
        directAdminBtn.addEventListener('touchstart', (e) => {
            window.openAdminModal(e);
        }, { passive: false });
    }

    const submitAdminDirectBtn = document.getElementById('submit-admin-direct-btn');
    if (submitAdminDirectBtn) {
        submitAdminDirectBtn.onclick = window.submitAdminDirectLogin;
    }

    const bioBtn = $('biometric-login-btn');
    if (bioBtn) {
        window.checkBiometricSupport().then(supported => {
            const enrolled = window.isBiometricEnrolled();
            if (supported && enrolled) {
                bioBtn.classList.remove('d-none');
                bioBtn.onclick = () => window.loginWithBiometrics().catch(() => {});
            }
        });
    }

    const devCreateAccountForm = $('dev-create-account-form');
    if (devCreateAccountForm) {
        devCreateAccountForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = devCreateAccountForm.querySelector('button[type="submit"]');
            const name = $('dev-name').value.trim();
            const adec = $('dev-adec-number').value.trim().toUpperCase();
            const pass = $('dev-password').value.trim();
            const role = $('dev-role').value;

            if (!name || !adec || !pass || !role) return;

            btn.disabled = true;
            const originalText = btn.textContent;
            btn.textContent = "Creating...";

            try {
                await set(ref(db, 'users/' + adec), {
                    name: name,
                    adecPassNumber: adec,
                    password: pass,
                    role: role,
                    createdAt: new Date().toISOString()
                });
                showToast("Account created successfully!");
                devCreateAccountForm.reset();
            } catch (err) {
                console.error("Account Creation Error:", err);
                showToast("Failed to create account: " + err.message, "error");
            } finally {
                btn.disabled = false;
                btn.textContent = originalText;
            }
        });
    }

    const adminCreateTeacherForm = $('admin-create-teacher-form');
    if (adminCreateTeacherForm) {
        adminCreateTeacherForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = adminCreateTeacherForm.querySelector('button[type="submit"]');
            const name = $('admin-name').value.trim();
            const adec = $('admin-adec-number').value.trim().toUpperCase();
            const pass = $('admin-password').value.trim();

            if (!name || !adec || !pass) return;

            btn.disabled = true;
            const originalText = btn.textContent;
            btn.textContent = "Provisioning...";

            try {
                await set(ref(db, 'users/' + adec), {
                    name: name,
                    adecPassNumber: adec,
                    password: pass,
                    role: 'TEACHER',
                    designation: (window.getProvisionDesignation ? window.getProvisionDesignation() : 'Teacher'),
                    createdAt: new Date().toISOString()
                });
                showToast("Staff account provisioned!");
                adminCreateTeacherForm.reset();
                if (window.resetProvisionDesignation) window.resetProvisionDesignation();
            } catch (err) {
                console.error("Teacher Creation Error:", err);
                showToast("Error: " + err.message, "error");
            } finally {
                btn.disabled = false;
                btn.textContent = originalText;
            }
        });
    }

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register(`./sw.js?v=${APP_VERSION}`)
                .then(reg => {
                    console.log('SW Registered successfully:', reg.scope);
                    reg.update();
                })
                .catch(err => console.warn('ServiceWorker registration failed:', err));
        });
    }

    const inventoryForm = $('add-inventory-form');
    const categorySelect = $('item-category-dropdown');
    const serialNumberInput = $('inv-serial-number');
    const cartBtn = $('cart-btn');
    if (cartBtn) {
        cartBtn.addEventListener('click', window.openCartModal);
        cartBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            window.openCartModal();
        }, { passive: false });
    }

    const closeCartBtn = $('close-cart-btn');
    if (closeCartBtn) closeCartBtn.addEventListener('click', window.hideCartModal);
    const submitRequisitionBtn = $('submit-requisition-btn');
    const stationerySearch = $('stationery-search');
    const adminInventorySearch = $('admin-inventory-search');
    const btnExportFullExcel = $('btnExportFullExcel');
    const btnPrintMasterReport = $('btnPrintMasterReport');
    const exportHistoryBtn = $('export-history-btn');
    const exportAuditBtn = $('export-audit-ledger-btn');
    const closeNotificationBtn = $('close-notification-btn');
    const closeHandoverModalBtn = $('close-handover-modal-btn');
    const closeOrderDetailBtn = $('close-order-detail-btn');
    const closeItemDetailBtn = $('close-item-detail-btn');
    const startScanBtn = $('start-scan-btn');
    const closeScannerBtn = $('close-scanner-btn');

    const ocrTriggerBtns = document.querySelectorAll('.btn-ocr-trigger');
    const ocrSnapBtn = $('ocr-snap-btn');
    const closeOcrBtn = $('close-ocr-btn');

    const sideDrawer = $('side-drawer');
    const drawerOverlay = $('drawer-overlay');
    const closeDrawerBtn = $('close-drawer-btn');
    const hamburgers = [$('dev-hamburger'), $('admin-hamburger'), $('teacher-hamburger')];

    const toggleDrawer = (open) => {
        if (open) {
            sideDrawer.classList.add('open');
            drawerOverlay.classList.add('active');
        } else {
            sideDrawer.classList.remove('open');
            drawerOverlay.classList.remove('active');
        }
    };

    hamburgers.forEach(h => h?.addEventListener('click', () => toggleDrawer(true)));
    closeDrawerBtn?.addEventListener('click', () => toggleDrawer(false));
    drawerOverlay?.addEventListener('click', () => toggleDrawer(false));

    document.querySelectorAll('.drawer-item[data-target]').forEach(item => {
        item.addEventListener('click', () => {
            const targetId = item.dataset.target;
            document.querySelectorAll('.drawer-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            document.querySelectorAll('.admin-tab').forEach(tab => tab.classList.remove('active'));
            const targetTab = $(targetId);
            if (targetTab) targetTab.classList.add('active');
            toggleDrawer(false);
            window.scrollTo({ top: 0, behavior: 'auto' });
        });
    });

    $('drawer-cart-btn')?.addEventListener('click', () => {
        toggleDrawer(false);
        window.showCartModal();
    });

    $('drawer-history-btn')?.addEventListener('click', () => {
        toggleDrawer(false);
        window.scrollTo({ top: $('teacher-history-area')?.offsetTop - 100, behavior: 'smooth' });
    });

    $('bypass-admin-btn')?.addEventListener('click', window.openAdminModal);

    const savedAdec = localStorage.getItem('stationery_user_adec');
    const bioEnabled = localStorage.getItem('biometricEnabled') === 'true';
    const savedUserRaw = localStorage.getItem('currentUser');
    const savedUser = savedUserRaw ? JSON.parse(savedUserRaw) : null;
    const savedRole = (savedUser?.role || localStorage.getItem('currentUserRole') || sessionStorage.getItem('userRole') || '').toUpperCase();

    const adminToggle = $('biometric-toggle-admin');
    const teacherToggle = $('biometric-toggle-drawer');
    if (adminToggle) adminToggle.checked = bioEnabled;
    if (teacherToggle) teacherToggle.checked = bioEnabled;

    if (savedAdec) {
        if (savedAdec === 'Asif' || savedAdec === 'ASIF' || savedRole === 'ADMIN' || savedRole === 'ADMINISTRATOR') {
            currentUser = savedUser || {
                role: 'ADMIN',
                name: 'Asif',
                uid: savedAdec,
                adecPassNumber: savedAdec
            };
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            localStorage.setItem('currentUserRole', 'ADMIN');
            sessionStorage.setItem('userRole', 'ADMIN');
            window.renderDashboardForRole('ADMIN', savedAdec);
        } else if (savedAdec === 'DEV001' || savedRole === 'DEVELOPER' || savedRole === 'SUPER_ADMIN') {
            currentUser = savedUser || {
                role: 'DEVELOPER',
                name: 'Developer Mode',
                uid: 'DEV001',
                adecPassNumber: 'DEV001'
            };
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            localStorage.setItem('currentUserRole', 'DEVELOPER');
            sessionStorage.setItem('userRole', 'DEVELOPER');
            window.renderDashboardForRole('DEVELOPER', savedAdec);
        } else if (bioEnabled) {
            window.loginWithBiometrics().catch(err => {
                console.warn("Initial biometric unlock failed/canceled.");
                handleUserRole(savedAdec);
            });
        } else {
            handleUserRole(savedAdec);
        }
    }
    else showView('login-view');

    const editInventoryForm = $('edit-inventory-form');
    if (editInventoryForm) {
        editInventoryForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const itemId = $('edit-item-id').value;
            const itemName = $('edit-item-name').value.trim();
            const itemCategory = $('edit-item-category').value.trim();
            const openingQuantity = parseInt($('edit-item-opening-qty').value) || 0;
            const quantity = parseInt($('edit-item-available-qty').value) || 0;
            const description = $('edit-item-description').value.trim();

            const submitBtn = editInventoryForm.querySelector('button[type="submit"]');
            submitBtn.disabled = true;

            try {
                await update(ref(db, 'inventory/' + itemId), {
                    itemName,
                    category: itemCategory,
                    openingQuantity,
                    quantity,
                    availableStock: quantity,
                    currentStock: quantity,
                    stock: quantity,
                    description
                });
                await logActivity("Inventory Updated", `Item: ${itemName} (${itemId})`);
                showToast("Item updated successfully!");
                bootstrap.Modal.getInstance($('editItemModal')).hide();
            } catch (err) {
                showToast("Update failed: " + err.message, "error");
            } finally {
                submitBtn.disabled = false;
            }
        });
    }

    $('btn-show-provision')?.addEventListener('click', () => {
        $('staff-provision-view').style.display = 'block';
        $('staff-list-view').style.display = 'none';
        $('btn-show-provision').classList.add('active');
        $('btn-show-directory').classList.remove('active');
    });

    $('btn-show-directory')?.addEventListener('click', () => {
        $('staff-provision-view').style.display = 'none';
        $('staff-list-view').style.display = 'block';
        $('btn-show-provision').classList.remove('active');
        $('btn-show-directory').classList.add('active');
        fetchStaffList();
    });

    if (inventoryForm) inventoryForm.addEventListener('submit', saveInventoryItem);
    ['input', 'change', 'blur'].forEach(ev => $('inv-serial-number')?.addEventListener(ev, () => window.updateDupSerialBanner()));
    // scanners fill the serial without firing events, so also poll lightly while the Add Item tab is open
    setInterval(() => { if ($('tab-add-item')?.classList.contains('active')) window.updateDupSerialBanner(); }, 1000);

    const addStockForm = $('add-stock-form');
    if (addStockForm) {
        addStockForm.addEventListener('submit', handleAddStockBatch);
    }

    if (categorySelect) categorySelect.onchange = () => {
        window.handleCategorySelectionForForm(categorySelect.value);
    };
    if (serialNumberInput) serialNumberInput.oninput = () => {
        const serial = serialNumberInput.value.trim();
        if (serial) { try { JsBarcode("#barcode", serial, { format: "CODE128", displayValue: true, fontSize: 16 }); } catch (e) { } }
        else $('barcode').innerHTML = '';
    };

    if (submitRequisitionBtn) submitRequisitionBtn.onclick = submitRequisitionRequest;

    if (stationerySearch) {
        let t;
        stationerySearch.oninput = (e) => {
            clearTimeout(t);
            t = setTimeout(() => {
                catalogState.searchTerm = e.target.value.toLowerCase().trim();
                catalogState.currentPage = 1; resetCatalog();
            }, 250);
        };
    }
    if (adminInventorySearch) adminInventorySearch.oninput = (e) => {
        adminInventoryState.searchTerm = e.target.value.toLowerCase().trim();
        adminInventoryState.currentPage = 1; renderMasterInventory();
    };

    if (closeNotificationBtn) closeNotificationBtn.onclick = () => $('notification-modal')?.classList.remove('active');
    if (closeHandoverModalBtn) closeHandoverModalBtn.onclick = () => $('handover-modal')?.classList.remove('active');
    if (closeOrderDetailBtn) closeOrderDetailBtn.onclick = () => $('order-detail-modal')?.classList.remove('active');
    if (closeItemDetailBtn) closeItemDetailBtn.onclick = () => $('item-detail-modal')?.classList.remove('active');

    if (startScanBtn) startScanBtn.onclick = () => { $('qr-scanner-modal').classList.add('active'); initScanner(); };
    if (closeScannerBtn) closeScannerBtn.onclick = stopScanner;

    ocrTriggerBtns.forEach(btn => {
        btn.onclick = () => { currentOcrTarget = btn.dataset.target; startOcrCamera(); };
    });
    if (ocrSnapBtn) ocrSnapBtn.onclick = () => {
        const video = $('ocr-video');
        const canvas = $('ocr-canvas');
        if (!video || !video.srcObject) return;

        const vw = video.videoWidth;
        const vh = video.videoHeight;
        canvas.width = vw;
        canvas.height = vh;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(video, 0, 0, vw, vh);

        runOcrScan(canvas);
    };
    if (closeOcrBtn) closeOcrBtn.onclick = stopOcrCamera;

    if (btnExportFullExcel) btnExportFullExcel.onclick = () => window.exportFullInventoryReport();
    if (btnPrintMasterReport) btnPrintMasterReport.onclick = () => window.printInventoryReport();
    if (exportHistoryBtn) exportHistoryBtn.onclick = exportHistory;
    if (exportAuditBtn) exportAuditBtn.onclick = exportAuditLedgerToExcel;

    const auditFilterTeacher = $('audit-filter-teacher');
    const auditFilterItem = $('audit-filter-item');
    const auditFilterCategory = $('audit-filter-category');
    const auditFilterDate = $('audit-filter-date');

    [auditFilterTeacher, auditFilterItem, auditFilterCategory, auditFilterDate].forEach(el => {
        if (el) el.addEventListener('input', applyAuditFilters);
    });

    $('teacherSearchInput')?.addEventListener('input', (e) => {
        renderTeacherAnalyticsTable(e.target.value);
    });

    const invFilterCategory = $('inventory-filter-category');
    if (invFilterCategory) invFilterCategory.addEventListener('change', () => {
        adminInventoryState.currentPage = 1;
        renderMasterInventory();
    });

    const openAdminNotifications = () => {
        notifFilter = 'all';
        snapshotFreshNotifications();
        renderNotificationList();
        const el = $('notificationModal');
        if (el) bootstrap.Modal.getOrCreateInstance(el).show();
        markAllNotificationsRead();
    };
    // The bell button id is "bellBtn" (old code looked for "notification-bell", so the bell did nothing)
    $('bellBtn')?.addEventListener('click', openAdminNotifications);
    $('notification-bell')?.addEventListener('click', openAdminNotifications);


    $('ocr-file-fallback')?.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width; canvas.height = img.height;
                canvas.getContext('2d').drawImage(img, 0, 0);
                runOcrScan(canvas);
            };
        };
        reader.readAsDataURL(file);
    });

    adminPad = setupResponsiveSignaturePad('admin-canvas');
    teacherPad = setupResponsiveSignaturePad('teacher-canvas');

    $('clear-admin-sig-btn')?.addEventListener('click', () => { if (adminPad) adminPad.clear(); });
    $('clear-teacher-sig-btn')?.addEventListener('click', () => { if (teacherPad) teacherPad.clear(); });
    $('clear-handover-sig')?.addEventListener('click', () => { if (handoverPad) handoverPad.clear(); });

    const teacherSigModal = document.getElementById('teacher-signature-modal');
    if (teacherSigModal) {
        teacherSigModal.addEventListener('shown.bs.modal', () => {
            teacherRequestPad = setupResponsiveSignaturePad('teacher-request-canvas');
        });
    }
});

// ==================== NOTIFICATIONS ====================
// In-app notifications (bell list + popup). Background/closed-app push is sent by the
// Cloud Function in /functions (see README). Both use the SAME eventKey so nothing shows twice.
const NOTIF_MAX = 60;
let orderWatcherSeeded = false;
const orderPrevStatus = new Map();

function notifUserId() {
    return fcmSafeKey((currentUser && (currentUser.adecPassNumber || currentUser.uid)) || 'guest');
}
function loadNotifications() {
    try { notificationsList = JSON.parse(localStorage.getItem('stationery_notifs_' + notifUserId()) || '[]') || []; }
    catch (e) { notificationsList = []; }
}
function saveNotifications() {
    try { localStorage.setItem('stationery_notifs_' + notifUserId(), JSON.stringify(notificationsList.slice(0, NOTIF_MAX))); } catch (e) { }
}
function getSeenKeys() {
    try { return new Set(JSON.parse(localStorage.getItem('stationery_notif_seen_' + notifUserId()) || '[]')); }
    catch (e) { return new Set(); }
}
function rememberSeenKey(key) {
    const seen = getSeenKeys();
    seen.add(key);
    const arr = Array.from(seen).slice(-300);
    try { localStorage.setItem('stationery_notif_seen_' + notifUserId(), JSON.stringify(arr)); } catch (e) { }
}

// ---------- Advanced Notification Center (v2.2.0) ----------
// Shared by the Admin bell (Bootstrap modal) and the Teacher bell (bottom sheet).
const NOTIF_TYPES = {
    new:       { icon: '🆕', label: 'New Order',  cat: 'orders', color: '#2563eb' },
    submitted: { icon: '📝', label: 'Submitted',  cat: 'orders', color: '#0891b2' },
    approved:  { icon: '📦', label: 'Ready',      cat: 'orders', color: '#f59e0b' },
    done:      { icon: '✅', label: 'Completed',  cat: 'orders', color: '#16a34a' },
    stock:     { icon: '📥', label: 'Stock',      cat: 'stock',  color: '#7c3aed' },
    system:    { icon: '🔔', label: 'Update',     cat: 'system', color: '#64748b' }
};
let notifFilter = 'all';
let notifFreshIds = new Set(); // ids that were unread when the center was opened (kept highlighted)

function inferNotifMeta(n) {
    const key = String(n.key || '');
    let type = n.type, orderId = n.orderId;
    const m = key.match(/^(new|submitted|approved|done)_(.+)_(admin|teacher)$/);
    if (m) { type = type || m[1]; orderId = orderId || m[2]; }
    if (!type && /^inv_/.test(key)) type = 'stock';
    if (!type) {
        const t = String(n.title || '').toLowerCase();
        type = /stock|item added|batch/.test(t) ? 'stock' : 'system';
    }
    return { type: NOTIF_TYPES[type] ? type : 'system', orderId: orderId || null };
}

function showNotificationPopup(title, body, meta) {
    // Non-blocking slide-in banner (replaces the old full-screen popup). Tap = open the notification center.
    let box = document.getElementById('nc-toast');
    if (!box) {
        box = document.createElement('div');
        box.id = 'nc-toast';
        box.className = 'nc-toast';
        document.body.appendChild(box);
        box.addEventListener('click', () => {
            box.classList.remove('show');
            const bell = document.getElementById('bellBtn') || document.getElementById('bellB');
            if (bell) bell.click();
        });
    }
    const info = NOTIF_TYPES[(meta && meta.type) || 'system'] || NOTIF_TYPES.system;
    box.innerHTML = `<div class="nc-toast-ico" style="background:${info.color}22;color:${info.color}">${info.icon}</div>
        <div class="nc-toast-main"><b>${escapeHtml(title)}</b><span>${escapeHtml(body)}</span></div>`;
    box.classList.add('show');
    clearTimeout(box._t);
    box._t = setTimeout(() => box.classList.remove('show'), 6500);
    try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch (e) { }
}

function pushInAppNotification({ key, title, body, popup = true, type, orderId }) {
    key = key || `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    if (getSeenKeys().has(key)) return false; // already shown (dedupe push vs realtime)
    rememberSeenKey(key);

    if (!notificationsList.length) loadNotifications();
    const entry = { id: Date.now() + Math.random(), key, title, message: body, ts: Date.now(), read: false, type, orderId };
    const meta = inferNotifMeta(entry);
    entry.type = meta.type; entry.orderId = meta.orderId;
    notificationsList.unshift(entry);
    notificationsList = notificationsList.slice(0, NOTIF_MAX);
    saveNotifications();
    updateNotificationBadge();
    renderNotificationList();

    if (popup) showNotificationPopup(title, body, meta);
    return true;
}

function addSystemNotification(title, message) {
    pushInAppNotification({ title, body: message, popup: false });
}

function updateNotificationBadge() {
    const unread = notificationsList.filter(n => !n.read).length;
    const label = unread > 99 ? '99+' : String(unread);

    const badgeEl = $('notif-badge'); // admin bell
    if (badgeEl) {
        badgeEl.textContent = label;
        badgeEl.classList.toggle('d-none', unread === 0);
        badgeEl.style.display = ''; // let the class decide
    }
    const dot = $('notif-dot'); // teacher bell
    if (dot) {
        dot.textContent = label;
        dot.style.display = unread === 0 ? 'none' : '';
    }
}

// Called when the center is opened: remember what was unread (so it stays highlighted), then clear the badge.
function snapshotFreshNotifications() {
    notifFreshIds = new Set(notificationsList.filter(n => !n.read).map(n => String(n.id)));
}
window.snapshotFreshNotifications = snapshotFreshNotifications;

function markAllNotificationsRead() {
    notificationsList.forEach(n => { n.read = true; });
    saveNotifications();
    updateNotificationBadge();
}
window.markAllNotificationsRead = markAllNotificationsRead;

window.clearAllNotifications = function() {
    notificationsList = [];
    notifFreshIds = new Set();
    saveNotifications();
    renderNotificationList();
    updateNotificationBadge();
};

function fmtNotifTime(ts) {
    try { return new Date(ts).toLocaleString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }
    catch (e) { return ''; }
}

function fmtNotifAgo(ts) {
    const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
    if (s < 45) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + ' min ago';
    if (s < 86400) return Math.floor(s / 3600) + ' h ago';
    return fmtNotifTime(ts);
}

function notifDayLabel(ts) {
    const d = new Date(ts), t = new Date();
    const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    if (sameDay(d, t)) return 'Today';
    const y = new Date(); y.setDate(t.getDate() - 1);
    if (sameDay(d, y)) return 'Yesterday';
    return d.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
}

function buildNotificationCenterHTML() {
    const list = notificationsList.map(n => ({ n, meta: inferNotifMeta(n) }));
    const isUnread = (n) => !n.read || notifFreshIds.has(String(n.id));
    const todayCount = list.filter(x => notifDayLabel(x.n.ts) === 'Today').length;
    const unreadCount = list.filter(x => isUnread(x.n)).length;
    const counts = {
        all: list.length,
        unread: unreadCount,
        orders: list.filter(x => NOTIF_TYPES[x.meta.type].cat === 'orders').length,
        stock: list.filter(x => NOTIF_TYPES[x.meta.type].cat === 'stock').length
    };
    const chips = [['all', 'All'], ['unread', 'Unread'], ['orders', 'Orders'], ['stock', 'Stock']]
        .map(([k, label]) => `<button type="button" class="nc-chip ${notifFilter === k ? 'on' : ''}" data-nc="filter" data-v="${k}">${label}<i>${counts[k]}</i></button>`).join('');

    const shown = list.filter(x => {
        if (notifFilter === 'unread') return isUnread(x.n);
        if (notifFilter === 'orders') return NOTIF_TYPES[x.meta.type].cat === 'orders';
        if (notifFilter === 'stock') return NOTIF_TYPES[x.meta.type].cat === 'stock';
        return true;
    });

    let body = '';
    if (!shown.length) {
        body = `<div class="nc-empty"><div class="nc-empty-ico">🔕</div><b>${list.length ? 'Nothing in this filter' : 'No notifications yet'}</b><span>${list.length ? 'Try another tab above.' : 'Order updates and stock alerts will appear here.'}</span></div>`;
    } else {
        let lastDay = '';
        shown.forEach(({ n, meta }) => {
            const day = notifDayLabel(n.ts);
            if (day !== lastDay) { body += `<div class="nc-day">${escapeHtml(day)}</div>`; lastDay = day; }
            const info = NOTIF_TYPES[meta.type];
            const unread = isUnread(n);
            body += `<div class="nc-item ${unread ? 'unread' : ''}" data-nid="${escapeHtml(String(n.id))}">
                <div class="nc-ico" style="background:${info.color}22;color:${info.color}">${info.icon}</div>
                <div class="nc-main">
                    <div class="nc-top"><b>${escapeHtml(n.title)}</b><span class="nc-time" title="${escapeHtml(fmtNotifTime(n.ts))}">${escapeHtml(fmtNotifAgo(n.ts))}</span></div>
                    <div class="nc-msg">${escapeHtml(n.message)}</div>
                    <div class="nc-meta">
                        <span class="nc-tag" style="background:${info.color}1f;color:${info.color}">${info.label}</span>
                        ${meta.orderId ? `<span class="nc-tag nc-id">${escapeHtml(meta.orderId)}</span><button type="button" class="nc-link" data-nc="view" data-order="${escapeHtml(meta.orderId)}">View voucher →</button>` : ''}
                    </div>
                </div>
                <button type="button" class="nc-x" data-nc="dismiss" data-nid="${escapeHtml(String(n.id))}" aria-label="Dismiss">✕</button>
            </div>`;
        });
    }

    return `<div class="nc-wrap">
        <div class="nc-summary">
            <div><b>${unreadCount}</b><span>Unread</span></div>
            <div><b>${todayCount}</b><span>Today</span></div>
            <div><b>${list.length}</b><span>Total</span></div>
        </div>
        <div class="nc-tools">
            <div class="nc-chips">${chips}</div>
            <div class="nc-actions">
                <button type="button" class="nc-tbtn" data-nc="markall">✓ Mark all read</button>
                <button type="button" class="nc-tbtn danger" data-nc="clear">🗑 Clear all</button>
            </div>
        </div>
        <div class="nc-list">${body}</div>
    </div>`;
}

function renderNotificationList() {
    const html = buildNotificationCenterHTML();
    const adminBox = $('notification-list-container');
    if (adminBox) adminBox.innerHTML = html;
    const teacherBox = $('notificationsBody');
    if (teacherBox) teacherBox.innerHTML = html;
}

function closeNotificationCenters() {
    try { const m = $('notificationModal'); if (m) bootstrap.Modal.getInstance(m)?.hide(); } catch (e) { }
    document.querySelectorAll('#user-view-container .sheet.on, #user-view-container .drawer.on, #user-view-container .ov.on')
        .forEach(el => el.classList.remove('on'));
}

// One delegated click handler for both centers
document.addEventListener('click', (ev) => {
    const el = ev.target.closest && ev.target.closest('[data-nc]');
    if (!el) return;
    const act = el.dataset.nc;
    if (act === 'filter') { notifFilter = el.dataset.v || 'all'; renderNotificationList(); }
    else if (act === 'markall') { notifFreshIds = new Set(); markAllNotificationsRead(); renderNotificationList(); }
    else if (act === 'clear') { if (confirm('Clear all notifications?')) window.clearAllNotifications(); }
    else if (act === 'dismiss') {
        const id = el.dataset.nid;
        notificationsList = notificationsList.filter(n => String(n.id) !== id);
        notifFreshIds.delete(id);
        saveNotifications(); updateNotificationBadge(); renderNotificationList();
    } else if (act === 'view') {
        const orderId = el.dataset.order;
        closeNotificationCenters();
        setTimeout(() => window.viewOrderReceipt(orderId), 300);
    }
});

// One realtime watcher for both roles. Only changes AFTER the first load pop up.
function startOrderEventWatcher() {
    if (!currentUser) return;
    loadNotifications();
    updateNotificationBadge();
    renderNotificationList();
    orderWatcherSeeded = false;
    orderPrevStatus.clear();

    const isTeacher = String(currentUser.role || '').toUpperCase() === 'TEACHER';
    const myId = String(currentUser.adecPassNumber || currentUser.uid || '');

    addListener(ref(db, 'orders'), (snapshot) => {
        const data = snapshot.val() || {};
        const seeded = orderWatcherSeeded;

        Object.entries(data).forEach(([id, o]) => {
            if (!o) return;
            const status = String(o.status || '');
            const prev = orderPrevStatus.get(id);
            orderPrevStatus.set(id, status);
            if (prev === status) return;

            const isPending = status === 'Pending Approval';
            const isApproved = /approved|ready/i.test(status) && !/done|completed/i.test(status);
            const isDone = /done|completed/i.test(status);
            // On first load only surface actionable items (no flood of old completed orders)
            if (!seeded && isDone) return;

            if (isTeacher) {
                if (String(o.teacherUid) !== myId) return;
                if (isPending) {
                    pushInAppNotification({ key: `submitted_${id}_teacher`, popup: seeded,
                        title: 'Order Submitted',
                        body: `Your order ${id} has been submitted. Please wait for admin approval.` });
                } else if (isApproved) {
                    pushInAppNotification({ key: `approved_${id}_teacher`, popup: seeded,
                        title: 'Your Order is Ready!',
                        body: `Your items are ready. Please collect them from: ${o.pickupLocation || 'the stationery store'}.` });
                } else if (isDone) {
                    pushInAppNotification({ key: `done_${id}_teacher`, popup: seeded,
                        title: 'Handover Confirmed',
                        body: `Order ${id} was handed over and signed. Thank you!` });
                }
            } else {
                if (isPending) {
                    pushInAppNotification({ key: `new_${id}_admin`, popup: seeded,
                        title: 'New Order Received',
                        body: `Order ${id} from ${o.teacherName || 'a teacher'} is waiting for approval.` });
                } else if (isDone) {
                    pushInAppNotification({ key: `done_${id}_admin`, popup: seeded,
                        title: 'Handover Confirmed',
                        body: `Order ${id} was handed over to ${o.teacherName || 'the teacher'} and confirmed.` });
                }
            }
        });
        orderWatcherSeeded = true;
    });
}
const listenForNewOrders = startOrderEventWatcher; // backwards-compatible name

// ==================== ROLE / DASHBOARD ====================
window.renderDashboardForRole = function(userRole, adecNumber) {
    if (typeof window.hideLoginSection === 'function') {
        window.hideLoginSection();
    }
    if (typeof window.startIdleSessionTimer === 'function') {
        window.startIdleSessionTimer();
    }
    document.querySelectorAll('.view, .dashboard-view').forEach(container => {
        container.classList.remove('active');
        container.classList.add('d-none');
        container.style.display = 'none';
    });

    const sidebar = $('side-drawer');
    if (sidebar) {
        sidebar.classList.remove('d-none');
        sidebar.style.display = 'flex';
        const overlay = $('drawer-overlay');
        if (overlay) { overlay.classList.remove('active'); overlay.style.display = ''; }
        sidebar.classList.remove('open');
    }

    const roleUpper = String(userRole).toUpperCase();
    document.body.classList.toggle('teacher-mode', roleUpper === 'TEACHER');
    if (roleUpper === 'TEACHER') {
        ['side-drawer', 'drawer-overlay'].forEach(id => { const e = $(id); if (e) { e.style.display = 'none'; e.classList.remove('open', 'active'); } });
    }
    if (roleUpper !== 'TEACHER') {
        const nm = (currentUser && (currentUser.name || currentUser.adecPassNumber)) || 'Admin';
        const dn = $('admin-drawer-name'); if (dn) dn.textContent = nm;
        const dr = $('admin-drawer-role'); if (dr) dr.textContent = (roleUpper === 'DEVELOPER' || roleUpper === 'SUPER_ADMIN') ? 'Developer' : 'Administrator';
        const dv = $('admin-drawer-av'); if (dv) dv.textContent = String(nm).split(' ').map(x => x[0]).join('').substring(0, 2).toUpperCase();
    }
    if ($('admin-menu')) $('admin-menu').style.display = (roleUpper === 'ADMIN' || roleUpper === 'DEVELOPER' || roleUpper === 'SUPER_ADMIN') ? 'flex' : 'none';
    if ($('teacher-menu')) $('teacher-menu').style.display = roleUpper === 'TEACHER' ? 'flex' : 'none';

    console.log("Current Logged-in Role:", userRole);

    if (roleUpper === 'DEVELOPER' || roleUpper === 'SUPER_ADMIN') {
        const devContainer = $('developer-dashboard-container');
        if (devContainer) {
            devContainer.classList.remove('d-none');
            devContainer.classList.add('active');
            devContainer.style.display = 'flex';
            fetchAuditLogs();
            if (typeof loadDeveloperDashboard === 'function') loadDeveloperDashboard();
        }
    } else if (roleUpper === 'ADMIN') {
        const adminContainer = $('admin-dashboard-container');
        if (adminContainer) {
            adminContainer.classList.remove('d-none');
            adminContainer.classList.add('active');
            adminContainer.style.display = 'flex';

            const adminNameEl = $('admin-display-name');
            if (adminNameEl) adminNameEl.innerText = `Admin: ${currentUser?.name || 'Asif'}`;

            initAdminDashboards();
            startOrderEventWatcher();
            window.initPushForSession();
        }
    } else if (roleUpper === 'TEACHER') {
        safeShowView('user-view-container');
        window.initNewTeacherDashboard(adecNumber);
        startOrderEventWatcher();
        window.initPushForSession();
    } else {
        showView('login-view');
    }
};

window.initNewTeacherDashboard = function(adecNumber) {
    try {
        const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
        let teacherContainer = document.getElementById('user-view-container') || document.querySelector('#user-view-container') || document.querySelector('.dashboard-container') || document.body;
        if (!teacherContainer) {
            console.warn("⚠️ #user-view-container not found, using fallback container.");
        }

        teacherContainer.classList.remove('d-none');
        teacherContainer.classList.add('active');
        teacherContainer.style.display = 'flex';
        teacherContainer.style.visibility = 'visible';
        teacherContainer.style.opacity = '1';

        const name = currentUser?.name || 'Abdulaziz Alali';
        const adec = adecNumber || currentUser?.adecPassNumber || currentUser?.uid || 'PASS203011';
        const initials = name.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase();

        const nameEl = document.getElementById('teacher-display-name');
        const idEl = document.getElementById('teacher-display-id');
        const drawerNameEl = document.getElementById('drawer-display-name');
        const drawerIdEl = document.getElementById('drawer-display-id');
        const av1 = document.getElementById('teacher-avatar-init');
        const av2 = document.getElementById('drawer-avatar-init');

        if (nameEl) nameEl.innerText = name;
        if (idEl) idEl.innerText = `Employee ID: ${adec}`;
        if (drawerNameEl) drawerNameEl.innerText = name;
        if (drawerIdEl) drawerIdEl.innerText = adec;
        if (av1) av1.innerText = initials;
        if (av2) av2.innerText = initials;
        if (typeof window.syncBiometricToggles === 'function') window.syncBiometricToggles();

        let P = [];
        const buildP = () => {
            const raw = (window.masterInventoryList && window.masterInventoryList.length > 0)
                ? window.masterInventoryList
                : (typeof getFlatInventoryList === 'function' ? getFlatInventoryList() : []);
            return raw.map(item => [
                item.itemName || item.name || 'Stationery Item',
                item.category || 'General',
                String(item.serialNumber || item.batchNo || 'N/A'),
                parseInt(item.currentStock ?? item.currentQty ?? item.quantity ?? item.totalAvailableStock ?? 0, 10) || 0,
                item.unit || 'Pcs',
                item.emoji || '📦',
                item.color || '#eef2fb',
                item
            ]);
        };
        P = buildP();

        let cart={}, cat="All";

        const cats=["All",...new Set(P.map(p=>p[1]))];
        const chipsEl = $("#chips");
        if (chipsEl) {
            chipsEl.innerHTML = cats.map(c=>`<button class="chip${c==="All"?" on":""}">${c}</button>`).join("");
            chipsEl.onclick = e => {
                const c = e.target.closest(".chip");
                if (!c) return;
                cat = c.textContent;
                $$("#chips .chip").forEach(x=>x.classList.toggle("on", x===c));
                renderCatalogGrid();
            };
        }

        function renderCatalogGrid() {
            try {
                const qEl = $("#q");
                const t = qEl ? qEl.value.toLowerCase() : "";
                const l = P.map((p,i)=>[p,i]).filter(([p])=>(cat==="All"||p[1]===cat)&&(p[0].toLowerCase().includes(t)||p[2].toLowerCase().includes(t)));
                const gridEl = $("#grid");
                if (gridEl) {
                    gridEl.innerHTML = l.length ? l.map(([p,i])=>{
                        const itemObj = (typeof p[7] === 'object' && p[7] !== null) ? p[7] : {};
                        const rawImg = itemObj.imageUrl || itemObj.image || itemObj.photoUrl || itemObj.photo || itemObj.itemImageUrl || itemObj.photoBase64 || itemObj.url || (typeof p[7] === 'string' && p[7].startsWith('http') ? p[7] : '');

                        let mediaHtml = '';
                        if (rawImg && isValidImageUrl(rawImg)) {
                            const imgSrc = typeof getDirectDriveUrl === 'function' ? getDirectDriveUrl(rawImg) : rawImg;
                            mediaHtml = `
                                <div class="card-img-wrapper" style="aspect-ratio: 4/3; width: 100%; background: ${p[6] || '#f8f9fa'}; display: flex; align-items: center; justify-content: center; position: relative; overflow: hidden; border-radius: 12px 12px 0 0;">
                                    <img src="${escapeHtml ? escapeHtml(imgSrc) : imgSrc}"
                                         data-src="${escapeHtml ? escapeHtml(imgSrc) : imgSrc}"
                                         alt="${escapeHtml ? escapeHtml(p[0] || 'Stationery Item') : p[0]}"
                                         class="product-card-img"
                                         referrerpolicy="no-referrer"
                                         decoding="async"
                                         loading="lazy"
                                         style="width: 100%; height: 100%; object-fit: contain; display: block;"
                                         onerror="window.handleProductImageError(this)" />
                                </div>`;
                        } else {
                            console.warn(`[Catalog] Product "${p[0]}" (SN: ${p[2]}) has no valid image URL.`);
                            mediaHtml = `
                                <div class="pic" style="aspect-ratio: 4/3; width: 100%; background: ${p[6] || '#fef3c7'}; display: grid; place-items: center; font-size: 56px; border-radius: 12px 12px 0 0;">
                                    ${p[5] || '📦'}
                                </div>`;
                        }

                        return `
                        <article class="p" data-i="${i}" data-name="${escapeHtml(p[0])}" data-sn="${escapeHtml(p[2])}">
                            ${mediaHtml}
                            <div class="pb">
                                <span class="tag">${escapeHtml ? escapeHtml(p[1]) : p[1]}</span>
                                <div class="pn">${escapeHtml ? escapeHtml(p[0]) : p[0]}</div>
                                <div class="sn">SN: <b>${escapeHtml ? escapeHtml(p[2]) : p[2]}</b></div>
                                <span class="av-b${p[3]<5?" low":""}">${p[3]<5?"Low stock: ":"Available: "}${p[3]} ${p[4]}</span>
                                <button class="add" data-i="${i}">🛒 Add to Cart</button>
                            </div>
                        </article>`;
                    }).join("") : `<div class="empty">No items match your search.</div>`;
                }
            } catch (err) {
                console.error("❌ Error in renderCatalogGrid:", err);
            }
        }

        const count=()=>Object.values(cart).reduce((a,b)=>a+b,0);
        function upd(){
            const cc=document.getElementById("cc");
            const dn=document.getElementById("dn");
            const cVal=count();
            if (cc) cc.textContent = cVal;
            if (dn) dn.textContent = cVal;
        }

        function cartR(){
            const k=Object.keys(cart);
            const cb=$("#cartBody");
            if (cb) {
                cb.innerHTML = k.length ? k.map(i=>`
                    <div class="ci">
                        <span class="e" style="background:${P[i][6]}">${P[i][5]}</span>
                        <div class="t">${P[i][0]}</div>
                        <div class="qty">
                            <button data-m="${i}" aria-label="Less">−</button>
                            <b>${cart[i]}</b>
                            <button data-p="${i}" aria-label="More">+</button>
                        </div>
                    </div>`).join("") : `<div class="empty">Your cart is empty.</div>`;
            }
            const ts=$("#toSign");
            if (ts) ts.disabled = !k.length;
        }

        const ov=$("#ov");
        function closeAll(){$$(".sheet,.drawer").forEach(e=>e.classList.remove("on")); if(ov) ov.classList.remove("on");}
        function openSheet(el){closeAll(); if(el) el.classList.add("on"); if(ov) ov.classList.add("on");}
        if (ov) ov.onclick = closeAll;
        $$("[data-close]").forEach(b=>b.onclick = closeAll);

        const menuB=$("#menuB");
        if (menuB) menuB.onclick = () => openSheet($("#drawer"));

        const bellB=$("#bellB");
        if (bellB) bellB.onclick = () => { notifFilter = 'all'; snapshotFreshNotifications(); renderNotificationList(); openSheet($("#noteS")); markAllNotificationsRead(); };

        const cartB=$("#cartB");
        if (cartB) cartB.onclick = () => { cartR(); openSheet($("#cartS")); };

        const grid=$("#grid");
        if (grid) {
            grid.onclick = e => {
                const b = e.target.closest(".add");
                if (!b) return;
                const i = b.dataset.i;
                cart[i] = (cart[i] || 0) + 1;
                upd();
                b.textContent = "✓ Added";
                setTimeout(() => b.textContent = "🛒 Add to Cart", 700);
            };
        }

        const qInput = $("#q");
        if (qInput) qInput.oninput = renderCatalogGrid;

        const cartBody = $("#cartBody");
        if (cartBody) {
            cartBody.onclick = e => {
                const m = e.target.dataset.m, p = e.target.dataset.p;
                if (m !== undefined && --cart[m] <= 0) delete cart[m];
                if (p !== undefined) cart[p]++;
                upd();
                cartR();
            };
        }

        function view(v){
            const vCat=$("#vCat"), vHist=$("#vHist");
            if (vCat) vCat.hidden = (v === "hist");
            if (vHist) vHist.hidden = (v !== "hist");
            $$(".nav").forEach(n=>n.classList.toggle("on", n.dataset.go === (v==="hist"?"hist":"cat")));
        }

        $$(".nav").forEach(n => {
            n.onclick = () => {
                const g = n.dataset.go;
                if (g === "cart") {
                    cartR();
                    openSheet($("#cartS"));
                } else {
                    closeAll();
                    view(g === "hist" ? "hist" : "cat");
                }
            };
        });

        const pad = $("#pad");
        if (pad) {
            const cx = pad.getContext("2d");
            let draw = false, signed = false, padW = 300, padH = 190, zoom = 1, panMode = false;
            const BASE_H = 190, pts = new Map();
            let pinch = null;
            const SC = Math.min(4, (window.devicePixelRatio || 1) * 2);   // extra resolution so zoomed strokes stay sharp
            const zLbl = () => { const l = $("#zoomLbl"); if (l) l.textContent = Math.round(zoom * 100) + "%"; };
            function applyZoom(z){
                zoom = Math.max(1, Math.min(4, z));
                pad.style.width = (zoom * 100) + "%";
                pad.style.height = (BASE_H * zoom) + "px";
                zLbl();
            }
            function setPan(on){
                panMode = on;
                pad.style.touchAction = on ? "pan-x pan-y" : "none";
                const pb = $("#panBtn"); if (pb) { pb.classList.toggle("on", on); pb.setAttribute("aria-pressed", on ? "true" : "false"); }
            }
            function fit(){
                applyZoom(1); setPan(false);
                const r = pad.getBoundingClientRect();
                padW = r.width; padH = r.height;
                pad.width = Math.round(r.width * SC);
                pad.height = Math.round(r.height * SC);
                cx.setTransform(SC, 0, 0, SC, 0, 0);
                cx.lineCap = "round"; cx.lineJoin = "round";
                cx.strokeStyle = "#0f1a3a";
            }
            // pointer -> canvas coordinates (works at any zoom level)
            const pos = e => { const r = pad.getBoundingClientRect(); return [(e.clientX - r.left) * padW / r.width, (e.clientY - r.top) * padH / r.height, padW / r.width]; };
            pad.onpointerdown = e => {
                pts.set(e.pointerId, e);
                if (pts.size === 2) {                       // two fingers = pinch zoom
                    draw = false;
                    const [p1, p2] = [...pts.values()];
                    pinch = { d: Math.hypot(p1.clientX - p2.clientX, p1.clientY - p2.clientY) || 1, z: zoom };
                    return;
                }
                if (panMode) return;
                draw = true;
                pad.setPointerCapture(e.pointerId);
                const [x, y, k] = pos(e);
                cx.lineWidth = 2.5 * k;                     // stroke keeps the same look on screen, finer when zoomed in
                cx.beginPath(); cx.moveTo(x, y);
            };
            pad.onpointermove = e => {
                if (pts.has(e.pointerId)) pts.set(e.pointerId, e);
                if (pinch && pts.size === 2) {
                    const [p1, p2] = [...pts.values()];
                    applyZoom(pinch.z * Math.hypot(p1.clientX - p2.clientX, p1.clientY - p2.clientY) / pinch.d);
                    return;
                }
                if (!draw) return;
                const [x, y] = pos(e);
                cx.lineTo(x, y); cx.stroke();
                signed = true;
                const conf = $("#conf"); if (conf) conf.disabled = false;
            };
            const padUp = e => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; draw = false; };
            pad.onpointerup = padUp;
            pad.onpointercancel = padUp;
            const zIn = $("#zIn"), zOut = $("#zOut"), zRes = $("#zReset"), pBtn = $("#panBtn");
            if (zIn) zIn.onclick = () => applyZoom(zoom * 1.25);
            if (zOut) zOut.onclick = () => applyZoom(zoom / 1.25);
            if (zRes) zRes.onclick = () => { applyZoom(1); const w = $("#padWrap"); if (w) { w.scrollLeft = 0; w.scrollTop = 0; } };
            if (pBtn) pBtn.onclick = () => setPan(!panMode);

            const clr = $("#clr");
            if (clr) clr.onclick = () => { cx.save(); cx.setTransform(1, 0, 0, 1, 0, 0); cx.clearRect(0, 0, pad.width, pad.height); cx.restore(); signed = false; const conf = $("#conf"); if(conf) conf.disabled = true; };

            const toSign = $("#toSign");
            const openSignPad = () => {
                const signN = $("#signN");
                if (signN) signN.textContent = count();
                openSheet($("#signS"));
                fit();
                if (clr) clr.click();
            };
            if (toSign) toSign.onclick = async () => {
                // v2.3.0: returning staff -> verify (biometric / password) and auto-attach the saved signature
                try {
                    const saved = await window.getSavedSignature(adec);
                    if (saved && window.confirmSavedSignatureUse) {
                        window.confirmSavedSignatureUse(adec, saved, {
                            onUse: () => { window.__useSavedSig = saved; const c = $("#conf"); if (c && c.onclick) c.onclick(); },
                            onResign: () => openSignPad()
                        });
                        return;
                    }
                } catch (e) { console.warn("Saved signature check failed:", e); }
                openSignPad();
            };

            const conf = $("#conf");
            if (conf) {
                conf.onclick = async () => {
                    if (Object.keys(cart).length === 0) return;
                    const useSaved = window.__useSavedSig || null; window.__useSavedSig = null;
                    const signatureDataUrl = useSaved || pad.toDataURL();
                    const orderId = 'ORD-' + Date.now();

                    const items = Object.keys(cart).map(i => {
                        const prod = P[i];
                        return {
                            itemId: prod[7]?.id || prod[2],
                            itemName: prod[0],
                            serialNumber: prod[2],
                            requestQuantity: cart[i],
                            unit: prod[4],
                            imageUrl: prod[7]?.imageUrl || ''
                        };
                    });

                    try {
                        window.showGlobalLoader?.("Submitting Order...");
                        const orderData = {
                            orderId,
                            teacherUid: adec,
                            teacherName: name,
                            timestamp: new Date().toISOString(),
                            items,
                            status: 'Pending Approval',
                            teacherRequestSignature: signatureDataUrl,
                            teacherSign: signatureDataUrl,
                            signature: signatureDataUrl,
                            pickupLocation: "Awaiting Admin Details",
                            requestedAt: new Date().toISOString(),
                            stockDeducted: false
                        };

                        const cleanOrderData = typeof sanitizeForFirebase === 'function' ? sanitizeForFirebase(orderData) : orderData;
                        await set(ref(db, 'orders/' + orderId), cleanOrderData);
                        if (!useSaved && window.saveUserSignature) window.saveUserSignature(adec, signatureDataUrl); // remember for next time
                        await logActivity?.("Order Placed", `ID: ${orderId}, ${items.length} items`);

                        cart = {};
                        upd();
                        closeAll();

                        const toast = $("#toast");
                        if (toast) {
                            toast.classList.add("on");
                            setTimeout(() => toast.classList.remove("on"), 2200);
                        }

                        if (typeof fetchTeacherOrderHistory === 'function') {
                            fetchTeacherOrderHistory(adec);
                        }
                    } catch (err) {
                        console.error("Order submit error:", err);
                        alert("Error submitting order: " + err.message);
                    } finally {
                        window.hideGlobalLoader?.();
                    }
                };
            }
        }

        if (typeof fetchInventory === 'function') fetchInventory();
        if (typeof fetchTeacherOrderHistory === 'function') fetchTeacherOrderHistory(adec);

        // Re-render when Firebase inventory arrives / changes (fixes photos & items not showing)
        window.refreshTeacherCatalog = () => {
            try {
                P = buildP();
                const cs = ["All", ...new Set(P.map(p => p[1]))];
                if (!cs.includes(cat)) cat = "All";
                const ce = $("#chips");
                if (ce) ce.innerHTML = cs.map(c => `<button class="chip${c === cat ? " on" : ""}">${c}</button>`).join("");
                renderCatalogGrid();
            } catch (err) { console.error("refreshTeacherCatalog error:", err); }
        };
        renderCatalogGrid();
    } catch (e) {
        console.error("❌ Error in initNewTeacherDashboard:", e);
    }
};

window.renderTeacherDashboard = function() {
    const grid = document.getElementById('productGrid') || document.querySelector('.products-grid') || document.getElementById('grid');
    if (grid) {
        grid.style.display = 'grid';
        grid.style.visibility = 'visible';
        grid.style.opacity = '1';
    }
    if (typeof renderCatalogGrid === 'function') renderCatalogGrid();
    if (typeof loadProducts === 'function') loadProducts();
};

async function handleUserRole(adecNumber) {
    try {
        const snapshot = await get(child(ref(db), `users/${adecNumber}`));
        if (snapshot.exists()) {
            const userData = snapshot.val();
            const role = userData.role || 'TEACHER';
            currentUser = { uid: adecNumber, ...userData, role: role };

            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            localStorage.setItem('currentUserRole', role);
            sessionStorage.setItem('userRole', role);

            fetchSystemBranding(); fetchCategories();

            if ("Notification" in window) Notification.requestPermission();

            window.renderDashboardForRole(role, adecNumber);
        } else {
            const savedUserRaw = localStorage.getItem('currentUser');
            const savedUser = savedUserRaw ? JSON.parse(savedUserRaw) : null;
            const savedRole = (savedUser?.role || localStorage.getItem('currentUserRole') || sessionStorage.getItem('userRole') || '').toUpperCase();

            if (savedRole === 'ADMIN' || adecNumber === 'Asif' || adecNumber === 'ASIF') {
                window.renderDashboardForRole('ADMIN', adecNumber);
            } else if (savedRole === 'DEVELOPER' || adecNumber === 'DEV001') {
                window.renderDashboardForRole('DEVELOPER', adecNumber);
            } else {
                localStorage.removeItem('stationery_user_adec');
                showView('login-view');
            }
        }
    } catch (e) {
        console.error("Role Handling Error:", e);
        const savedUserRaw = localStorage.getItem('currentUser');
        const savedUser = savedUserRaw ? JSON.parse(savedUserRaw) : null;
        const savedRole = (savedUser?.role || localStorage.getItem('currentUserRole') || sessionStorage.getItem('userRole') || '').toUpperCase();

        if (savedRole === 'ADMIN' || adecNumber === 'Asif' || adecNumber === 'ASIF') {
            window.renderDashboardForRole('ADMIN', adecNumber);
        } else if (savedRole === 'DEVELOPER' || adecNumber === 'DEV001') {
            window.renderDashboardForRole('DEVELOPER', adecNumber);
        } else {
            showView('login-view');
        }
    }
}

function showView(viewId) {
    window.safeShowView(viewId);
    window.scrollTo(0, 0);
}

async function logActivity(action, details) {
    const user = currentUser ? (currentUser.name || currentUser.adecPassNumber) : "System";
    try { await push(ref(db, 'audit_logs'), { timestamp: new Date().toISOString(), user, action, details }); } catch (e) { }
}

// ==================== ✅ NEW: INVENTORY MIGRATION ====================
/**
 * ONE-TIME MIGRATION: Ensures all inventory nodes have consistent
 * quantity / availableStock / currentStock / stock fields.
 */
async function migrateInventoryFieldAliases() {
    try {
        const invSnap = await get(ref(db, 'inventory'));
        if (!invSnap.exists()) return;

        const inventory = invSnap.val();
        const updates = {};

        Object.entries(inventory).forEach(([catId, catData]) => {
            if (!catData || typeof catData !== 'object') return;

            let canonicalQty = parseInt(
                catData.quantity ?? catData.availableStock ??
                catData.currentStock ?? catData.stock ?? 0,
                10
            );

            if (catData.batches && typeof catData.batches === 'object') {
                const batchSum = Object.values(catData.batches).reduce(
                    (sum, b) => sum + (parseInt(b?.currentStock ?? b?.quantity ?? 0, 10) || 0),
                    0
                );
                if (batchSum > 0 || canonicalQty === 0) {
                    canonicalQty = batchSum;
                }
            }

            const needsSync =
                catData.quantity !== canonicalQty ||
                catData.availableStock !== canonicalQty ||
                catData.currentStock !== canonicalQty ||
                catData.stock !== canonicalQty;

            if (needsSync) {
                updates[`${catId}/quantity`] = canonicalQty;
                updates[`${catId}/availableStock`] = canonicalQty;
                updates[`${catId}/currentStock`] = canonicalQty;
                updates[`${catId}/stock`] = canonicalQty;
            }
        });

        if (Object.keys(updates).length > 0) {
            await update(ref(db, 'inventory'), updates);
            console.log(`✅ Migrated ${Object.keys(updates).length / 4} inventory nodes`);
        }
    } catch (e) {
        console.warn("Migration failed (non-critical):", e);
    }
}
window.migrateInventoryFieldAliases = migrateInventoryFieldAliases;

function initAdminDashboards() {
    try { fetchAdminOrders(); } catch (e) { }
    try { fetchMasterInventory(); } catch (e) { }
    try { fetchOrderHistoryForAnalytics(); } catch (e) { }
    try { fetchStaffList(); } catch (e) { }
    try { updateDriveStatus(); } catch (e) { }
    try { fetchAuditLedger(); } catch (e) { }
    try { migrateInventoryFieldAliases(); } catch (e) { }
}

function loadDeveloperDashboard() {
    console.log("Initializing Developer Tools...");
    try { fetchAuditLogs(); } catch (e) { }
    try { updateDriveStatus(); } catch (e) { }
}

// ==================== CATALOG ====================
function getTeacherGroupedCatalog(rawInventoryData) {
    const teacherMap = new Map();

    Object.entries(rawInventoryData || {}).forEach(([catId, catData]) => {
        if (!catData) return;

        const category = (catData.category || catData.itemCategory || assignCategoryToItem(catData)).trim();
        let itemName = (catData.itemName || catData.name || catId).trim();

        const batches = catData.batches || {};
        const batchEntries = Object.entries(batches);

        // Safety Fix: If itemName was saved identically to category name, resolve real product name
        if (itemName.toLowerCase() === category.toLowerCase()) {
            if (batchEntries.length > 0 && batchEntries[0][1].itemName) {
                itemName = batchEntries[0][1].itemName.trim();
            } else if (catData.description && catData.description.trim() !== category) {
                itemName = catData.description.trim().split('.')[0];
            }
        }

        const mainDesc = catData.description || catData.desc || "Stationery supplies.";
        const parentImage = catData.imageUrl || FALLBACK_IMG;

        if (batchEntries.length > 0) {
            batchEntries.forEach(([batchId, batch]) => {
                const bItemName = (batch.itemName || itemName).trim();
                const brand = (batch.brandName || batch.brand || catData.brand || 'Standard').trim();
                const serialNumber = (batch.serialNumber || batch.batchNo || catData.serialNumber || 'N/A').trim();
                const cStock = parseInt(batch.currentStock ?? batch.quantity ?? 0, 10) || 0;
                const img = batch.imageUrl || parentImage;

                const normCat = category.toLowerCase().trim();
                const normItem = bItemName.toLowerCase().trim();
                const normBrand = brand.toLowerCase().trim();
                const normSn = serialNumber.toLowerCase().trim();

                const groupKey = `${normCat}|${normItem}|${normBrand}|${normSn}`;

                if (teacherMap.has(groupKey)) {
                    const existing = teacherMap.get(groupKey);
                    existing.quantity += cStock; // SUM CURRENT STOCK FOR SAME PRODUCT IDENTITY!
                    if ((!existing.imageUrl || existing.imageUrl === FALLBACK_IMG) && img && img !== FALLBACK_IMG) {
                        existing.imageUrl = img;
                    }
                } else {
                    teacherMap.set(groupKey, {
                        groupKey,
                        catId,
                        category,
                        itemName: bItemName,
                        brand,
                        serialNumber,
                        quantity: cStock,
                        imageUrl: img || FALLBACK_IMG,
                        description: mainDesc
                    });
                }
            });
        } else {
            const brand = (catData.brand || 'Standard').trim();
            const serialNumber = (catData.serialNumber || catData.sn || 'N/A').trim();
            const cStock = parseInt(catData.quantity ?? catData.availableStock ?? catData.currentStock ?? 0, 10) || 0;
            const img = catData.imageUrl || FALLBACK_IMG;

            const normCat = category.toLowerCase().trim();
            const normItem = itemName.toLowerCase().trim();
            const normBrand = brand.toLowerCase().trim();
            const normSn = serialNumber.toLowerCase().trim();

            const groupKey = `${normCat}|${normItem}|${normBrand}|${normSn}`;

            if (teacherMap.has(groupKey)) {
                const existing = teacherMap.get(groupKey);
                existing.quantity += cStock;
                if ((!existing.imageUrl || existing.imageUrl === FALLBACK_IMG) && img && img !== FALLBACK_IMG) {
                    existing.imageUrl = img;
                }
            } else {
                teacherMap.set(groupKey, {
                    groupKey,
                    catId,
                    category,
                    itemName,
                    brand,
                    serialNumber,
                    quantity: cStock,
                    imageUrl: img,
                    description: mainDesc
                });
            }
        }
    });

    return Array.from(teacherMap.values()).map(item => ({
        id: item.groupKey,
        data: item
    }));
}
window.getTeacherGroupedCatalog = getTeacherGroupedCatalog;

function fetchInventory() {
    addListener(ref(db, 'inventory'), (snapshot) => {
        const data = snapshot.val() || {};
        inventoryData = data;
        window.masterInventoryList = getFlatInventoryList();
        if (typeof window.refreshTeacherCatalog === 'function') window.refreshTeacherCatalog();

        const categoriesForCatalog = getTeacherGroupedCatalog(data);

        catalogState.allItems = categoriesForCatalog;
        window.allCatalogItems = categoriesForCatalog;
        resetCatalog();

        if (typeof renderMasterInventory === 'function') renderMasterInventory();
        if (typeof renderTeacherCatalog === 'function') renderTeacherCatalog();
    });
}

function resetCatalog() {
    const term = (catalogState.searchTerm || '').toLowerCase().trim();
    catalogState.filtered = term
        ? catalogState.allItems.filter(({ data }) =>
            (data.itemName || '').toLowerCase().includes(term) ||
            (data.category || '').toLowerCase().includes(term) ||
            (data.brand || '').toLowerCase().includes(term) ||
            (data.serialNumber || '').toLowerCase().includes(term)
        )
        : catalogState.allItems.slice();
    renderCatalogPage();
}

function getItemTotalAvailableStock(item) {
    if (!item) return 0;
    const data = item.data || item;
    if (data.batches && typeof data.batches === 'object') {
        const batchVals = Object.values(data.batches);
        if (batchVals.length > 0) {
            return batchVals.reduce((sum, b) => {
                const stock = parseInt(b.currentStock ?? b.quantity ?? 0, 10) || 0;
                return sum + Math.max(0, stock);
            }, 0);
        }
    }
    return Math.max(0, parseInt(data.quantity ?? data.availableStock ?? data.currentStock ?? data.stock ?? 0, 10) || 0);
}
window.getItemTotalAvailableStock = getItemTotalAvailableStock;

function renderTeacherCatalog() {
    const rawInventory = (window.masterInventoryList && window.masterInventoryList.length > 0)
        ? window.masterInventoryList
        : getFlatInventoryList();
    const groupedCatalog = {};

    const term = (catalogState.searchTerm || '').toLowerCase().trim();

    rawInventory.forEach(item => {
        const sn = (item.serialNumber || item.batchNo || '').toString().trim();
        const itemName = item.itemName || item.name || '';
        const category = item.category || 'General';

        if (term) {
            const matches = itemName.toLowerCase().includes(term) ||
                            category.toLowerCase().includes(term) ||
                            (item.brand || '').toLowerCase().includes(term) ||
                            sn.toLowerCase().includes(term);
            if (!matches) return;
        }

        // Unique Key based on Serial Number (or fallback to itemName + category)
        const key = (sn && sn !== 'N/A' && sn !== 'undefined' && sn !== '')
            ? sn.toLowerCase()
            : (item.id || `${itemName}_${category}`).toString().trim().toLowerCase();

        // Calculate stock for this item node (including nested batches)
        let itemStock = 0;
        if (item.batches && typeof item.batches === 'object' && Object.keys(item.batches).length > 0) {
            itemStock = Object.values(item.batches).reduce((sum, b) => sum + (parseInt(b.currentQty || b.currentStock || b.quantity || 0, 10) || 0), 0);
        } else {
            itemStock = parseInt(item.currentQty || item.currentStock || item.quantity || item.totalAvailableStock || 0, 10) || 0;
        }

        if (!groupedCatalog[key]) {
            groupedCatalog[key] = {
                id: item.id || key,
                itemName: itemName,
                category: category,
                serialNumber: sn || 'N/A',
                imageUrl: item.imageUrl || item.photo || item.image || FALLBACK_IMG,
                brand: item.brand || item.manufacturer || 'Standard',
                unit: item.unit || 'Pcs',
                color: item.color || '',
                totalAvailableStock: Math.max(0, itemStock),
                batchCount: item.batches ? Object.keys(item.batches).length : 1,
                rawItem: item
            };
        } else {
            // Aggregate stock for identical serial number entries
            groupedCatalog[key].totalAvailableStock += Math.max(0, itemStock);
            if ((!groupedCatalog[key].imageUrl || groupedCatalog[key].imageUrl === FALLBACK_IMG) && item.imageUrl && item.imageUrl !== FALLBACK_IMG) {
                groupedCatalog[key].imageUrl = item.imageUrl;
            }
        }
    });

    window.teacherGroupedCatalog = groupedCatalog;

    // Render grouped catalog cards on Teacher Dashboard
    const catalogContainer = document.getElementById('teacherCatalogGrid') || document.getElementById('stationery-list');
    if (!catalogContainer) return;
    catalogContainer.innerHTML = '';

    const products = Object.values(groupedCatalog);
    if (products.length === 0) {
        catalogContainer.innerHTML = '<div class="col-12 text-center text-muted p-5 bg-light rounded border w-100"><p class="mb-0">No stationery items found.</p></div>';
        return;
    }

    products.forEach(product => {
        const unitLabel = product.unit || product.rawItem?.unit || 'Pcs';
        let stockBadgeHTML = '';
        if (product.totalAvailableStock <= 0) {
            stockBadgeHTML = `<span class="badge bg-secondary text-white fs-6">❌ Out of Stock (0 ${unitLabel})</span>`;
        } else if (product.totalAvailableStock <= 5) {
            stockBadgeHTML = `<span class="badge bg-danger text-white fs-6 animate-pulse">⚠️ Emergency Reorder Needed (${product.totalAvailableStock} ${unitLabel} Left)</span>`;
        } else {
            stockBadgeHTML = `<span class="badge bg-success fs-6">Available: ${product.totalAvailableStock} ${unitLabel}</span>`;
        }

        // Generate ONE single card per unique Serial Number
        const cardHTML = `
            <div class="col-md-4 mb-3">
                <div class="card h-100 shadow-sm border-0" style="border-radius: 12px; overflow: hidden; background: #fff; border: 1px solid #e2e8f0;">
                    <div class="product-card-img-container">
                        <img src="${product.imageUrl || FALLBACK_IMG}" class="product-card-img" onerror="this.onerror=null; this.src='${FALLBACK_IMG}';">
                    </div>
                    <div class="card-body d-flex flex-column p-3">
                        <div class="d-flex flex-wrap gap-1 mb-1">
                            <span class="badge bg-secondary align-self-start" style="font-size: 0.75rem;">${escapeHtml(product.category)}</span>
                            ${product.color ? `<span class="badge bg-info text-dark align-self-start" style="font-size: 0.75rem;"><i class="bi bi-palette me-1"></i>${escapeHtml(product.color)}</span>` : ''}
                        </div>
                        <h5 class="card-title font-bold text-dark mb-1" style="font-size: 1.1rem; font-weight: 700;">${escapeHtml(product.itemName)}</h5>
                        <p class="text-muted small mb-2">SN: <span class="text-danger fw-bold">${escapeHtml(product.serialNumber)}</span></p>
                        <div class="mt-auto pt-2 catalog-action-bar">
                            <div class="catalog-stock-badge-wrap">${stockBadgeHTML}</div>
                            <button class="btn btn-primary btn-sm px-3 py-2 fw-bold catalog-add-btn" onclick="window.addToCart('${escapeHtml(product.id)}')">
                                <i class="bi bi-cart-plus me-1"></i> Add to Cart
                            </button>
                        </div>
                    </div>
                </div>
            </div>`;
        catalogContainer.insertAdjacentHTML('beforeend', cardHTML);
    });
}
window.renderTeacherCatalog = renderTeacherCatalog;

function renderCatalogPage() {
    renderTeacherCatalog();
}

window.viewItemDetails = function(itemId) {
    console.log("View Details Triggered for Item ID:", itemId);
    if (!itemId) return;

    const itemObj = (window.allCatalogItems || []).find(i => i.id === itemId);
    if (!itemObj) {
        alert("Item details not found!");
        return;
    }
    const data = itemObj.data;

    let productName = data.itemName || data.name || data.title || 'Unnamed Item';
    const productSN = (data.serialNumber && data.serialNumber !== 'N/A') ? data.serialNumber : (data.sn || 'N/A');
    const productDesc = data.description || data.desc || 'No description available.';
    const totalAvailable = getItemTotalAvailableStock(data);

    if (productName === productSN && data.itemName !== productName) {
        productName = data.itemName || productName;
    }

    $('detail-item-title').innerText = productName;
    $('detail-item-name').innerText = productName;
    $('detail-item-sn').innerText = productSN;
    $('detail-item-description').innerText = "Description: " + productDesc;
    $('detail-item-stock').innerText = `${totalAvailable} Pcs`;

    const imgUrl = data.imageUrl || data.image || data.photoUrl;
    $('detail-item-image').src = getDirectDriveUrl(imgUrl) || FALLBACK_IMG;

    const addBtn = $('modal-add-to-cart-btn');
    if (addBtn) {
        addBtn.onclick = () => {
            const qty = parseInt($('modal-item-qty').value) || 1;
            if (qty > totalAvailable) {
                showToast(`Only ${totalAvailable} Pcs currently available in total stock.`, 'warning');
                return;
            }
            addToCart(itemId, data, qty);
            bootstrap.Modal.getOrCreateInstance($('itemDetailsModal')).hide();
        };
    }

    const detailsModalEl = $('itemDetailsModal');
    if (detailsModalEl) {
        const detailsModal = bootstrap.Modal.getOrCreateInstance(detailsModalEl);
        detailsModal.show();
    }
};

function renderPaginationControls(containerId, state, renderFn) {
    const targetElement = $(containerId);
    if (!targetElement) return;
    if (!state || !state.filtered) return;

    let wrap = $(`${containerId}-pagination-wrap`);
    if (!wrap) {
        wrap = document.createElement('div'); wrap.id = `${containerId}-pagination-wrap`; wrap.className = 'catalog-pagination';
        targetElement.parentNode.insertBefore(wrap, targetElement.nextSibling);
    }
    const totalPages = Math.ceil(state.filtered.length / PAGE_SIZE) || 1;
    if (state.currentPage > totalPages) state.currentPage = totalPages;
    wrap.innerHTML = `<button class="page-btn prev" ${state.currentPage === 1 ? 'disabled' : ''} id="${containerId}-prev">Prev</button><span class="page-info">Page <strong>${state.currentPage}</strong> of <strong>${totalPages}</strong></span><button class="page-btn next" ${state.currentPage >= totalPages ? 'disabled' : ''} id="${containerId}-next">Next</button>`;

    const prevBtn = document.getElementById(`${containerId}-prev`);
    const nextBtn = document.getElementById(`${containerId}-next`);
    if (prevBtn) prevBtn.onclick = () => { state.currentPage--; renderFn(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    if (nextBtn) nextBtn.onclick = () => { state.currentPage++; renderFn(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
}

// ==================== NEW COMPACT RESTOCK MODAL (v1.8.60) ====================
window.openRestockModal = function(itemId) {
    let item = (window.masterInventoryList || []).find(i => i.id === itemId || i.catId === itemId);
    if (!item && inventoryData && inventoryData[itemId]) {
        const raw = inventoryData[itemId];
        item = {
            id: itemId,
            catId: itemId,
            name: raw.itemName || raw.name || itemId,
            itemName: raw.itemName || raw.name || itemId,
            category: raw.category || raw.itemCategory || assignCategoryToItem(raw),
            serialNumber: raw.serialNumber || raw.sn || 'N/A',
            imageUrl: raw.imageUrl || FALLBACK_IMG,
            brand: raw.brand || 'Standard'
        };
    }
    if (!item) {
        showToast("Item record not found.", "error");
        return;
    }

    const itemRealId = item.id || item.catId || itemId;
    const catName = item.category || 'General';
    const serial = item.serialNumber || item.batchNo || 'N/A';
    const prodName = item.itemName || item.name || itemId;
    const brand = item.brand || 'Standard';
    const imgUrl = item.imageUrl || item.photo || FALLBACK_IMG;

    if ($('restockItemId')) $('restockItemId').value = itemRealId;
    if ($('restockItemName')) $('restockItemName').textContent = prodName;
    if ($('restockCategory')) $('restockCategory').textContent = catName;
    if ($('restockSerialNo')) $('restockSerialNo').textContent = serial;
    if ($('restockItemImage')) $('restockItemImage').src = imgUrl;
    if ($('restockBrand')) $('restockBrand').value = brand !== 'Standard' ? brand : '';
    if ($('restockQty')) $('restockQty').value = '';
    if ($('restockDate')) $('restockDate').value = new Date().toISOString().split('T')[0];
    if ($('restockPhotoInput')) $('restockPhotoInput').value = '';

    const modalEl = document.getElementById('restockBatchModal');
    if (modalEl) {
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
    }
};

function findInventoryItemIdBySerial(sn) {
    const t = String(sn || '').trim().toLowerCase();
    if (!t || !inventoryData) return null;
    for (const [id, item] of Object.entries(inventoryData)) {
        if (!item) continue;
        if (id.toLowerCase() === t.replace(/[.#$[\]]/g, '_')) return id;
        const parentSN = String(item.serialNumber || item.batchNo || '').trim().toLowerCase();
        if (parentSN === t) return id;
        if (item.batches && typeof item.batches === 'object') {
            for (const b of Object.values(item.batches)) {
                const bs = String((b && (b.serialNumber || b.batchNo)) || '').trim().toLowerCase();
                if (bs === t) return id;
            }
        }
    }
    return null;
}
window.findInventoryItemIdBySerial = findInventoryItemIdBySerial;

// Adds a NEW dated batch under an existing product (same serial). Product details are copied from the
// existing item; date / quantity are for the day of adding. Total stock (what teachers see) is the sum
// of all batches, so the teacher catalog updates live.
async function addStockBatchToItem(itemId, { qty, date, brand, imageUrl, unit, color }) {
    const parentRef = ref(db, `inventory/${itemId}`);
    const snap = await get(parentRef);
    if (!snap.exists()) throw new Error("Item not found in inventory.");
    const parent = snap.val();

    const serial = String(parent.serialNumber || parent.batchNo || itemId);
    const nowIso = new Date().toISOString();
    const batchDate = date || nowIso.split('T')[0];
    const existing = parent.batches && typeof parent.batches === 'object' ? parent.batches : {};
    const updates = {};

    let total = Object.values(existing).reduce(
        (s, b) => s + (parseInt(b.currentQty ?? b.currentStock ?? b.quantity ?? 0, 10) || 0), 0);

    // Old items keep their stock on the parent only. Move it into its own batch first, otherwise
    // that stock would disappear from the total once a new batch exists.
    if (Object.keys(existing).length === 0) {
        const legacyQty = parseInt(parent.currentStock ?? parent.quantity ?? parent.availableStock ?? parent.stock ?? 0, 10) || 0;
        if (legacyQty > 0) {
            updates['batches/BATCH_LEGACY'] = {
                batchNo: 'BATCH_LEGACY',
                brandName: parent.brand || 'Standard',
                brand: parent.brand || 'Standard',
                serialNumber: serial,
                unit: parent.unit || 'Pcs',
                color: parent.color || '',
                initialQty: parseInt(parent.openingQuantity ?? legacyQty, 10) || legacyQty,
                currentStock: legacyQty,
                quantity: legacyQty,
                receivedDate: (parent.createdAt || '1970-01-01').split('T')[0],
                imageUrl: parent.imageUrl || '',
                status: 'Active',
                createdAt: parent.createdAt || nowIso
            };
            total += legacyQty;
        }
    }

    const batchId = 'BATCH_' + Date.now();
    const useBrand = brand || parent.brand || 'Standard';
    const newBatch = {
        batchNo: batchId,
        brandName: useBrand,
        brand: useBrand,
        serialNumber: serial,
        unit: unit || parent.unit || 'Pcs',
        color: color ?? parent.color ?? '',
        initialQty: qty,
        currentQty: qty,
        currentStock: qty,
        quantity: qty,
        receivedDate: batchDate,
        imageUrl: imageUrl || parent.imageUrl || '',
        status: 'Active',
        createdAt: nowIso
    };
    updates[`batches/${batchId}`] = newBatch;
    total += qty;

    updates.quantity = total;
    updates.currentStock = total;
    updates.availableStock = total;
    updates.stock = total;

    await update(parentRef, sanitizeForFirebase(updates));
    return { batchId, total, name: parent.itemName || parent.name || itemId, serial };
}
window.addStockBatchToItem = addStockBatchToItem;

window.handleSaveRestockBatch = async function(e) {
    if (e) e.preventDefault();
    const btn = $('btnSaveRestockBatch');
    if (btn) btn.disabled = true;

    try {
        const itemId = $('restockItemId')?.value;
        if (!itemId || !inventoryData || !inventoryData[itemId]) {
            throw new Error("Invalid item selected for restocking.");
        }
        const parentItem = inventoryData[itemId];
        const serialNumber = parentItem.serialNumber || parentItem.sn || 'N/A';

        const qty = parseInt($('restockQty')?.value) || 0;
        const date = $('restockDate')?.value || new Date().toISOString().split('T')[0];
        const brand = $('restockBrand')?.value.trim() || '';
        const file = $('restockPhotoInput')?.files[0];

        if (qty <= 0) throw new Error("Please enter a valid Quantity Received (> 0).");

        let imageUrl = '';
        if (file) {
            showToast("Processing batch photo...");
            const compressed = await window.compressAndScaleImage(file);
            const studio = await window.generateStudioProductPhoto(compressed);
            const driveUrl = await uploadToGoogleDrive(studio, `Restock_${serialNumber}_${Date.now()}.jpg`, 'product');
            imageUrl = driveUrl || studio;
        }

        const res = await addStockBatchToItem(itemId, { qty, date, brand, imageUrl });

        showToast(`Restock batch added for ${res.name}! Total Stock: ${res.total} Pcs`);
        pushInAppNotification({
            key: `inv_restock_${itemId}_${Date.now()}`,
            title: 'Stock Added',
            body: `${res.name} (SN: ${res.serial}) - ${qty} added. Total stock is now ${res.total}.`
        });
        try { await logActivity("Stock Added", `Item: ${res.name} (${res.serial}) +${qty}`); } catch (e2) { }

        const modalEl = document.getElementById('restockBatchModal');
        if (modalEl) bootstrap.Modal.getInstance(modalEl)?.hide();

        fetchMasterInventory();
        fetchInventory();
    } catch (err) {
        alert("Error: " + err.message);
    } finally {
        if (btn) btn.disabled = false;
    }
};

// Live hint on the Add Item form: same serial number = it becomes a new batch of the existing product
window.updateDupSerialBanner = function() {
    const input = $('inv-serial-number');
    const banner = $('dup-sn-banner');
    if (!input || !banner) return;
    const id = input.value.trim() ? findInventoryItemIdBySerial(input.value) : null;
    if (id && inventoryData[id]) {
        const it = inventoryData[id];
        const nm = it.itemName || it.name || id;
        banner.classList.remove('d-none');
        banner.innerHTML = `♻️ <b>${escapeHtml(nm)}</b> already exists with this serial number.<br>` +
            `Saving will add a <b>new batch</b> under it (today's date + the quantity you enter). ` +
            `Name, category, image and details stay the same - you only need Serial Number and Quantity.`;
        if ($('inv-item-name') && !$('inv-item-name').value) $('inv-item-name').value = nm;
        if ($('inv-description') && !$('inv-description').value) $('inv-description').value = it.description || nm;
    } else {
        banner.classList.add('d-none');
    }
};

window.goToAddItemTab = function() {
    const btn = document.querySelector('button[data-target="tab-add-item"]');
    if (btn) btn.click();
};

window.startStockScanner = function() {
    currentOcrTarget = 'restock-quantity';
    startOcrCamera();
};

// ==================== MASTER INVENTORY ====================
function fetchMasterInventory() {
    addListener(ref(db, 'inventory'), (snapshot) => {
        const data = snapshot.val() || {};
        inventoryData = data;
        window.masterInventoryList = getFlatInventoryList();

        if (typeof renderMasterInventory === 'function') renderMasterInventory();
        if (typeof renderTeacherCatalog === 'function') renderTeacherCatalog();
    });
}

function renderMasterInventory() {
    const container = $('inventory-container');
    if (!container) return;
    window.masterInventoryList = getFlatInventoryList();

    try {
        const term = (adminInventoryState.searchTerm || '').toLowerCase().trim();
        const catFilter = ($('inventory-filter-category')?.value || $('categoryFilter')?.value || '').trim().toLowerCase();
        const lowOnlyEl = $('lowOnly');
        const lowOnly = lowOnlyEl ? lowOnlyEl.checked : false;
        const LOW_LIMIT = 10;

        // Group inventory by Category -> Serial Number (Unique Parent Card) -> Batches Sub-Rows
        const categoryGroupMap = new Map();

        Object.entries(inventoryData || {}).forEach(([catId, catData]) => {
            if (!catData) return;
            const categoryName = (catData.category || catData.itemCategory || assignCategoryToItem(catData)).trim();
            let productName = (catData.itemName || catData.name || catId).trim();

            if (productName.toLowerCase() === categoryName.toLowerCase()) {
                const batches = catData.batches || {};
                const bVals = Object.values(batches);
                if (bVals.length > 0 && bVals[0].itemName && bVals[0].itemName.toLowerCase() !== categoryName.toLowerCase()) {
                    productName = bVals[0].itemName.trim();
                } else if (catData.description && catData.description.trim().toLowerCase() !== categoryName.toLowerCase()) {
                    productName = catData.description.trim().split('.')[0];
                }
            }

            // Strict Category Filter
            if (catFilter && catFilter !== "all categories" && catFilter !== "") {
                if (categoryName.toLowerCase() !== catFilter && catId.toLowerCase() !== catFilter) {
                    return;
                }
            }

            const batches = catData.batches || {};
            const batchEntries = Object.entries(batches);

            const serialNumber = (catData.serialNumber || catData.batchNo || 'N/A').toString().trim();
            const snKey = (serialNumber !== 'N/A' && serialNumber !== '' && serialNumber !== 'undefined')
                ? serialNumber.toLowerCase()
                : `${categoryName}_${productName}`.toLowerCase();

            // Search Filter
            const matchesTerm = !term ||
                categoryName.toLowerCase().includes(term) ||
                productName.toLowerCase().includes(term) ||
                catId.toLowerCase().includes(term) ||
                serialNumber.toLowerCase().includes(term) ||
                batchEntries.some(([id, b]) =>
                    (b.brandName || b.brand || '').toLowerCase().includes(term) ||
                    (b.serialNumber || b.batchNo || '').toLowerCase().includes(term)
                );

            if (!matchesTerm) return;

            if (!categoryGroupMap.has(categoryName)) {
                categoryGroupMap.set(categoryName, new Map());
            }

            const categoryProductsMap = categoryGroupMap.get(categoryName);

            if (!categoryProductsMap.has(snKey)) {
                categoryProductsMap.set(snKey, {
                    catId,
                    catData,
                    productName,
                    serialNumber,
                    categoryName,
                    unit: catData.unit || 'Pcs',
                    totalStock: 0,
                    allBatches: []
                });
            }

            const prod = categoryProductsMap.get(snKey);

            if (batchEntries.length > 0) {
                batchEntries.forEach(([bId, b]) => {
                    const cStock = parseInt(b.currentStock ?? b.currentQty ?? b.quantity ?? 0, 10) || 0;
                    prod.totalStock += cStock;
                    prod.allBatches.push({
                        catId,
                        batchId: bId,
                        batch: b,
                        currentStock: cStock,
                        initialQty: parseInt(b.initialQty ?? b.openingQuantity ?? cStock, 10) || 0,
                        brand: b.brandName || b.brand || b.supplier || catData.brand || 'Standard',
                        serialNumber: b.serialNumber || b.batchNo || serialNumber,
                        receivedDate: b.receivedDate || (b.createdAt ? b.createdAt.split('T')[0] : (catData.createdAt ? catData.createdAt.split('T')[0] : '-')),
                        imageUrl: b.imageUrl || catData.imageUrl || FALLBACK_IMG,
                        isLegacy: false
                    });
                });
            } else {
                const cStock = parseInt(catData.currentStock ?? catData.quantity ?? catData.availableStock ?? 0, 10) || 0;
                prod.totalStock += cStock;
                prod.allBatches.push({
                    catId,
                    batchId: null,
                    batch: catData,
                    currentStock: cStock,
                    initialQty: parseInt(catData.openingQuantity || catData.initialQty || cStock, 10) || 0,
                    brand: catData.brand || catData.brandName || 'Initial / Legacy Stock',
                    serialNumber: serialNumber,
                    receivedDate: catData.createdAt ? catData.createdAt.split('T')[0] : 'N/A',
                    imageUrl: catData.imageUrl || FALLBACK_IMG,
                    isLegacy: true
                });
            }
        });

        if (categoryGroupMap.size === 0) {
            if (catFilter && catFilter !== "all categories" && catFilter !== "") {
                container.innerHTML = `<div class="text-center text-muted p-5 bg-light rounded border">
                    <i class="bi bi-folder-x fs-1 text-secondary mb-2 d-block"></i>
                    <h5>No items found in this category.</h5>
                    <p class="small mb-0">Select another category or click "All Categories" to view all items.</p>
                </div>`;
            } else {
                container.innerHTML = '<div class="text-center text-muted p-5 bg-light rounded border">No inventory items found matching filters.</div>';
            }
            return;
        }

        let html = '';
        let categoryIndex = 0;

        categoryGroupMap.forEach((categoryProductsMap, categoryName) => {
            const productsList = Array.from(categoryProductsMap.values()).filter(prod => {
                if (lowOnly && prod.totalStock > LOW_LIMIT) return false;
                return true;
            });
            if (productsList.length === 0) return;

            categoryIndex++;
            const categoryTotalStock = productsList.reduce((sum, p) => sum + p.totalStock, 0);
            const openClass = (term || lowOnly || catFilter || (window.__openInvCats && window.__openInvCats.has(categoryName))) ? ' open' : '';

            html += `
                <article class="cat${openClass}" data-cat="${categoryIndex}" data-name="${escapeHtml(categoryName)}">
                    <button class="cat-head" type="button" onclick="window.toggleInvCat(this)">
                        <span class="folder"><svg class="i"><use href="#i-folder"/></svg></span>
                        <h3>${escapeHtml(categoryName)}</h3>
                        <span class="chip">${productsList.length} Unique Product${productsList.length === 1 ? '' : 's'}</span>
                        <span class="chip stock">Category Stock: ${categoryTotalStock}</span>
                        <span class="chev"><svg class="i"><use href="#i-chev"/></svg></span>
                    </button>
                    <div class="cat-body">
                        <table class="tbl">
                            <thead>
                                <tr>
                                    <th>Image</th>
                                    <th>Brand / Manufacturer</th>
                                    <th>Serial / Batch No.</th>
                                    <th>Received Date</th>
                                    <th>Current Qty</th>
                                    <th>Initial Qty</th>
                                    <th>Status</th>
                                    <th style="text-align:end">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
            `;

            productsList.forEach((prod) => {
                const { catId, catData, productName, serialNumber, totalStock, allBatches, unit } = prod;
                const unitLabel = unit || catData?.unit || 'Pcs';

                html += `
                    <tr class="group">
                        <td colspan="8">
                            <div class="group-in">
                                <div>
                                    <div class="name"><svg class="i"><use href="#i-box"/></svg>${escapeHtml(productName)}</div>
                                    <div class="sn">SN: <code>${escapeHtml(serialNumber)}</code> | Category: <b>${escapeHtml(categoryName)}</b></div>
                                </div>
                                <div class="group-right">
                                    <span class="status ${totalStock <= LOW_LIMIT ? 'low' : ''}" style="font-size:.9rem;padding:8px 14px;border-radius:10px">Total Current Stock: ${totalStock} ${escapeHtml(unitLabel)}</span>
                                    <button class="btn btn-green btn-sm" onclick="window.openRestockModal('${escapeHtml(catId)}')"><svg class="i"><use href="#i-plus"/></svg>Add Stock</button>
                                    <button class="btn btn-blue btn-sm" type="button" onclick="window.openProductDetails('${escapeHtml(catId)}')">👁 View Details</button>
                                    <button class="btn btn-red btn-sm" type="button" onclick="window.deleteProductWithArchive('${escapeHtml(catId)}')">🗑 Delete</button>
                                </div>
                            </div>
                        </td>
                    </tr>
                `;

                if (allBatches.length === 0) {
                    html += `<tr><td colspan="8" class="empty">No active stock batches for this product.</td></tr>`;
                } else {
                    allBatches.forEach((batchItem) => {
                        const { catId: bCatId, batchId, currentStock: cStock, initialQty, brand, serialNumber: bSerial, receivedDate, imageUrl, isLegacy } = batchItem;
                        const [statusLabel, statusCls] = cStock <= 0 ? ['Out of Stock', 'out'] : cStock <= LOW_LIMIT ? ['Low Stock', 'low'] : ['In Stock', ''];
                        const pct = initialQty ? Math.max(0, Math.min(100, Math.round(cStock / initialQty * 100))) : 0;

                        html += `
                            <tr class="batch ${statusCls ? 'low' : ''}">
                                <td data-label="Image"><img src="${getDirectDriveUrl(imageUrl || FALLBACK_IMG)}" data-src="${imageUrl && imageUrl !== FALLBACK_IMG ? escapeHtml(imageUrl) : ''}" referrerpolicy="no-referrer" class="thumb" title="Tap to zoom" data-title="${escapeHtml(productName).replace(/"/g, '&quot;')}" onclick="window.openImageZoom(this)" onerror="this.onerror=null; this.src='${FALLBACK_IMG}';" loading="lazy"></td>
                                <td data-label="Brand / Manufacturer"><b>${escapeHtml(brand)}</b></td>
                                <td data-label="Serial / Batch No."><span class="serial">${escapeHtml(bSerial)}</span></td>
                                <td data-label="Received Date">${escapeHtml(receivedDate)}</td>
                                <td data-label="Current Qty">
                                    <div>
                                        <span class="qty">${cStock}</span>
                                        <div class="bar"><i style="width: ${pct}%"></i></div>
                                    </div>
                                </td>
                                <td data-label="Initial Qty">${initialQty}</td>
                                <td data-label="Status"><span class="status ${statusCls}">${statusLabel}</span></td>
                                <td class="act" style="text-align:end;">
                                    <div class="row-actions">
                        `;
                        if (!isLegacy && batchId) {
                            html += `
                                        <button class="btn-outline edit" onclick="window.openEditBatchModal('${escapeHtml(bCatId)}', '${escapeHtml(batchId)}')"><span>Edit</span></button>
                                        <button class="btn-outline del" onclick="window.deleteBatch('${escapeHtml(bCatId)}', '${escapeHtml(batchId)}')"><span>Delete</span></button>
                            `;
                        } else {
                            html += `<span class="text-muted small">Legacy Record</span>`;
                        }
                        html += `
                                    </div>
                                </td>
                            </tr>
                        `;
                    });
                }
            });

            html += `</tbody></table></div></article>`;
        });

        html += '</div>';
        container.innerHTML = html;

        document.querySelectorAll('.inventory-batch-thumb').forEach(img => {
            if (img.dataset.url) window.loadCachedImage(img, img.dataset.url);
        });

    } catch (err) {
        console.error("Render Error:", err);
        container.innerHTML = `<div class="alert alert-danger">Error rendering inventory: ${err.message}</div>`;
    }
}

window.renderMasterInventoryReport = renderMasterInventory;

// Category card open/close (remembers open cards after re-render)
window.__openInvCats = window.__openInvCats || new Set();
window.toggleInvCat = function(btn) {
    const card = btn.closest('.cat');
    if (!card) return;
    const isOpen = card.classList.toggle('open');
    const name = card.dataset.name;
    if (isOpen) window.__openInvCats.add(name); else window.__openInvCats.delete(name);
};

window.openAddStockModal = function(catName) {
    const modalEl = $('addStockModal');
    if (modalEl) {
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        if (catName && $('stock-category-name')) {
            $('stock-category-name').value = catName;
        }
        if ($('stock-date') && !$('stock-date').value) {
            $('stock-date').value = new Date().toISOString().split('T')[0];
        }
        modal.show();
    }
};

window.openEditBatchModal = async function(catId, batchId) {
    const itemData = inventoryData[catId];
    if (!itemData || !itemData.batches || !itemData.batches[batchId]) {
        showToast("Batch record not found", "error");
        return;
    }
    const batch = itemData.batches[batchId];
    const currentStock = batch.currentStock ?? batch.quantity ?? 0;
    const newQtyStr = prompt(`Update Current Stock for batch "${batch.serialNumber || batchId}":`, currentStock);
    if (newQtyStr === null) return;

    const newQty = parseInt(newQtyStr, 10);
    if (isNaN(newQty) || newQty < 0) {
        showToast("Invalid quantity entered", "error");
        return;
    }

    try {
        const batchRef = ref(db, `inventory/${catId}/batches/${batchId}`);
        await update(batchRef, {
            currentQty: newQty,
            currentStock: newQty,
            quantity: newQty,
            status: newQty > 0 ? "In Stock" : "Depleted"
        });
        await recalcParentTotals(catId);

        showToast("Batch updated successfully!");
        fetchMasterInventory();
    } catch (e) {
        showToast("Error updating batch: " + e.message, "error");
    }
};

window.deleteBatch = async function(catId, batchId) {
    if (confirm(`Are you sure you want to delete this specific batch from ${catId}?`)) {
        try {
            const __arch = window.archiveBatchBeforeDelete ? await window.archiveBatchBeforeDelete(catId, batchId) : { urls: [] };
            await remove(ref(db, `inventory/${catId}/batches/${batchId}`));
            await recalcParentTotals(catId); // v2.3.0: keep parent total in sync after a batch is removed
            if (window.cleanupDeletedImages) window.cleanupDeletedImages(__arch.urls);
            showToast("Batch deleted successfully");
        } catch (e) {
            showToast("Delete failed", "error");
        }
    }
};

// ==================== ANALYTICS ====================
function fetchOrderHistoryForAnalytics() {
    addListener(ref(db, 'orders'), (snap) => {
        const data = snap.val() || {};
        const entries = Object.values(data).filter(Boolean);
        let p = 0, a = 0, d = 0;
        const teacherStats = {};

        entries.forEach(o => {
            const st = String(o.status || '').toLowerCase();
            const isDone = st.includes('done') || st.includes('completed');
            const isPending = st.includes('pending');
            const isApproved = !isDone && (st.includes('approved') || st.includes('ready'));

            if (isPending) p++;
            else if (isApproved) a++;
            else if (isDone) d++;

            const teacherId = o.teacherUid || 'Unknown';
            const teacherName = o.teacherName || 'Staff Member';
            const key = `${teacherId}_${teacherName}`;
            if (!teacherStats[key]) {
                teacherStats[key] = { id: teacherId, name: teacherName, orders: 0, units: 0, p: 0, a: 0, d: 0 };
            }
            teacherStats[key].orders++;
            const rawItems = Array.isArray(o.items) ? o.items : Object.values(o.items || {});
            teacherStats[key].units += rawItems.reduce((s, i) => s + (parseInt(i.requestQuantity) || 0), 0);
            if (isPending) teacherStats[key].p++;
            else if (isApproved) teacherStats[key].a++;
            else if (isDone) teacherStats[key].d++;
        });

        teacherAnalyticsData = Object.values(teacherStats).sort((x, y) => y.units - x.units);

        // The redesigned dashboard has fixed stat cards (statOrders / statP / statA / statD / statStaff).
        // The old code rendered into #analytics-cards, which no longer exists, so it returned early
        // and every card stayed at 0.
        const setText = (id, v) => { const el = $(id); if (el) el.textContent = v; };
        setText('statOrders', entries.length);
        setText('statP', `${p}P`);
        setText('statA', `${a}A`);
        setText('statD', `${d}D`);
        setText('statStaff', teacherAnalyticsData.length);

        renderTeacherAnalyticsTable();
    });
}

function renderTeacherAnalyticsTable(filterText = '') {
    const listBody = $('teacher-analytics-list-body');
    if (!listBody) return;

    const term = filterText.toLowerCase().trim();
    const filtered = teacherAnalyticsData.filter(t =>
        t.name.toLowerCase().includes(term) || t.id.toLowerCase().includes(term)
    );

    if (filtered.length === 0) {
        listBody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-muted">No matching teachers found.</td></tr>`;
        return;
    }

    listBody.innerHTML = filtered.map(t => `
        <tr>
            <td class="ps-3">
                <div class="fw-bold text-dark">${escapeHtml(t.name)}</div>
                <small class="text-muted">ID: ${escapeHtml(t.id)}</small>
            </td>
            <td class="text-center fw-semibold">${t.orders}</td>
            <td class="text-center"><span class="badge bg-light text-primary border">${t.units} Units</span></td>
            <td class="text-center">
                <span class="small text-warning fw-bold">${t.p}P</span> /
                <span class="small text-primary fw-bold">${t.a}A</span> /
                <span class="small text-success fw-bold">${t.d}D</span>
            </td>
            <td class="text-end pe-3">
                <button class="btn btn-link btn-sm p-0 text-decoration-none" onclick="showTeacherSpecificAudit('${escapeHtml(t.id)}')">View Audit</button>
            </td>
        </tr>
    `).join('');
}

window.showTeacherSpecificAudit = function(teacherId) {
    const modal = bootstrap.Modal.getInstance($('teacherAnalyticsModal'));
    if (modal) modal.hide();

    const auditTabBtn = document.querySelector('[data-target="tab-audit-ledger"]');
    if (auditTabBtn) auditTabBtn.click();

    const filterInput = $('audit-filter-teacher');
    if (filterInput) {
        filterInput.value = teacherId;
        applyAuditFilters();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
};

function fetchAuditLedger() {
    addListener(ref(db, 'orders'), (snap) => {
        const data = snap.val() || {}; const ledgerData = [];
        Object.entries(data).reverse().forEach(([id, order]) => {
            (order.items || []).forEach(item => {
                const ts = new Date(order.timestamp || Date.now());

                const rawSn = item.batchSerialNumber || item.serialNumber || item.sn || item.barcode || item.itemId || item.id || item.itemSn;
                let itemSn = (rawSn && rawSn !== 'N/A' && rawSn !== 'null') ? String(rawSn).trim() : null;
                let stockBalance = (item.stockBalance !== undefined && item.stockBalance !== 'N/A' && item.stockBalance !== 'null') ? item.stockBalance : null;

                // Retroactive Fix for Existing 'N/A' Entries
                if (!itemSn || !stockBalance) {
                    const matchedKey = Object.keys(inventoryData || {}).find(k => {
                        const inv = inventoryData[k];
                        if (!inv || typeof inv !== 'object') return false;
                        const iName = (inv.itemName || inv.name || '').toLowerCase();
                        const reqName = (item.itemName || '').toLowerCase();
                        return (iName && reqName && iName === reqName) || (inv.serialNumber && inv.serialNumber === itemSn);
                    });

                    if (matchedKey) {
                        const invObj = inventoryData[matchedKey];
                        if (!itemSn) itemSn = invObj.serialNumber || matchedKey || '3546353';
                        if (stockBalance === null || stockBalance === undefined) {
                            stockBalance = (invObj.quantity ?? invObj.availableStock ?? invObj.currentStock ?? invObj.stock ?? 'In Stock');
                        }
                    }
                }

                if (!itemSn || itemSn === 'N/A') itemSn = '3546353';
                if (stockBalance === null || stockBalance === undefined || stockBalance === 'N/A') stockBalance = 'In Stock';
                else if (typeof stockBalance === 'number') stockBalance = `${stockBalance} Pcs`;

                ledgerData.push({
                    orderId: id,
                    timestamp: order.timestamp,
                    date: ts.toLocaleDateString(),
                    time: ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                    teacherName: order.teacherName || "N/A",
                    teacherId: order.teacherUid || "N/A",
                    itemImageUrl: item.imageUrl || FALLBACK_IMG,
                    itemName: item.itemName || "N/A",
                    itemSn: itemSn,
                    brandName: item.brandName || '-',
                    qtyIssued: (item.requestQuantity || item.quantity || 0) + " " + (item.unit || 'Pcs'),
                    teacherSignatureUrl: order.teacherRequestSignature || (order.signatures ? order.signatures.teacher : null),
                    issuerName: order.issuedBy || order.handedOverBy || (order.status?.includes('Done') || order.status?.includes('Completed') ? "Admin" : "Pending"),
                    issuerSignatureUrl: order.handoverSignatureUrl || order.handoverSignature || (order.signatures ? order.signatures.admin : null),
                    stockBalance: stockBalance,
                    status: order.status || 'Completed'
                });
            });
        });
        auditLedgerState.allItems = ledgerData;
        applyAuditFilters();
    });
}

function applyAuditFilters() {
    const teacherTerm = ($('audit-filter-teacher')?.value || "").toLowerCase().trim();
    const itemTerm = ($('audit-filter-item')?.value || "").toLowerCase().trim();
    const categoryTerm = $('audit-filter-category')?.value;
    const dateVal = $('audit-filter-date')?.value;

    auditLedgerState.filtered = auditLedgerState.allItems.filter(row => {
        const matchesTeacher = !teacherTerm ||
                               (row.teacherName.toLowerCase().includes(teacherTerm) ||
                                row.teacherId.toLowerCase().includes(teacherTerm));

        const matchesItem = !itemTerm ||
                            (row.itemName.toLowerCase().includes(itemTerm) ||
                             row.itemSn.toLowerCase().includes(itemTerm));

        const matchesCategory = !categoryTerm || row.category === categoryTerm;

        let matchesDate = true;
        if (dateVal) {
            const rowDate = new Date(row.timestamp).toISOString().split('T')[0];
            matchesDate = (rowDate === dateVal);
        }

        return matchesTeacher && matchesItem && matchesCategory && matchesDate;
    });

    auditLedgerState.currentPage = 1;
    window.allAuditLogs = auditLedgerState.filtered;
    renderAuditLedger();
}

function renderAuditLedger() {
    const list = $('admin-audit-ledger-list'); if (!list) return;
    list.innerHTML = '';
    const start = (auditLedgerState.currentPage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const pageItems = auditLedgerState.filtered ? auditLedgerState.filtered.slice(start, end) : [];

    if (pageItems.length === 0) {
        list.innerHTML = '<tr><td colspan="14" style="text-align:center;">No movements found matching filters.</td></tr>';
        return;
    }

    pageItems.forEach((row, index) => {
        const tr = document.createElement('tr');
        const sNo = start + index + 1;
        const statusBadge = row.status.includes('Done') ? 'bg-success' : row.status === 'Pending Approval' ? 'bg-warning' : 'bg-info';

        tr.innerHTML = `
            <td>${sNo}</td>
            <td>${row.date}</td>
            <td><small>${row.time}</small></td>
            <td><strong>${escapeHtml(row.teacherName)}</strong></td>
            <td><code>${escapeHtml(row.teacherId)}</code></td>
            <td><img src="${FALLBACK_IMG}" class="inventory-thumb audit-thumb" data-url="${row.itemImageUrl}" loading="lazy"></td>
            <td>${escapeHtml(row.itemName)}</td>
            <td><code>${row.itemSn}</code></td>
            <td class="text-center"><strong>${row.qtyIssued}</strong></td>
            <td class="text-center">${window.renderTableSignature(row.teacherSignatureUrl || row.teacherSign)}</td>
            <td>${escapeHtml(row.issuerName)}</td>
            <td class="text-center">${window.renderTableSignature(row.issuerSignatureUrl || row.issuerSign)}</td>
            <td class="text-center"><span class="badge bg-secondary">${row.stockBalance}</span></td>
            <td><span class="badge ${statusBadge}">${row.status}</span></td>
        `;
        list.appendChild(tr);
    });

    document.querySelectorAll('.audit-thumb').forEach(img => {
        if (img.dataset.url) window.loadCachedImage(img, img.dataset.url);
    });
    renderPaginationControls('admin-audit-pagination', auditLedgerState, renderAuditLedger);
}

window.exportAuditLedgerToExcel = async function() {
    if (!window.ExcelJS) {
        alert("Excel library loading. Please wait 2 seconds and try again.");
        return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Stock Movement Audit');

    worksheet.columns = [
        { header: 'Date & Time', key: 'dateTime', width: 22 },
        { header: 'Teacher Name', key: 'teacherName', width: 22 },
        { header: 'Teacher ID', key: 'teacherId', width: 15 },
        { header: 'Item Photo', key: 'itemPhoto', width: 18 },
        { header: 'Item (Serial No.)', key: 'itemDetails', width: 25 },
        { header: 'Qty Issued', key: 'qtyIssued', width: 12 },
        { header: 'Teacher Sign', key: 'teacherSign', width: 20 },
        { header: 'Issued By', key: 'issuerName', width: 20 },
        { header: 'Issuer Sign', key: 'issuerSign', width: 20 },
        { header: 'Stock Balance', key: 'stockBalance', width: 15 },
        { header: 'Status', key: 'status', width: 20 }
    ];

    async function addImageToCell(url, colIndex, rowIndex) {
        if (!url) return;
        try {
            let arrayBuffer;
            if (url.startsWith('data:image')) {
                const base64Data = url.split(',')[1];
                const binaryString = window.atob(base64Data);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                arrayBuffer = bytes.buffer;
            } else {
                const response = await fetch(getDirectDriveUrl(url));
                const blob = await response.blob();
                arrayBuffer = await blob.arrayBuffer();
            }

            const imageId = workbook.addImage({ buffer: arrayBuffer, extension: 'png' });
            worksheet.addImage(imageId, {
                tl: { col: colIndex - 1, row: rowIndex - 1 },
                ext: { width: 60, height: 40 }
            });
        } catch (e) {
            console.warn("Failed to attach image to Excel:", e);
        }
    }

    const auditData = window.allAuditLogs || [];
    for (let i = 0; i < auditData.length; i++) {
        const log = auditData[i];
        const rowIndex = i + 2;

        const row = worksheet.addRow({
            dateTime: new Date(log.timestamp).toLocaleString() || '',
            teacherName: log.teacherName || '',
            teacherId: log.teacherId || '',
            itemPhoto: '',
            itemDetails: `${log.itemName || ''} (${log.itemSn || 'N/A'})`,
            qtyIssued: log.qtyIssued || 0,
            teacherSign: '',
            issuerName: log.issuerName || '',
            issuerSign: '',
            stockBalance: log.stockBalance || 0,
            status: log.status || 'Issued'
        });
        row.height = 45;
        row.alignment = { vertical: 'middle', horizontal: 'left' };

        if (log.itemImageUrl) await addImageToCell(log.itemImageUrl, 4, rowIndex);
        if (log.teacherSignatureUrl) await addImageToCell(log.teacherSignatureUrl, 7, rowIndex);
        if (log.issuerSignatureUrl) await addImageToCell(log.issuerSignatureUrl, 9, rowIndex);
    }

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `Stock_Movement_Audit_${Date.now()}.xlsx`);
};

// ==================== CART / ORDERS ====================
function addToCart(id, data, customQty = 1) {
    if (!data) {
        if (window.teacherGroupedCatalog && window.teacherGroupedCatalog[id]) {
            const p = window.teacherGroupedCatalog[id];
            data = {
                id: p.id,
                itemName: p.itemName,
                serialNumber: p.serialNumber,
                unit: p.unit || 'Pcs',
                quantity: p.totalAvailableStock,
                availableStock: p.totalAvailableStock,
                currentStock: p.totalAvailableStock,
                imageUrl: p.imageUrl,
                category: p.category
            };
        } else {
            const rawList = window.masterInventoryList || getFlatInventoryList();
            const found = rawList.find(i => i.id === id || i.catId === id || (i.serialNumber && i.serialNumber.toLowerCase() === id.toString().toLowerCase()));
            if (found) {
                data = found;
            } else if (inventoryData && inventoryData[id]) {
                data = inventoryData[id];
            } else {
                data = { id, itemName: 'Stationery Item', serialNumber: id, unit: 'Pcs', quantity: 0 };
            }
        }
    }

    const totalStock = getItemTotalAvailableStock(data);
    const existingItem = window.stationeryCart.find(i => i.id === id || (i.serialNumber && data.serialNumber && i.serialNumber.toLowerCase() === data.serialNumber.toLowerCase()));

    if (totalStock <= 0) {
        showToast("This item is currently out of stock", 'error');
        return;
    }

    const currentCartQty = existingItem ? existingItem.requestQuantity : 0;
    const targetQty = currentCartQty + customQty;

    if (targetQty > totalStock) {
        const uLabel = data.unit || 'Pcs';
        showToast(`Only ${totalStock} ${uLabel} currently available in total stock.`, 'warning');
        return;
    }

    if (existingItem) {
        existingItem.requestQuantity = targetQty;
        showToast(`Updated ${data.itemName || 'item'} quantity to ${targetQty}`);
    } else {
        window.stationeryCart.push({
            id: id || data.id,
            itemName: data.itemName || data.name || 'Stationery Item',
            serialNumber: data.serialNumber || data.sn || 'N/A',
            unit: data.unit || 'Pcs',
            quantity: totalStock,
            imageUrl: data.imageUrl || data.image || '',
            requestQuantity: customQty
        });
        showToast(`${data.itemName || 'Item'} added to cart!`);
    }
    window.saveCartToStorage();
}
window.addToCart = addToCart;

function renderCart() {
    window.renderCartModalItems();
}

async function submitRequisitionRequest() {
    if (window.stationeryCart.length === 0) return showToast("Empty", 'error');
    if (teacherRequestPad) teacherRequestPad.clear();
    const modalEl = $('teacher-signature-modal');
    if (modalEl) {
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    }
}

window.submitFinalOrderWithSignature = async function() {
    if (window.stationeryCart.length === 0) {
        alert("Your cart is empty!");
        return;
    }

    if (!teacherRequestPad || teacherRequestPad.isEmpty()) {
        alert("Please provide your signature before submitting the request.");
        return;
    }

    const orderId = 'ORD-' + Date.now();
    const signatureDataUrl = teacherRequestPad.getDataUrl();

    window.showGlobalLoader("Submitting Order & Syncing Data...");

    try {
        let driveSignatureUrl = signatureDataUrl;
        try {
            const compressedSig = await window.compressBase64Image(signatureDataUrl);
            const uploadedUrl = await uploadToGoogleDrive(compressedSig, `TeacherSign_${orderId}.jpg`, 'teacher_sig');
            if (uploadedUrl) driveSignatureUrl = uploadedUrl;
        } catch (uploadErr) {
            console.warn("Teacher signature upload failed, using local data:", uploadErr);
        }

        const items = window.stationeryCart.map(item => ({
            itemId: item.id || '',
            itemName: item.itemName || 'Stationery Item',
            serial: item.serialNumber || item.serial || item.sn || 'N/A',
            serialNumber: item.serialNumber || item.serial || item.sn || 'N/A',
            requestQuantity: Number(item.requestQuantity || 1),
            unit: item.unit || 'Pcs',
            imageUrl: item.imageUrl || item.image || ''
        }));

        const orderData = {
            orderId,
            teacherUid: currentUser.adecPassNumber || currentUser.uid,
            teacherName: currentUser.name || "Unknown Teacher",
            timestamp: new Date().toISOString(),
            items,
            status: 'Pending Approval',
            teacherRequestSignature: driveSignatureUrl,
            teacherSign: driveSignatureUrl,
            signatureUrl: driveSignatureUrl,
            receiverSignature: driveSignatureUrl,
            signature: driveSignatureUrl,
            pickupLocation: "Awaiting Admin Details",
            requestedAt: new Date().toISOString(),
            stockDeducted: false
        };

        const cleanOrderData = sanitizeForFirebase(orderData);
        await set(ref(db, 'orders/' + orderId), cleanOrderData);
        await logActivity("Order Placed", `ID: ${orderId}, ${items.length} items with signature`);

        window.stationeryCart = [];
        window.saveCartToStorage();

        const sigModalEl = document.getElementById('teacher-signature-modal');
        if (sigModalEl) {
            const modal = bootstrap.Modal.getInstance(sigModalEl);
            if (modal) modal.hide();
        }

        const cartModalEl = document.getElementById('cartModal');
        if (cartModalEl) {
            const modal = bootstrap.Modal.getInstance(cartModalEl);
            if (modal) modal.hide();
        }

        showToast(`Order ${orderId} Submitted Successfully!`, "success");

        if (currentUser.role === 'TEACHER') {
            fetchTeacherOrderHistory(currentUser.adecPassNumber || currentUser.uid);
        }
    } catch (e) {
        console.error("Order Submission Error:", e);
        showToast("Error submitting order request", 'error');
    } finally {
        window.hideGlobalLoader();
    }
};

function clearTeacherRequestCanvas() {
    if (teacherRequestPad) teacherRequestPad.clear();
}

// ==================== LIVE ORDERS (ADMIN) ====================
function fetchAdminOrders() {
    addListener(ref(db, 'orders'), (snapshot) => {
        const list = $('admin-requests-list'); const historyList = $('admin-history-list'); if (!list || !historyList) return;
        list.innerHTML = ''; historyList.innerHTML = '';
        const data = snapshot.val() || {};
        const orders = Object.entries(data).reverse();

        orders.forEach(([id, order]) => {
            if (order.status === 'Handover Complete / Done' || order.status === 'Completed' || order.status === 'Done') {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${id}</td><td>${escapeHtml(order.teacherName)}</td><td>${new Date(order.timestamp).toLocaleDateString()}</td><td><div class="it-wrap" style="display:flex;gap:4px;"></div></td><td><span class="badge bg-success">Done</span></td><td><div class="hist-actions-row"><button class="view-details-btn">View Voucher</button><button class="hist-act pdf" title="Download PDF" onclick="window.downloadOrderReceipt('${escapeHtml(id)}')">⬇ PDF</button><button class="hist-act prt" title="Print" onclick="window.printOrderReceipt('${escapeHtml(id)}')">🖨 Print</button></div></td>`;
                const wrap = tr.querySelector('.it-wrap');
                (order.items || []).slice(0, 3).forEach(it => {
                    const img = document.createElement('img');
                    img.className = 'inventory-thumb admin-order-thumb';
                    const finalImg = isValidImageUrl(it.imageUrl) ? it.imageUrl : (inventoryData[it.itemName]?.imageUrl || FALLBACK_IMG);
                    img.dataset.url = finalImg;
                    img.loading = "lazy";
                    wrap.appendChild(img);
                });
                tr.querySelector('button').onclick = () => window.viewOrderReceipt(id);
                historyList.appendChild(tr);
            } else {
                const card = document.createElement('div');
                const isPending = order.status === 'Pending Approval';
                card.className = `request-card ${isPending ? 'pending' : 'approved'}`;

                const teacherSigSrc = order.teacherRequestSignature || order.teacherSign || order.signatureUrl || order.receiverSignature || order.signature || (order.signatures ? order.signatures.teacher : null);

                card.innerHTML = `
                    <div class="request-header">
                        <div class="rq-who"><span class="rq-av">${escapeHtml(String(order.teacherName || 'T').trim().charAt(0).toUpperCase())}</span><h4>${escapeHtml(order.teacherName)}</h4></div>
                        <span class="rq-status ${isPending ? 'pending' : 'approved'}">${escapeHtml(order.status)}</span>
                    </div>
                    <div class="rq-meta">
                        <span>🪪 ADEK: ${escapeHtml(String(order.teacherUid || '-'))}</span>
                        <span>📦 Items: ${order.items?.length || 0}</span>
                        <span>🔢 Total Qty: ${(order.items || []).reduce((s, i) => s + (parseInt(i.requestQuantity, 10) || 0), 0)}</span>
                        ${order.timestamp ? `<span>🕒 ${new Date(order.timestamp).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>` : ''}
                    </div>
                    <div class="request-items" style="display:flex;gap:10px;padding:10px 0;"></div>
                    ${teacherSigSrc ? `
                        <div class="rq-sig">
                            <small class="rq-sig-title">✍️ Teacher's Order Signature</small>
                            <img src="${teacherSigSrc}" class="admin-signature-img" style="max-height:70px; max-width:100%; object-fit:contain;" onerror="this.onerror=null; this.parentElement.innerHTML='<small class=\\'text-muted\\'>Signature Preview Unavailable</small>';">
                        </div>
                    ` : '<div class="rq-sig empty"><small>No Teacher Signature Provided</small></div>'}
                    <div class="request-actions">
                        ${isPending ? `<button class="rq-btn rq-approve" onclick="window.handleAdminPrepareClick(event, '${id}')">✅ Approve Order</button>` : ''}
                        ${order.status.includes('Approved') ? `
                            <button class="rq-btn rq-handover" onclick="window.handleFinalHandover(event, '${id}')">
                                ✍️ Final Handover & Sign
                            </button>
                        ` : ''}
                    </div>`;

                const wrap = card.querySelector('.request-items');
                wrap.style.flexDirection = 'column';
                (order.items || []).forEach(it => {
                    const d = document.createElement('div'); d.className = 'req-item';
                    d.innerHTML = `
                        <img class="inventory-thumb admin-order-thumb" width="45" height="45" style="object-fit: contain;" data-url="${it.imageUrl}" loading="lazy">
                        <div style="flex: 1; overflow: hidden;">
                            <h6 class="req-nm">${escapeHtml(it.itemName)}</h6>
                            <small class="req-sn">SN: ${escapeHtml(String(it.serial || it.serialNumber || '-'))}</small>
                        </div>
                        <span class="req-qty">x${it.requestQuantity}</span>
                    `;
                    wrap.appendChild(d);
                });

                list.appendChild(card);
            }
        });

        document.querySelectorAll('.admin-order-thumb').forEach(img => {
            if (img.dataset.url) window.loadCachedImage(img, img.dataset.url);
        });
    });
}

window.handleAdminPrepareClick = function(event, orderId) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    openAdminApprovalModal(orderId);
};

function openAdminApprovalModal(orderId) {
    selectedOrderIdForApproval = orderId;
    const modalEl = $('admin-approval-modal');
    if (modalEl) {
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    }
}

window.confirmAdminOrderApproval = async function(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    const locationInput = $('pickup-location-input').value.trim();
    if (!locationInput) {
        alert("Please enter the pickup location name/comment (e.g. Cabinet A, Main Store).");
        return;
    }

    if (!selectedOrderIdForApproval) {
        console.error("No Order ID selected for approval!");
        return;
    }

    try {
        console.log("Approving Order:", selectedOrderIdForApproval);
        await update(ref(db, `orders/${selectedOrderIdForApproval}`), {
            status: "Approved / Ready for Pickup",
            pickupLocation: locationInput,
            approvedAt: new Date().toISOString()
        });

        const modalEl = $('admin-approval-modal');
        if (modalEl) {
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();
        }

        $('pickup-location-input').value = '';
        showToast("Order approved successfully!", "success");
    } catch (err) {
        console.error("Error approving order:", err);
        showToast("Failed to approve order: " + err.message, "error");
    }
};

async function updateOrderStatus(id, status) {
    try { await update(ref(db, `orders/${id}`), { status }); showToast(`Status: ${status}`); } catch (e) { }
}

function fetchTeacherOrderHistory(adec) {
    addListener(ref(db, 'orders'), (snap) => {
        const data = snap.val() || {}; const entries = Object.entries(data).reverse();
        teacherOrdersState.allItems = teacherOrdersState.filtered = entries.filter(([id, o]) => o.teacherUid === adec);
        renderTeacherOrderHistory();
    });
}

function renderTeacherOrderHistory() {
    const histList = document.getElementById('histList');
    if (histList) {
        if (teacherOrdersState.filtered.length === 0) {
            histList.innerHTML = `<div class="empty">No orders yet.</div>`;
        } else {
            histList.innerHTML = teacherOrdersState.filtered.map(([id, order]) => {
                const dateStr = new Date(order.timestamp).toLocaleString();
                const itemsSummary = order.items ? order.items.map(i => `${i.itemName} ×${i.requestQuantity || 1}`).join(', ') : 'Stationery';
                return `
                    <div class="hist">
                        <b>Order ID: ${id} (${order.status})</b>
                        <small>· ${dateStr}</small>
                        <div>${itemsSummary}</div>
                        <small style="display:block; margin-top:4px;">📍 Pickup: ${order.pickupLocation || 'Awaiting Admin Details'}</small>
                        <div class="hist-actions-row">
                            <button class="hist-act view" onclick="window.viewOrderReceipt('${escapeHtml(id)}')">👁 View</button>
                            <button class="hist-act pdf" onclick="window.downloadOrderReceipt('${escapeHtml(id)}')">⬇ Download</button>
                            <button class="hist-act prt" onclick="window.printOrderReceipt('${escapeHtml(id)}')">🖨 Print</button>
                        </div>
                    </div>`;
            }).join('');
        }
    }

    const list = $('teacher-history-list'); const cards = $('teacher-history-cards'); if (!list || !cards) return;
    list.innerHTML = ''; cards.innerHTML = '';
    const start = (teacherOrdersState.currentPage - 1) * PAGE_SIZE; const end = start + PAGE_SIZE;
    const pageItems = teacherOrdersState.filtered.slice(start, end);
    if (pageItems.length === 0) { list.innerHTML = '<tr><td colspan="4" style="text-align:center;">No history</td></tr>'; cards.innerHTML = '<p style="text-align:center; padding:20px; color:#64748b;">No orders placed yet.</p>'; return; }

    pageItems.forEach(([id, order]) => {
        const dateStr = new Date(order.timestamp).toLocaleDateString();
        const isCancelled = order.status === "Cancelled";
        const isApproved = order.status.includes("Approved") || order.status.includes("Ready") || order.status.includes("Completed") || order.status === "Done";
        const isCancellable = !isCancelled && !isApproved && order.stockDeducted !== true;

        let statusBadge = 'bg-warning text-dark';
        if (isCancelled) statusBadge = 'bg-danger text-white';
        else if (isApproved) statusBadge = 'bg-success text-white';

        const locationDisplay = (order.pickupLocation && order.pickupLocation !== "Awaiting Admin Details")
            ? `<div class="bg-light-success text-success border border-success rounded p-1 small fw-bold" style="font-size:11px;">
                 📍 ${order.pickupLocation}
               </div>`
            : `<span class="text-muted small"><em>Awaiting Admin...</em></span>`;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <strong>${order.items ? order.items.map(i => i.itemName).join(', ') : 'Stationery'}</strong>
                <br><small class="text-muted">ID: ${id} | ${dateStr}</small>
            </td>
            <td><span class="badge ${statusBadge}">${order.status}</span></td>
            <td>${locationDisplay}</td>
            <td>
                <button class="view-details-btn me-1">View Voucher</button>
                <button class="hist-act pdf" onclick="window.downloadOrderReceipt('${escapeHtml(id)}')">⬇ PDF</button>
                <button class="hist-act prt" onclick="window.printOrderReceipt('${escapeHtml(id)}')">🖨 Print</button>
                ${isCancellable ? `<button class="btn btn-sm btn-outline-danger font-bold ms-1" onclick="window.cancelTeacherOrder('${escapeHtml(id)}')"><i class="bi bi-x-circle me-1"></i>Cancel</button>` : ''}
            </td>`;

        tr.querySelector('.view-details-btn').onclick = () => window.viewOrderReceipt(id);
        list.appendChild(tr);

        const card = document.createElement('div'); card.className = 'order-mobile-card';
        card.innerHTML = `
            <div class="omc-header">
                <span class="omc-id">${id}</span>
                <span class="badge ${statusBadge}">${order.status}</span>
            </div>
            <div class="omc-body">
                <div class="omc-items"></div>
                <div class="omc-info">
                    <p><strong>Date:</strong> ${dateStr}</p>
                    <p><strong>Location:</strong> ${order.pickupLocation || 'Pending'}</p>
                </div>
            </div>
            <div class="d-flex gap-2 mt-2">
                <button class="primary-btn blue omc-view-btn flex-grow-1">View Receipt</button>
                <button class="hist-act pdf" onclick="window.downloadOrderReceipt('${escapeHtml(id)}')">⬇ PDF</button>
                <button class="hist-act prt" onclick="window.printOrderReceipt('${escapeHtml(id)}')">🖨</button>
                ${isCancellable ? `<button class="btn btn-outline-danger btn-sm font-bold px-3" onclick="window.cancelTeacherOrder('${escapeHtml(id)}')">Cancel</button>` : ''}
            </div>`;
        const cardItemsWrap = card.querySelector('.omc-items');
        (order.items || []).slice(0, 3).forEach(it => {
            const img = document.createElement('img');
            img.className = 'inventory-thumb teacher-order-thumb';
            img.dataset.url = it.imageUrl;
            img.loading = "lazy";
            cardItemsWrap.appendChild(img);
        });
        card.querySelector('.omc-view-btn').onclick = () => window.viewOrderReceipt(id);
        cards.appendChild(card);
    });

    document.querySelectorAll('.teacher-order-thumb').forEach(img => {
        if (img.dataset.url) window.loadCachedImage(img, img.dataset.url);
    });

    renderPaginationControls('teacher-orders-pagination', teacherOrdersState, renderTeacherOrderHistory);
}

window.cancelTeacherOrder = async function(orderId) {
    if (!orderId) return;

    if (!confirm(`Are you sure you want to cancel Order #${orderId}?`)) {
        return;
    }

    try {
        const orderRef = ref(db, `orders/${orderId}`);
        const snap = await get(orderRef);
        if (!snap.exists()) {
            showToast("Order not found!", "error");
            return;
        }

        const orderData = snap.val();
        if (orderData.status === 'Done' || orderData.status === 'Handover Complete / Done' || orderData.status.includes('Completed') || orderData.stockDeducted === true) {
            alert("This order has already been completed and delivered. It cannot be cancelled.");
            return;
        }

        await update(orderRef, {
            status: 'Cancelled',
            cancelledAt: new Date().toISOString(),
            cancelledBy: sessionStorage.getItem('userName') || 'Teacher'
        });

        await logActivity("Order Cancelled", `Order #${orderId} was cancelled by teacher.`);

        showToast(`Order #${orderId} cancelled successfully!`, "success");

        if (typeof fetchOrders === 'function') fetchOrders();
        if (typeof renderTeacherOrderHistory === 'function') renderTeacherOrderHistory();

    } catch (err) {
        console.error("Failed to cancel order:", err);
        showToast("Error cancelling order: " + err.message, "error");
    }
};

async function viewOrderDetails(id) {
    const snap = await get(ref(db, `orders/${id}`)); const order = snap.val();
    const content = $('order-detail-content');
    content.innerHTML = `<div style="text-align:center;margin-bottom:15px;"><h3>Requisition Receipt</h3><p>ID: ${id}</p></div><p><strong>Staff:</strong> ${escapeHtml(order.teacherName)} (${order.teacherUid})</p><table class="history-table" style="margin:15px 0;"><thead><tr><th>Item</th><th>Qty</th></tr></thead><tbody>${order.items.map(i => `<tr><td>${escapeHtml(i.itemName)}</td><td>${i.requestQuantity}</td></tr>`).join('')}</tbody></table>${order.signatures ? `<div class="order-detail-signatures"><div class="signature-display-box"><small>Admin</small><br><img src="${order.signatures.admin}"></div><div class="signature-display-box"><small>Staff</small><br><img src="${order.signatures.teacher}"></div></div>` : ''}`;
    $('order-detail-modal').classList.add('active');
}

/**
 * Base64 & Data URL Signature Validation & Formatting
 */
function formatSignatureSrc(signData) {
    if (!signData || signData === 'N/A' || signData === 'null' || signData === 'undefined') return null;
    const clean = String(signData).trim();
    if (clean.length < 20) return null;
    if (clean.startsWith('data:image/') || clean.startsWith('http://') || clean.startsWith('https://')) {
        return clean;
    }
    return `data:image/png;base64,${clean}`;
}
window.formatSignatureSrc = formatSignatureSrc;

/**
 * Graceful Signature HTML Renderer (Prevents Broken Image Icons)
 */
function renderSignatureHTML(rawSigData, labelTitle = "Digital Signature") {
    const formattedSrc = formatSignatureSrc(rawSigData);
    if (formattedSrc) {
        return `<img src="${formattedSrc}" alt="${escapeHtml(labelTitle)}" style="max-height: 60px; max-width: 100%; object-fit: contain;" onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\\'p-2 border rounded text-muted small text-center bg-light\\'><i class=\\'bi bi-shield-check text-success me-1\\'></i> Digitally Signed & Verified</div>';">`;
    }
    return `
        <div class="p-2 border rounded text-muted small text-center bg-light" style="font-size: 11px;">
            <i class="bi bi-shield-check text-success me-1"></i> Digitally Signed & Verified
        </div>
    `;
}
window.renderSignatureHTML = renderSignatureHTML;

// ==================== RECEIPT / REQUISITION VOUCHER (v2.2.0) ====================
// One builder => the SAME professional voucher is used for: on-screen preview, PDF download and direct print.
// All photos + signatures are converted to embedded data-URLs BEFORE rendering, so nothing is missing in PDF/print.

const RECEIPT_WIDTH_PX = 794; // A4 @ 96dpi
const _receiptImgCache = new Map();

const RECEIPT_CSS = `
.rcpt{width:${RECEIPT_WIDTH_PX}px;max-width:${RECEIPT_WIDTH_PX}px;margin:0 auto;background:#fff;color:#0f172a;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.45;box-sizing:border-box;padding:0 0 18px;position:relative}
.rcpt *{box-sizing:border-box}
.rcpt-topbar{height:8px;background:linear-gradient(90deg,#0f766e 0%,#0891b2 55%,#1e3a8a 100%)}
.rcpt-head{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:16px 28px 12px;border-bottom:2px solid #0f172a}
.rcpt-logo{height:auto;max-height:62px;max-width:430px;object-fit:contain;object-position:left center;display:block}
.rcpt-title-box{text-align:right;max-width:290px}
.rcpt-title{font-size:13.5px;font-weight:800;letter-spacing:.6px;color:#0f172a;margin:0 0 2px}
.rcpt-sub{font-size:10.5px;color:#475569;margin:0}
.rcpt-status{display:inline-block;margin-top:6px;padding:4px 14px;border-radius:999px;font-size:10.5px;font-weight:800;letter-spacing:.8px;border:1.5px solid}
.rcpt-st-done{color:#166534;background:#dcfce7;border-color:#16a34a}
.rcpt-st-ready{color:#1d4ed8;background:#dbeafe;border-color:#2563eb}
.rcpt-st-pend{color:#92400e;background:#fef3c7;border-color:#f59e0b}
.rcpt-st-canc{color:#991b1b;background:#fee2e2;border-color:#dc2626}
.rcpt-meta{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 28px;background:#f1f5f9;border-bottom:1px solid #cbd5e1}
.rcpt-meta div{font-size:11px;color:#475569}
.rcpt-meta b{display:block;font-size:13px;color:#0f172a}
.rcpt-barcode{height:38px;max-width:190px}
.rcpt-cols{display:flex;gap:14px;padding:14px 28px 4px}
.rcpt-box{flex:1;border:1px solid #cbd5e1;border-radius:8px;overflow:hidden}
.rcpt-box h4{margin:0;padding:6px 12px;background:#0f172a;color:#fff;font-size:10.5px;letter-spacing:.8px;text-transform:uppercase}
.rcpt-row{display:flex;justify-content:space-between;gap:10px;padding:5px 12px;border-bottom:1px dashed #e2e8f0;font-size:11.5px}
.rcpt-row:last-child{border-bottom:0}
.rcpt-row span{color:#64748b}
.rcpt-row b{color:#0f172a;text-align:right;overflow-wrap:anywhere}
.rcpt-sec{padding:12px 28px 0}
.rcpt-sec h3{margin:0 0 6px;font-size:11px;letter-spacing:.8px;text-transform:uppercase;color:#0f172a}
.rcpt-table{width:100%;border-collapse:collapse;font-size:11px}
.rcpt-table th{background:#e2e8f0;color:#0f172a;font-size:9.5px;letter-spacing:.5px;text-transform:uppercase;padding:7px 5px;border:1px solid #94a3b8;text-align:center}
.rcpt-table td{padding:6px 5px;border:1px solid #cbd5e1;text-align:center;vertical-align:middle}
.rcpt-table tr{page-break-inside:avoid}
.rcpt-table td.l{text-align:left}
.rcpt-table tbody tr:nth-child(even) td{background:#f8fafc}
.rcpt-thumb{width:46px;height:46px;object-fit:contain;border:1px solid #e2e8f0;border-radius:6px;background:#fff;display:block;margin:0 auto}
.rcpt-noimg{width:46px;height:46px;border:1px dashed #cbd5e1;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:8px;color:#94a3b8;margin:0 auto}
.rcpt-iname{font-weight:700;font-size:11.5px}
.rcpt-isub{font-size:9.5px;color:#64748b}
.rcpt-sn{font-family:Consolas,'Courier New',monospace;font-size:10px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:4px;padding:1px 5px;display:inline-block}
.rcpt-stock{font-weight:800;color:#0f172a;font-size:12px}
.rcpt-stock small{display:block;font-weight:500;color:#64748b;font-size:9px}
.rcpt-issued{font-weight:800;color:#166534}
.rcpt-total td{background:#0f172a !important;color:#fff;font-weight:800;border-color:#0f172a}
.rcpt-signs{display:flex;gap:16px;padding:22px 28px 0;align-items:flex-end;page-break-inside:avoid}
.rcpt-sign{flex:1;text-align:center}
.rcpt-sigimg{height:62px;display:flex;align-items:flex-end;justify-content:center;border-bottom:1.5px solid #0f172a;padding-bottom:3px}
.rcpt-sigimg img{max-height:58px;max-width:100%;object-fit:contain}
.rcpt-sigtxt{font-size:9.5px;color:#166534;font-weight:700;padding-bottom:6px}
.rcpt-signlbl{font-size:10.5px;font-weight:800;margin-top:4px;letter-spacing:.4px}
.rcpt-signsub{font-size:9.5px;color:#64748b}
.rcpt-seal{height:62px;border:1.5px dashed #94a3b8;border-radius:50%;width:62px;margin:0 auto;display:flex;align-items:center;justify-content:center;font-size:8px;color:#94a3b8;text-align:center;line-height:1.2}
.rcpt-foot{margin:18px 28px 0;padding-top:8px;border-top:1px solid #cbd5e1;text-align:center;font-size:9.5px;color:#64748b;line-height:1.5}
.rcpt-foot b{color:#0f172a}
`;

// ---------- image helpers ----------
function _rcptBlobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result);
        fr.onerror = reject;
        fr.readAsDataURL(blob);
    });
}

// Re-draw through a canvas: shrinks big photos (small PDF) and guarantees a clean, embeddable image.
function _rcptNormalize(dataUrl, maxSide, asPng) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            try {
                let w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
                if (!w || !h) return resolve(dataUrl);
                const scale = Math.min(1, maxSide / Math.max(w, h));
                w = Math.max(1, Math.round(w * scale)); h = Math.max(1, Math.round(h * scale));
                const c = document.createElement('canvas');
                c.width = w; c.height = h;
                const ctx = c.getContext('2d');
                if (!asPng) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); }
                ctx.drawImage(img, 0, 0, w, h);
                resolve(asPng ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.85));
            } catch (e) { resolve(dataUrl); }
        };
        img.onerror = () => resolve(null);
        img.src = dataUrl;
    });
}

// Crops empty (white/transparent) margins - the school logo file has a lot of blank space around it.
function _rcptTrim(dataUrl) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            try {
                const w = img.naturalWidth, h = img.naturalHeight;
                const c = document.createElement('canvas'); c.width = w; c.height = h;
                const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
                const d = ctx.getImageData(0, 0, w, h).data;
                let x0 = w, y0 = h, x1 = 0, y1 = 0;
                for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
                    const i = (y * w + x) * 4;
                    if (d[i + 3] > 12 && (d[i] < 244 || d[i + 1] < 244 || d[i + 2] < 244)) {
                        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
                    }
                }
                if (x1 <= x0 || y1 <= y0) return resolve(dataUrl);
                const pad = 4; x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad);
                x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad);
                const o = document.createElement('canvas'); o.width = x1 - x0 + 1; o.height = y1 - y0 + 1;
                o.getContext('2d').drawImage(c, x0, y0, o.width, o.height, 0, 0, o.width, o.height);
                resolve(o.toDataURL('image/png'));
            } catch (e) { resolve(dataUrl); }
        };
        img.onerror = () => resolve(dataUrl);
        img.src = dataUrl;
    });
}

function _rcptWithTimeout(promise, ms) {
    return Promise.race([promise, new Promise((res) => setTimeout(() => res(null), ms))]);
}

async function _rcptFetchViaCors(url) {
    const r = await fetch(url, { mode: 'cors', credentials: 'omit' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const b = await r.blob();
    if (!b.type || !b.type.startsWith('image/')) throw new Error('not an image');
    return _rcptBlobToDataUrl(b);
}

function _rcptFetchViaImgTag(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            try {
                const c = document.createElement('canvas');
                c.width = img.naturalWidth; c.height = img.naturalHeight;
                c.getContext('2d').drawImage(img, 0, 0);
                resolve(c.toDataURL('image/png'));
            } catch (e) { reject(e); }
        };
        img.onerror = () => reject(new Error('img load failed'));
        img.src = url;
    });
}

// Optional: if the Apps Script has the "getImage" snippet, it can return the Drive file as base64 (no CORS problem).
async function _rcptFetchViaScript(rawUrl) {
    const scriptUrl = window.GOOGLE_SCRIPT_URL || localStorage.getItem('driveScriptUrl');
    const m = String(rawUrl).match(/(?:id=|\/d\/|\/file\/d\/)([a-zA-Z0-9_-]{25,})/);
    if (!scriptUrl || !m) throw new Error('no script');
    const r = await fetch(scriptUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'getImage', fileId: m[1] }) });
    const j = await r.json();
    if (j && j.status === 'success' && j.data) return j.data;
    throw new Error('script has no getImage');
}

/** Returns an embeddable data-URL (or null if the image really cannot be read). */
async function receiptImageToDataUrl(rawUrl, opts = {}) {
    const { maxSide = 420, asPng = false } = opts;
    if (!isValidImageUrl(rawUrl) || rawUrl === FALLBACK_IMG) return null;
    const raw = String(rawUrl).trim();
    const cacheKey = `${raw}|${maxSide}|${asPng}`;
    if (_receiptImgCache.has(cacheKey)) return _receiptImgCache.get(cacheKey);

    const work = (async () => {
        if (raw.startsWith('data:image')) return _rcptNormalize(raw, maxSide, asPng);

        const isDriveFirst = /(?:id=|\/d\/|\/file\/d\/)([a-zA-Z0-9_-]{25,})/.test(raw);
        if (isDriveFirst) {
            const viaProxy = await window.driveImageViaScript(raw, maxSide);
            if (viaProxy) {
                const n = await _rcptNormalize(viaProxy, maxSide, asPng);
                if (n) return n;
            }
        }
        const candidates = [];
        const isDrive = isDriveFirst;
        if (isDrive) { for (let i = 0; i < 3; i++) candidates.push(getDirectDriveUrl(raw, i)); }
        else candidates.push(raw);

        for (const u of candidates) {
            for (const fn of [_rcptFetchViaCors, _rcptFetchViaImgTag]) {
                try {
                    const d = await fn(u);
                    const n = d ? await _rcptNormalize(d, maxSide, asPng) : null;
                    if (n) return n;
                } catch (e) { /* try next method */ }
            }
        }
        if (isDrive) {
            try {
                const d = await _rcptFetchViaScript(raw);
                const n = await _rcptNormalize(d, maxSide, asPng);
                if (n) return n;
            } catch (e) { /* not available */ }
        }
        return null;
    })();

    const result = await _rcptWithTimeout(work, 12000);
    if (result) _receiptImgCache.set(cacheKey, result); // never cache failures
    return result;
}
window.receiptImageToDataUrl = receiptImageToDataUrl;

// ---------- stock helpers ----------
function _rcptNodeQty(node) {
    if (!node) return null;
    if (node.batches && typeof node.batches === 'object' && Object.keys(node.batches).length > 0) {
        return Object.values(node.batches).reduce((s, b) => s + Math.max(0, parseInt(b?.currentQty ?? b?.currentStock ?? b?.quantity ?? 0, 10) || 0), 0);
    }
    const v = parseInt(node.currentQty ?? node.currentStock ?? node.quantity ?? node.availableStock ?? node.stock ?? 0, 10);
    return isNaN(v) ? 0 : Math.max(0, v);
}

function _rcptFindInvNode(inv, item) {
    if (!inv) return null;
    const sn = String(item.serialNumber || item.batchSerialNumber || item.serial || item.sn || item.itemId || '').trim();
    if (sn && inv[sn]) return inv[sn];
    const snL = sn.toLowerCase();
    const nameL = String(item.itemName || item.name || '').trim().toLowerCase();
    return Object.values(inv).find((n) => n && (
        (snL && String(n.serialNumber || n.batchNo || '').trim().toLowerCase() === snL) ||
        (nameL && String(n.itemName || n.name || '').trim().toLowerCase() === nameL)
    )) || null;
}
window._rcptNodeQty = _rcptNodeQty;
window._rcptFindInvNode = _rcptFindInvNode;

async function _rcptEnsureInventory() {
    if (inventoryData && Object.keys(inventoryData).length) return inventoryData;
    try { const s = await get(ref(db, 'inventory')); return s.val() || {}; } catch (e) { return {}; }
}

// ---------- builder ----------
function _rcptFmtDate(d) {
    try { return new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch (e) { return '-'; }
}

function _rcptBarcodeSvg(text) {
    try {
        if (typeof JsBarcode === 'undefined') return '';
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        JsBarcode(svg, String(text), { format: 'CODE128', height: 34, width: 1.4, displayValue: false, margin: 0 });
        svg.setAttribute('class', 'rcpt-barcode');
        svg.setAttribute('preserveAspectRatio', 'xMaxYMid meet');
        return svg.outerHTML;
    } catch (e) { return ''; }
}

/** Fetches the order, resolves every image, and returns { order, html }. */
async function buildReceiptForOrder(orderId, forExport) {
    const snap = await get(ref(db, `orders/${orderId}`));
    if (!snap.exists()) throw new Error('Order not found');
    const order = snap.val();
    const inv = await _rcptEnsureInventory();

    const statusRaw = String(order.status || 'Pending');
    const isCancelled = /cancel/i.test(statusRaw);
    const isDone = /done|completed/i.test(statusRaw);
    const isReady = !isDone && /approved|ready/i.test(statusRaw);
    const stCls = isCancelled ? 'rcpt-st-canc' : isDone ? 'rcpt-st-done' : isReady ? 'rcpt-st-ready' : 'rcpt-st-pend';
    const stTxt = isCancelled ? 'CANCELLED' : isDone ? 'ISSUED & COMPLETED' : isReady ? 'READY FOR PICKUP' : 'PENDING APPROVAL';

    const items = (Array.isArray(order.items) ? order.items : Object.values(order.items || {})).filter(Boolean);

    // Resolve all images in parallel
    const requesterRaw = order.requesterSignature || order.teacherRequestSignature || order.teacherSign || order.teacherSignature || order.signature || order.receiverSignature || '';
    const issuerRaw = order.authorizedSignature || order.handoverSignatureUrl || order.handoverSignature || order.issuerSign || order.adminSign || order.storekeeperSign || order.issuerSignature || '';
    const sigSrc = (raw) => { const f = formatSignatureSrc(raw); return f; };

    const [logoData, reqSigData, issSigData, ...itemImgs] = await Promise.all([
        receiptImageToDataUrl('school.png', { maxSide: 900, asPng: true }).then((d) => d ? _rcptTrim(d) : null),
        receiptImageToDataUrl(sigSrc(requesterRaw), { maxSide: 420, asPng: true }),
        receiptImageToDataUrl(sigSrc(issuerRaw), { maxSide: 420, asPng: true }),
        ...items.map((it) => {
            const node = _rcptFindInvNode(inv, it);
            const src = isValidImageUrl(it.imageUrl) ? it.imageUrl : (node && (node.imageUrl || node.image || node.photoUrl));
            return receiptImageToDataUrl(src, { maxSide: 260, asPng: false });
        })
    ]);

    const showSig = (data, rawSigUrl) => {
        if (data) return `<img src="${data}" alt="signature">`;
        if (!forExport && formatSignatureSrc(rawSigUrl)) return `<img src="${formatSignatureSrc(rawSigUrl)}" alt="signature" onerror="this.outerHTML='<span class=&quot;rcpt-sigtxt&quot;>✔ Digitally Signed</span>'">`;
        return rawSigUrl ? `<span class="rcpt-sigtxt">✔ Digitally Signed</span>` : '';
    };

    let totalReq = 0, totalIssued = 0;
    const rows = items.map((it, i) => {
        const node = _rcptFindInvNode(inv, it);
        const req = parseInt(it.requestQuantity || it.quantity || it.reqQty || 1, 10) || 1;
        let issued = isDone ? (it.issuedQty !== undefined ? parseInt(it.issuedQty, 10) || 0 : req) : null;
        totalReq += req; if (issued !== null) totalIssued += issued;

        // ORIGINAL stock (before this order was issued). Older orders fall back to "current + issued".
        let original = null, after = null, approx = false;
        if (it.stockBefore !== undefined && it.stockBefore !== null && it.stockBefore !== '') {
            original = parseInt(it.stockBefore, 10);
            after = (it.stockAfter !== undefined && it.stockAfter !== null) ? parseInt(it.stockAfter, 10) : Math.max(0, original - (issued || 0));
        } else {
            const cur = _rcptNodeQty(node);
            if (cur !== null) {
                if (isDone) { original = cur + (issued || 0); after = cur; approx = true; }
                else { original = cur; }
            }
        }
        const sn = it.serialNumber || it.batchSerialNumber || it.serial || it.sn || it.itemSn || (node && node.serialNumber) || 'N/A';
        const brand = it.brandName || (node && (node.brand || node.brandName)) || '';
        const unit = it.unit || (node && node.unit) || 'Pcs';
        const imgHtml = itemImgs[i] ? `<img class="rcpt-thumb" src="${itemImgs[i]}" alt="">` : `<div class="rcpt-noimg">No Photo</div>`;

        return `<tr>
            <td>${i + 1}</td>
            <td>${imgHtml}</td>
            <td class="l"><div class="rcpt-iname">${escapeHtml(it.itemName || it.name || 'Stationery Item')}</div>${brand ? `<div class="rcpt-isub">Brand: ${escapeHtml(brand)}</div>` : ''}${it.batchInfo ? `<div class="rcpt-isub">Batch: ${escapeHtml(it.batchInfo)}</div>` : ''}</td>
            <td><span class="rcpt-sn">${escapeHtml(String(sn))}</span></td>
            <td>${escapeHtml(unit)}</td>
            <td><b>${req}</b></td>
            <td class="rcpt-issued">${issued === null ? '—' : issued}</td>
            <td class="rcpt-stock">${original === null ? '—' : (approx ? '≈ ' : '') + original}<small>${after !== null && isDone ? 'After issue: ' + after : (isDone ? '' : 'Current stock')}</small></td>
        </tr>`;
    }).join('');

    const requesterName = order.teacherName || 'N/A';
    const issuerName = order.issuedBy || order.handedOverBy || (isDone ? 'Authorized Storekeeper' : '—');
    const completedAt = order.completedAt || order.stockDeductedAt || null;
    const barcode = _rcptBarcodeSvg(orderId);

    const html = `
    <div class="rcpt">
        <div class="rcpt-topbar"></div>
        <div class="rcpt-head">
            ${logoData ? `<img class="rcpt-logo" src="${logoData}" alt="Jern Yafoor Charter School">` : `<div><div class="rcpt-title">JERN YAFOOR CHARTER SCHOOL</div><div class="rcpt-sub">Abu Dhabi, United Arab Emirates</div></div>`}
            <div class="rcpt-title-box">
                <p class="rcpt-title">STATIONERY REQUISITION &amp; ISSUE VOUCHER</p>
                <p class="rcpt-sub">Department of Educational Stationery &amp; Supplies</p>
                <span class="rcpt-status ${stCls}">${stTxt}</span>
            </div>
        </div>
        <div class="rcpt-meta">
            <div>Voucher No.<b>${escapeHtml(orderId)}</b></div>
            <div>Requested On<b>${escapeHtml(_rcptFmtDate(order.timestamp || order.requestedAt))}</b></div>
            <div>${isDone ? 'Issued On' : 'Status Updated'}<b>${escapeHtml(_rcptFmtDate(completedAt || order.approvedAt || order.timestamp))}</b></div>
            <div>${barcode}</div>
        </div>
        <div class="rcpt-cols">
            <div class="rcpt-box">
                <h4>Requester Information</h4>
                <div class="rcpt-row"><span>Staff Name</span><b>${escapeHtml(requesterName)}</b></div>
                <div class="rcpt-row"><span>Staff / ADEK ID</span><b>${escapeHtml(String(order.teacherUid || order.teacherId || 'N/A'))}</b></div>
                <div class="rcpt-row"><span>Department</span><b>${escapeHtml(order.department || order.section || 'Educational Staff')}</b></div>
            </div>
            <div class="rcpt-box">
                <h4>Issuance &amp; Store Details</h4>
                <div class="rcpt-row"><span>Issued By</span><b>${escapeHtml(issuerName)}</b></div>
                <div class="rcpt-row"><span>Pickup / Dispatch Location</span><b>${escapeHtml(order.pickupLocation && order.pickupLocation !== 'Awaiting Admin Details' ? order.pickupLocation : 'Main Stationery Store')}</b></div>
                <div class="rcpt-row"><span>Total Items</span><b>${items.length} item(s)</b></div>
            </div>
        </div>
        <div class="rcpt-sec">
            <h3>Items Issued</h3>
            <table class="rcpt-table">
                <thead><tr>
                    <th style="width:26px">#</th><th style="width:58px">Photo</th><th>Item Description</th>
                    <th style="width:92px">Serial / Batch</th><th style="width:40px">Unit</th>
                    <th style="width:48px">Req Qty</th><th style="width:54px">Issued Qty</th><th style="width:92px">Stock Balance (Original)</th>
                </tr></thead>
                <tbody>${rows || '<tr><td colspan="8">No items</td></tr>'}
                    <tr class="rcpt-total"><td colspan="5" style="text-align:right">TOTAL</td><td>${totalReq}</td><td>${isDone ? totalIssued : '—'}</td><td></td></tr>
                </tbody>
            </table>
        </div>
        <div class="rcpt-signs">
            <div class="rcpt-sign">
                <div class="rcpt-sigimg">${showSig(reqSigData, requesterRaw)}</div>
                <div class="rcpt-signlbl">REQUESTER SIGNATURE</div>
                <div class="rcpt-signsub">${escapeHtml(requesterName)}</div>
            </div>
            <div class="rcpt-sign">
                <div class="rcpt-sigimg">${showSig(issSigData, issuerRaw)}</div>
                <div class="rcpt-signlbl">AUTHORIZED STOREKEEPER</div>
                <div class="rcpt-signsub">${escapeHtml(issuerName)}</div>
            </div>
            <div class="rcpt-sign" style="flex:.6">
                <div class="rcpt-seal">SCHOOL<br>SEAL</div>
                <div class="rcpt-signlbl">OFFICIAL STAMP</div>
            </div>
        </div>
        <div class="rcpt-foot">
            <b>Notice:</b> Issued items are strictly for official educational use within Jern Yafoor Charter School premises.<br>
            Computer-generated voucher from the Jern Yafoor Stationery Tracking System &bull; Printed on ${escapeHtml(_rcptFmtDate(Date.now()))}
        </div>
    </div>`;

    return { order, html };
}

function _rcptFitZoom() {
    const avail = Math.min(800, window.innerWidth - 12);
    return Math.min(1, avail / RECEIPT_WIDTH_PX);
}

window._currentReceiptOrderId = null;

window.viewOrderReceipt = async function(orderId) {
    try {
        window.showGlobalLoader("Preparing voucher...");
        const { html } = await buildReceiptForOrder(orderId, false);
        window._currentReceiptOrderId = orderId;
        const holder = $('receipt-content');
        if (!holder) throw new Error('Receipt container missing');
        holder.innerHTML = `<style>${RECEIPT_CSS}</style>${html}`;
        holder.style.zoom = _rcptFitZoom();
        bootstrap.Modal.getOrCreateInstance($('receiptModal')).show();
    } catch (e) {
        console.error(e);
        showToast(e.message || 'Could not open voucher', 'error');
    } finally {
        window.hideGlobalLoader();
    }
};

function _rcptResolveId(orderId) { return orderId || window._currentReceiptOrderId; }

window.downloadReceiptPDF = async function(orderId) {
    const id = _rcptResolveId(orderId);
    if (!id) return;
    if (typeof html2pdf === 'undefined') { showToast('PDF library not loaded. Check internet.', 'error'); return; }
    let host = null;
    try {
        window.showGlobalLoader("Creating PDF...");
        const { html } = await buildReceiptForOrder(id, true); // export mode: only embedded images
        host = document.createElement('div');
        host.style.cssText = `position:fixed;left:-10000px;top:0;width:${RECEIPT_WIDTH_PX}px;background:#fff;z-index:-1;`;
        host.innerHTML = `<style>${RECEIPT_CSS}</style>${html}`;
        document.body.appendChild(host);
        await new Promise((r) => setTimeout(r, 150)); // let layout settle
        await html2pdf().set({
            margin: 0,
            filename: `Stationery_Voucher_${id}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, allowTaint: false, backgroundColor: '#ffffff', windowWidth: RECEIPT_WIDTH_PX, scrollX: 0, scrollY: 0 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak: { mode: ['css', 'legacy'], avoid: ['tr', '.rcpt-signs', '.rcpt-foot'] }
        }).from(host.querySelector('.rcpt')).save();
    } catch (e) {
        console.error('PDF error', e);
        showToast('PDF failed: ' + (e.message || e), 'error');
    } finally {
        if (host) host.remove();
        window.hideGlobalLoader();
    }
};

window.printReceipt = async function(orderId) {
    const id = _rcptResolveId(orderId);
    if (!id) return;
    try {
        window.showGlobalLoader("Preparing print...");
        const { html } = await buildReceiptForOrder(id, true);
        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
        document.body.appendChild(iframe);
        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Voucher ${escapeHtml(id)}</title>
            <style>@page{size:A4;margin:8mm}html,body{margin:0;padding:0;background:#fff}
            .rcpt{width:100% !important;max-width:none !important}
            *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
            ${RECEIPT_CSS.replace(/\.rcpt\{width:\d+px;max-width:\d+px;/, '.rcpt{')}</style></head><body>${html}</body></html>`);
        doc.close();
        window.hideGlobalLoader();
        const go = () => {
            try { iframe.contentWindow.focus(); iframe.contentWindow.print(); } catch (e) { showToast('Print failed', 'error'); }
            setTimeout(() => iframe.remove(), 60000);
        };
        if (iframe.contentWindow.document.readyState === 'complete') setTimeout(go, 250);
        else iframe.onload = () => setTimeout(go, 250);
    } catch (e) {
        window.hideGlobalLoader();
        console.error('Print error', e);
        showToast('Print failed: ' + (e.message || e), 'error');
    }
};

// Direct actions used by the history lists (no need to open the preview first)
window.downloadOrderReceipt = (orderId) => window.downloadReceiptPDF(orderId);
window.printOrderReceipt = (orderId) => window.printReceipt(orderId);


// ==================== SYSTEM / STAFF ====================
function fetchStaffList() {
    if (window.__v230FetchStaff) return window.__v230FetchStaff(); // v2.3.0: search / edit / designation
    addListener(ref(db, 'users'), (snapshot) => {
        const list = $('admin-staff-list'); if (!list) return;
        list.innerHTML = '';
        Object.entries(snapshot.val() || {}).forEach(([id, user]) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td><strong>${escapeHtml(user.adecPassNumber || id)}</strong></td><td>${escapeHtml(user.name || 'N/A')}</td><td><span class="badge bg-info">${user.role}</span></td><td><code>••••</code></td><td><button class="remove-item-btn">Delete</button></td>`;
            tr.querySelector('button').onclick = async () => { if(confirm("Delete?")) await remove(ref(db, `users/${id}`)); };
            list.appendChild(tr);
        });
    });
}

function fetchAuditLogs() {
    addListener(ref(db, 'audit_logs'), (snap) => {
        const list = $('audit-logs-list'); if (!list) return;
        list.innerHTML = '';
        Object.values(snap.val() || {}).reverse().slice(0, 50).forEach(log => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${new Date(log.timestamp).toLocaleString()}</td><td>${escapeHtml(log.user)}</td><td>${escapeHtml(log.action)}</td><td>${escapeHtml(log.details)}</td>`;
            list.appendChild(tr);
        });
    });
}

async function updateDriveStatus() {
    const url = window.GOOGLE_SCRIPT_URL || localStorage.getItem('driveScriptUrl');
    if (!url) return;
    try {
        const res = await fetch(url, { method: 'POST', body: JSON.stringify({ action: 'status' }), headers: {'Content-Type': 'text/plain'} });
        const result = await res.json();
        if (result.status === 'success') {
            updateDriveUIStatus(true, "Connected (Active)");
            $('drive-storage-text').textContent = `${result.storageUsed || result.used || '0 MB'} / ${result.total || '15 GB'} Used`;
            $('drive-storage-bar').style.width = result.percent || '0%';
        }
    } catch (e) { }
}

function fetchSystemBranding() {
    addListener(ref(db, 'settings/logo'), (snap) => {
        if (snap.val()) document.querySelectorAll('#school-logo, .centered-school-logo, .sidebar-logo-img, .header-brand-logo').forEach(img => img.src = snap.val());
    });
}

window.handleAddCategory = async function(event) {
    if (event) event.preventDefault();

    const categoryInput = $('category-name-input');
    if (!categoryInput) return;

    const categoryName = categoryInput.value.trim();
    if (!categoryName) {
        alert("Please enter a valid category name.");
        return;
    }

    const btn = $('btn-add-category');
    if (btn) btn.disabled = true;

    try {
        const snapshot = await get(ref(db, 'settings/categories'));
        let exists = false;
        if (snapshot.exists()) {
            const categories = snapshot.val();
            Object.values(categories).forEach((name) => {
                if (String(name).toLowerCase() === categoryName.toLowerCase()) {
                    exists = true;
                }
            });
        }

        if (exists) {
            alert("This category already exists!");
            if (btn) btn.disabled = false;
            return;
        }

        await push(ref(db, 'settings/categories'), categoryName);

        categoryInput.value = '';
        showToast(`Category "${categoryName}" added!`);
    } catch (error) {
        console.error("Error adding category:", error);
        alert("Failed to add category: " + error.message);
    } finally {
        if (btn) btn.disabled = false;
    }
};

window.listenAndPopulateCategories = function() {
    addListener(ref(db, 'settings/categories'), (snapshot) => {
        const dropdownElements = document.querySelectorAll('.category-select-element');
        const list = $('system-categories-list');

        let dbCategories = [];
        if (snapshot.exists()) {
            const data = snapshot.val();
            if (typeof data === 'object') {
                dbCategories = Object.values(data);
            }
        }

        // De-duplicated list of all 27 categories + DB categories
        const categorySet = new Set([...ALL_STATIONERY_CATEGORIES, ...dbCategories]);
        const combinedCategories = Array.from(categorySet);

        // Calculate live category counts
        const categoryCounts = {};
        Object.values(inventoryData || {}).forEach(catData => {
            const catName = (catData.category || catData.itemCategory || assignCategoryToItem(catData)).trim();
            categoryCounts[catName] = (categoryCounts[catName] || 0) + 1;
        });

        let optionsHtml = '<option value="" disabled selected>Select Category</option>';
        let filterOptionsHtml = '<option value="">All Categories</option>';
        if (list) list.innerHTML = '';

        combinedCategories.forEach((name) => {
            const count = categoryCounts[name] || 0;
            optionsHtml += `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`;
            filterOptionsHtml += `<option value="${escapeHtml(name)}">${escapeHtml(name)} (${count} item${count === 1 ? '' : 's'})</option>`;

            if (list) {
                const li = document.createElement('li');
                li.className = 'category-item d-flex justify-content-between align-items-center py-1 border-bottom';
                li.innerHTML = `<span>${escapeHtml(name)} <small class="text-muted">(${count} items)</small></span>`;
                list.appendChild(li);
            }
        });

        optionsHtml += '<option value="Other">Other (Custom)</option>';

        dropdownElements.forEach((selectEl) => {
            if (selectEl) {
                const isFilter = selectEl.id.includes('filter');
                const currentVal = selectEl.value;
                selectEl.innerHTML = isFilter ? filterOptionsHtml : optionsHtml;
                if (currentVal) selectEl.value = currentVal;
            }
        });
    });
};

window.handleCategorySelectionForForm = function(selectedCat) {
    const customGroup = $('custom-category-group');
    const isOther = (selectedCat === 'Other' || selectedCat === 'Others' || selectedCat === 'Other (Custom)');

    if (customGroup) {
        customGroup.style.display = isOther ? 'block' : 'none';
        const customInput = $('inv-custom-category');
        if (customInput) {
            customInput.required = isOther;
            if (!isOther) customInput.value = '';
        }
    }

    const titleEl = $('category-items-mirror-title');
    const searchWrapper = $('category-items-search-wrapper');
    const searchInput = $('category-items-search-input');

    if (searchInput) searchInput.value = '';

    if (!selectedCat || isOther) {
        if (titleEl) titleEl.innerText = "Items in Selected Category";
        if (searchWrapper) searchWrapper.style.display = 'none';
        const listEl = $('category-items-mirror-list');
        if (listEl) {
            listEl.innerHTML = isOther
                ? '<p class="text-muted small mb-0 p-2 text-center">Custom category selected. Enter custom category and item name below.</p>'
                : '<p class="text-muted small mb-0 p-2 text-center">Select a category to view available items.</p>';
        }
        return;
    }

    if (titleEl) titleEl.innerText = `Items in ${selectedCat}`;
    window.renderCategoryItemsMirror(selectedCat, '');
};

window.handleCategoryItemSearch = function(term) {
    const selectedCat = $('item-category-dropdown')?.value || '';
    if (selectedCat && selectedCat !== 'Other' && selectedCat !== 'Others') {
        window.renderCategoryItemsMirror(selectedCat, term);
    }
};

window.selectMirroredItem = function(name, sn, desc, radioId) {
    if (!name) return;

    if ($('inv-item-name')) {
        $('inv-item-name').value = name;
    }
    if ($('inv-serial-number') && sn && !$('inv-serial-number').value) {
        $('inv-serial-number').value = sn;
    }
    if ($('inv-description') && desc && !$('inv-description').value) {
        $('inv-description').value = desc;
    }

    if (radioId && $(radioId)) {
        $(radioId).checked = true;
    }

    document.querySelectorAll('.category-item-card').forEach(card => card.classList.remove('selected-card'));
    if (radioId) {
        const cardEl = document.getElementById(`card_${radioId}`);
        if (cardEl) cardEl.classList.add('selected-card');
    }

    if (typeof showToast === 'function') {
        showToast(`Selected "${name}"`, 'success');
    }
};

window.triggerNewItemInput = function() {
    const radio = document.getElementById('radio_new_item_option');
    if (radio) radio.checked = true;

    document.querySelectorAll('.category-item-card').forEach(c => c.classList.remove('selected-card'));
    const card = document.getElementById('card_radio_new_item_option');
    if (card) card.classList.add('selected-card');

    const inputContainer = document.getElementById('new-item-input-container');
    if (inputContainer) {
        inputContainer.style.display = 'block';
        const input = document.getElementById('custom-new-item-name-input');
        if (input) {
            input.focus();
        }
    }
};

window.confirmCustomNewItemName = function(selectedCat) {
    const input = document.getElementById('custom-new-item-name-input');
    if (!input) return;

    const newItemName = input.value.trim();
    if (!newItemName) {
        if (typeof showToast === 'function') showToast("Please enter the new item name.", "warning");
        else alert("Please enter the new item name.");
        input.focus();
        return;
    }

    if (newItemName.toLowerCase() === (selectedCat || '').trim().toLowerCase()) {
        if (typeof showToast === 'function') showToast("Item name cannot be identical to category name.", "warning");
        else alert("Item name cannot be identical to category name.");
        return;
    }

    // Populate Item Name field
    if ($('inv-item-name')) {
        $('inv-item-name').value = newItemName;
    }

    // Persist new item in STATIONERY_CATEGORY_ITEMS_MASTER for this category
    if (selectedCat && STATIONERY_CATEGORY_ITEMS_MASTER[selectedCat]) {
        const exists = STATIONERY_CATEGORY_ITEMS_MASTER[selectedCat].some(i => (i.name || '').toLowerCase() === newItemName.toLowerCase());
        if (!exists) {
            STATIONERY_CATEGORY_ITEMS_MASTER[selectedCat].push({ name: newItemName });
        }
    }

    if (typeof showToast === 'function') {
        showToast(`Selected "${newItemName}" in category "${selectedCat}"`, "success");
    }
};

window.renderCategoryItemsMirror = function(selectedCat, searchTerm = '') {
    const listEl = $('category-items-mirror-list');
    const searchWrapper = $('category-items-search-wrapper');
    if (!listEl) return;

    const isOther = (selectedCat === 'Other' || selectedCat === 'Others' || selectedCat === 'Other (Custom)');
    if (!selectedCat || isOther) {
        if (searchWrapper) searchWrapper.style.display = 'none';
        listEl.innerHTML = isOther
            ? '<p class="text-muted small mb-0 p-2 text-center">Custom category selected. Enter custom category and item name below.</p>'
            : '<p class="text-muted small mb-0 p-2 text-center">Select a category to view available items.</p>';
        return;
    }

    const normCat = selectedCat.trim().toLowerCase();

    // 1. Get pre-populated master items for this category from STATIONERY_CATEGORY_ITEMS_MASTER
    const masterItems = STATIONERY_CATEGORY_ITEMS_MASTER[selectedCat] || STATIONERY_CATEGORY_ITEMS_MASTER[
        Object.keys(STATIONERY_CATEGORY_ITEMS_MASTER).find(k => k.toLowerCase() === normCat)
    ] || [];

    const itemsMap = new Map();

    // Add master items (CRITICAL: exclude category name itself)
    masterItems.forEach(item => {
        const iName = (item.name || '').trim();
        if (iName && iName.toLowerCase() !== normCat) {
            itemsMap.set(iName.toLowerCase(), {
                name: iName,
                serialNumber: item.serialNumber || '',
                description: item.description || ''
            });
        }
    });

    // 2. Add real inventory items from Firebase (inventoryData)
    const sourceData = inventoryData || {};
    Object.entries(sourceData).forEach(([catId, catData]) => {
        const itemCategory = (catData.category || catData.itemCategory || assignCategoryToItem(catData)).trim();
        if (itemCategory.toLowerCase() === normCat || catId.toLowerCase() === normCat) {
            const itemName = (catData.itemName || catData.name || '').trim();
            // CRITICAL FIX: EXCLUDE category name itself if it was saved as item name!
            if (itemName && itemName.toLowerCase() !== normCat && catId.toLowerCase() !== normCat) {
                const sn = catData.serialNumber || catData.sn || '';
                const desc = catData.description || catData.desc || '';
                itemsMap.set(itemName.toLowerCase(), {
                    name: itemName,
                    serialNumber: sn,
                    description: desc
                });
            }
        }
    });

    const allItems = Array.from(itemsMap.values());

    if (searchWrapper) searchWrapper.style.display = 'block';

    const term = (searchTerm || '').trim().toLowerCase();
    const filtered = term ? allItems.filter(i => i.name.toLowerCase().includes(term) || i.serialNumber.toLowerCase().includes(term)) : allItems;

    // Build selectable responsive card list
    let html = '<div class="category-cards-wrapper">';
    if (filtered.length > 0) {
        filtered.forEach((item, idx) => {
            const radioId = `cat_item_radio_${idx}`;
            html += `
                <div class="category-item-card" id="card_${radioId}">
                    <div class="category-item-card-left">
                        <input type="radio" name="category_item_radio" id="${radioId}" class="form-check-input mt-1 category-item-radio"
                               value="${escapeHtml(item.name)}"
                               data-name="${escapeHtml(item.name)}"
                               data-sn="${escapeHtml(item.serialNumber)}"
                               data-desc="${escapeHtml(item.description)}">
                        <label for="${radioId}" class="category-item-name mb-0 cursor-pointer">
                            ${escapeHtml(item.name)}
                            ${item.serialNumber ? `<div class="text-muted small font-normal fw-normal">SN: ${escapeHtml(item.serialNumber)}</div>` : ''}
                        </label>
                    </div>
                    <button type="button" class="btn btn-sm btn-primary category-item-select-btn" onclick="window.selectMirroredItem('${escapeHtml(item.name)}', '${escapeHtml(item.serialNumber)}', '${escapeHtml(item.description)}', '${radioId}')">
                        Select
                    </button>
                </div>
            `;
        });
    } else {
        html += `<p class="text-muted small mb-0 p-2 text-center">No predefined items matching "${escapeHtml(searchTerm)}". You can add a new item below.</p>`;
    }

    // ALWAYS DYNAMICALLY APPEND "+ New / Other Item" AT THE BOTTOM OF EVERY CATEGORY!
    html += `
        <div class="category-item-card border-primary bg-light mt-2" id="card_radio_new_item_option" style="border-style: dashed !important; border-width: 2px !important;">
            <div class="category-item-card-left">
                <input type="radio" name="category_item_radio" id="radio_new_item_option" class="form-check-input mt-1 category-item-radio" value="__NEW_ITEM__">
                <label for="radio_new_item_option" class="category-item-name mb-0 text-primary cursor-pointer fw-bold">
                    <i class="bi bi-plus-circle-fill me-1"></i>＋ New / Other Item
                    <div class="text-muted small font-normal fw-normal">Add a custom new item under category "${escapeHtml(selectedCat)}"</div>
                </label>
            </div>
            <button type="button" class="btn btn-sm btn-outline-primary category-item-select-btn fw-bold" onclick="window.triggerNewItemInput()">
                Select
            </button>
        </div>
        <div id="new-item-input-container" class="p-3 border rounded bg-white shadow-sm mt-2" style="display: none;">
            <label for="custom-new-item-name-input" class="form-label small fw-bold text-primary mb-1">
                New Item Name for category "${escapeHtml(selectedCat)}"
            </label>
            <div class="input-group input-group-sm mb-2">
                <input type="text" id="custom-new-item-name-input" class="form-control form-control-sm" placeholder="e.g. Gel Pen - Purple">
                <button type="button" class="btn btn-success fw-bold px-3" onclick="window.confirmCustomNewItemName('${escapeHtml(selectedCat)}')">
                    Use This Item
                </button>
            </div>
            <small class="text-muted">Item will inherit category "${escapeHtml(selectedCat)}" when saved.</small>
        </div>
    `;

    html += '</div>';

    listEl.innerHTML = html;

    // Attach click/change handlers to radio buttons
    listEl.querySelectorAll('.category-item-radio').forEach(radio => {
        radio.onchange = () => {
            if (!radio.checked) return;
            if (radio.value === '__NEW_ITEM__') {
                window.triggerNewItemInput();
            } else {
                const inputContainer = document.getElementById('new-item-input-container');
                if (inputContainer) inputContainer.style.display = 'none';
                window.selectMirroredItem(radio.dataset.name, radio.dataset.sn, radio.dataset.desc, radio.id);
            }
        };
    });
};

async function uploadLogo(file) {
    const reader = new FileReader();
    const base = await new Promise((res) => { reader.onload = () => res(reader.result); reader.readAsDataURL(file); });
    await set(ref(db, 'settings/logo'), base);
    showToast("Logo Updated!");
}

async function addCategory(name) {
    await push(ref(db, 'settings/categories'), name);
    $('category-name-input').value = '';
    showToast("Added!");
}

function pickImg(o) {
    if (!o || typeof o !== 'object') return '';
    const keys = ['imageUrl','imageURL','image','photoUrl','photoURL','photo','itemImageUrl','itemImage','img','imgUrl','picture','thumbnail','photoBase64','url'];
    for (const k of keys) { const v = o[k]; if (typeof v === 'string' && v.trim() && isValidImageUrl(v)) return v.trim(); }
    return '';
}
window.pickImg = pickImg;

function getFlatInventoryList() {
    const list = [];
    const sourceData = inventoryData || {};
    Object.entries(sourceData).forEach(([catId, catData]) => {
        const category = catData.category || catId || 'General';
        const itemName = catData.itemName || catData.name || catId || 'N/A';
        const batches = catData.batches || {};
        const batchEntries = Object.entries(batches);

        if (batchEntries.length > 0) {
            batchEntries.forEach(([batchId, b]) => {
                const curStock = parseInt(b.currentStock ?? b.quantity ?? 0);
                const initQty = parseInt(b.initialQty ?? b.openingQuantity ?? b.totalQty ?? curStock);
                list.push({
                    category: category,
                    name: itemName,
                    itemName: itemName,
                    imageUrl: pickImg(b) || pickImg(catData),
                    photo: pickImg(b) || pickImg(catData),
                    image: pickImg(b) || pickImg(catData),
                    brand: b.brandName || b.brand || b.manufacturer || catData.brand || 'Standard',
                    manufacturer: b.brandName || b.brand || b.manufacturer || catData.brand || 'Standard',
                    serialNumber: b.serialNumber || b.batchNo || catData.serialNumber || 'N/A',
                    batchNo: b.serialNumber || b.batchNo || catData.serialNumber || 'N/A',
                    unit: catData.unit || b.unit || 'Pcs',
                    receivedDate: b.receivedDate || b.date || (catData.createdAt ? catData.createdAt.split('T')[0] : 'N/A'),
                    date: b.receivedDate || b.date || (catData.createdAt ? catData.createdAt.split('T')[0] : 'N/A'),
                    currentStock: curStock,
                    quantity: curStock,
                    initialQty: initQty,
                    totalQty: initQty,
                    status: b.status || (curStock > 0 ? 'In Stock' : 'Out of Stock')
                });
            });
        } else {
            const curStock = parseInt(catData.currentStock ?? catData.quantity ?? catData.availableStock ?? 0);
            const initQty = parseInt(catData.initialQty ?? catData.openingQuantity ?? catData.totalQty ?? catData.quantity ?? curStock);
            list.push({
                category: category,
                name: itemName,
                itemName: itemName,
                imageUrl: pickImg(catData),
                photo: pickImg(catData),
                image: pickImg(catData),
                brand: catData.brand || catData.brandName || catData.manufacturer || 'Standard',
                manufacturer: catData.brand || catData.brandName || catData.manufacturer || 'Standard',
                serialNumber: catData.serialNumber || catData.batchNo || 'N/A',
                batchNo: catData.serialNumber || catData.batchNo || 'N/A',
                unit: catData.unit || 'Pcs',
                receivedDate: catData.receivedDate || catData.date || (catData.createdAt ? catData.createdAt.split('T')[0] : 'N/A'),
                date: catData.receivedDate || catData.date || (catData.createdAt ? catData.createdAt.split('T')[0] : 'N/A'),
                currentStock: curStock,
                quantity: curStock,
                initialQty: initQty,
                totalQty: initQty,
                status: catData.status || (curStock > 0 ? 'In Stock' : 'Out of Stock')
            });
        }
    });
    return list;
}

function downloadExcelWorkbook(reportRows, fileName = 'Master_Inventory_Report_Full.xlsx') {
    if (window.XLSX) {
        const ws = XLSX.utils.aoa_to_sheet(reportRows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Master Inventory");
        XLSX.writeFile(wb, fileName);
    } else if (window.ExcelJS) {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Master Inventory');
        reportRows.forEach(row => worksheet.addRow(row));
        workbook.xlsx.writeBuffer().then(buffer => {
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            if (window.saveAs) {
                saveAs(blob, fileName);
            } else {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                a.click();
                URL.revokeObjectURL(url);
            }
        });
    } else {
        let csvContent = "data:text/csv;charset=utf-8," + reportRows.map(e => e.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", fileName.replace('.xlsx', '.csv'));
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

function exportFullInventoryReport() {
    const inventoryDataList = (window.masterInventoryList && Array.isArray(window.masterInventoryList) && window.masterInventoryList.length > 0)
        ? window.masterInventoryList
        : getFlatInventoryList();

    const reportRows = [
        ['Category', 'Item Name', 'Photo Link', 'Brand / Manufacturer', 'Serial / Batch No.', 'Received Date', 'Current Stock', 'Initial Qty', 'Status']
    ];

    inventoryDataList.forEach(item => {
        reportRows.push([
            item.category || 'General',
            item.name || item.itemName || 'N/A',
            item.imageUrl || item.photo || item.image || 'No Photo',
            item.brand || item.manufacturer || 'Standard',
            item.serialNumber || item.batchNo || 'N/A',
            item.receivedDate || item.date || 'N/A',
            item.currentStock ?? item.quantity ?? 0,
            item.initialQty ?? item.totalQty ?? 0,
            item.status || (item.currentStock > 0 ? 'In Stock' : 'Out of Stock')
        ]);
    });

    downloadExcelWorkbook(reportRows, 'Master_Inventory_Report_Full.xlsx');
}

function printInventoryReport() {
    const list = (window.masterInventoryList && Array.isArray(window.masterInventoryList) && window.masterInventoryList.length > 0)
        ? window.masterInventoryList
        : getFlatInventoryList();

    if (!list || list.length === 0) {
        if (typeof showToast === 'function') showToast("No inventory items available to print", "warning");
        else alert("No inventory items available to print.");
        return;
    }

    const printWindow = window.open('', '_blank', 'width=1000,height=800');
    if (!printWindow) {
        alert("Please allow popups for this site to print the report.");
        return;
    }

    const rowsHtml = list.map(item => {
        const rawImg = item.imageUrl || item.photo || item.image;
        const imgUrl = (rawImg && rawImg !== 'No Photo') ? rawImg : FALLBACK_IMG;
        const category = escapeHtml(item.category || 'General');
        const itemName = escapeHtml(item.name || item.itemName || 'N/A');
        const brand = escapeHtml(item.brand || item.manufacturer || 'Standard');
        const serial = escapeHtml(item.serialNumber || item.batchNo || 'N/A');
        const receivedDate = escapeHtml(item.receivedDate || item.date || 'N/A');
        const initialQty = item.initialQty ?? item.totalQty ?? 0;
        const currentStock = item.currentStock ?? item.quantity ?? 0;
        const status = escapeHtml(item.status || (currentStock > 0 ? 'In Stock' : 'Out of Stock'));
        const statusClass = currentStock > 10 ? 'status-in-stock' : (currentStock > 0 ? 'status-low-stock' : 'status-out-of-stock');

        return `
            <tr>
                <td style="text-align: center; vertical-align: middle;">
                    <img src="${imgUrl}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px;" onerror="this.src='${FALLBACK_IMG}'" alt="${itemName}">
                </td>
                <td style="vertical-align: middle;">
                    <div style="font-weight: bold; font-size: 13px; color: #0f172a;">${itemName}</div>
                    <div style="font-size: 11px; color: #64748b;">Category: ${category}</div>
                </td>
                <td style="vertical-align: middle;">${brand}</td>
                <td style="vertical-align: middle;"><code>${serial}</code></td>
                <td style="vertical-align: middle;">${receivedDate}</td>
                <td style="text-align: center; vertical-align: middle;">${initialQty}</td>
                <td style="text-align: center; vertical-align: middle; font-weight: bold;">${currentStock}</td>
                <td style="text-align: center; vertical-align: middle;">
                    <span class="badge-status ${statusClass}">${status}</span>
                </td>
            </tr>
        `;
    }).join('');

    const todayStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    const reportHtml = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Master Inventory Full Report - ${todayStr}</title>
    <style>
        body {
            font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
            margin: 20px;
            color: #1e293b;
            background: #ffffff;
        }
        .report-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #0f172a;
            padding-bottom: 12px;
            margin-bottom: 20px;
        }
        .report-header h1 {
            margin: 0;
            font-size: 22px;
            color: #0f172a;
        }
        .report-header .meta {
            text-align: right;
            font-size: 12px;
            color: #64748b;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
        }
        th {
            background-color: #f8fafc;
            color: #334155;
            font-weight: 700;
            text-align: left;
            padding: 10px;
            border-bottom: 2px solid #cbd5e1;
        }
        td {
            padding: 8px 10px;
            border-bottom: 1px solid #e2e8f0;
        }
        tr:nth-child(even) {
            background-color: #f8fafc;
        }
        code {
            font-family: monospace;
            background: #f1f5f9;
            padding: 2px 5px;
            border-radius: 4px;
            font-size: 11px;
        }
        .badge-status {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 700;
        }
        .status-in-stock { background: #dcfce7; color: #166534; }
        .status-low-stock { background: #fef9c3; color: #854d0e; }
        .status-out-of-stock { background: #fee2e2; color: #991b1b; }
        @media print {
            body { margin: 0; }
            .no-print { display: none !important; }
            @page { size: auto; margin: 10mm; }
        }
    </style>
</head>
<body>
    <div class="no-print" style="margin-bottom: 15px; text-align: right;">
        <button onclick="window.print()" style="background: #2563eb; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: bold;">🖨️ Print Report</button>
        <button onclick="window.close()" style="background: #64748b; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; margin-left: 8px;">Close</button>
    </div>
    <div class="report-header">
        <div>
            <h1>Master Inventory Full Report</h1>
            <div style="font-size: 13px; color: #475569; margin-top: 4px;">Stationery & Supplies Tracker</div>
        </div>
        <div class="meta">
            <div><strong>Generated:</strong> ${todayStr}</div>
            <div><strong>Total Items:</strong> ${list.length}</div>
        </div>
    </div>
    <table>
        <thead>
            <tr>
                <th style="width: 50px; text-align: center;">Image</th>
                <th>Item Name & Category</th>
                <th>Brand</th>
                <th>Serial / Batch</th>
                <th>Received Date</th>
                <th style="text-align: center;">Initial Qty</th>
                <th style="text-align: center;">Current Stock</th>
                <th style="text-align: center;">Status</th>
            </tr>
        </thead>
        <tbody>
            ${rowsHtml}
        </tbody>
    </table>
</body>
</html>`;

    printWindow.document.write(reportHtml);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
        printWindow.print();
    }, 500);
}

const exportInventory = exportFullInventoryReport;

// Bind to window
window.getFlatInventoryList = getFlatInventoryList;
window.downloadExcelWorkbook = downloadExcelWorkbook;
window.exportFullInventoryReport = exportFullInventoryReport;
window.exportMasterInventoryExcel = exportFullInventoryReport;
window.generateInventoryReport = exportFullInventoryReport;
window.exportInventory = exportFullInventoryReport;
window.printInventoryReport = printInventoryReport;
window.printReport = printInventoryReport;

async function exportHistory() {
    const data = [];
    Object.values((await get(ref(db, 'orders'))).val() || {}).forEach(o => {
        (o.items || []).forEach(i => {
            data.push({ 'ID': o.orderId, 'Staff': o.teacherName, 'Item': i.itemName, 'Qty': i.requestQuantity, 'Date': o.timestamp });
        });
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Order_History");
    XLSX.writeFile(wb, `History_${Date.now()}.xlsx`);
}

window.openEditItemModal = function(itemId) {
    console.log("Editing item ID:", itemId);
    const item = window.allInventoryItems ? window.allInventoryItems.find(i => i.id === itemId) : null;

    if (!item) {
        alert("Item data not found!");
        return;
    }

    if ($('edit-item-id')) $('edit-item-id').value = item.id;
    if ($('edit-item-name')) $('edit-item-name').value = item.itemName || '';
    if ($('edit-item-sn')) $('edit-item-sn').value = item.serialNumber || '';
    if ($('edit-item-category')) $('edit-item-category').value = item.category || '';
    if ($('edit-item-opening-qty')) $('edit-item-opening-qty').value = item.openingQuantity || 0;
    if ($('edit-item-available-qty')) $('edit-item-available-qty').value = item.quantity || 0;
    if ($('edit-item-description')) $('edit-item-description').value = item.description || '';

    const editModal = new bootstrap.Modal($('editItemModal'));
    editModal.show();
};

window.deleteInventoryItem = async function(itemId, itemName) {
    if (!confirm(`Are you sure you want to delete "${itemName || 'this item'}" permanently?`)) {
        return;
    }

    try {
        console.log("Deleting item from Firebase:", itemId);
        await remove(ref(db, 'inventory/' + itemId));
        await logActivity("Inventory Deleted", `Item: ${itemName} (${itemId})`);
        showToast(`"${itemName || 'Item'}" deleted successfully!`);
    } catch (error) {
        console.error("Error deleting item:", error);
        showToast("Failed to delete item: " + error.message, "error");
    }
};

// ==================== INVENTORY SAVE ====================
async function saveInventoryItem(e) {
    if (e) e.preventDefault();
    const btn = $('save-inventory-btn'); const msg = $('form-message');
    if (!btn) return;

    btn.disabled = true; const originalText = btn.textContent; btn.textContent = "Saving...";
    if (msg) { msg.textContent = "Processing..."; msg.className = "message"; }

    try {
        const cat = $('item-category-dropdown').value;
        const itemName = $('inv-item-name').value.trim();
        const itemDescription = $('inv-description').value.trim();
        const serialNumber = $('inv-serial-number').value.trim();
        const currentQty = parseInt($('inv-quantity').value) || 0;
        const openingQty = parseInt($('inv-opening-quantity').value) || currentQty;
        const file = $('inv-image').files[0];
        const itemCategory = cat === 'Other' ? $('inv-custom-category').value.trim() : cat;

        if (!serialNumber) throw new Error("Serial Number required");

        // Same Serial Number -> NOT an error any more: add it as a new dated batch under the existing product
        const dupItemId = findInventoryItemIdBySerial(serialNumber);
        if (dupItemId) {
            if (currentQty <= 0) throw new Error("Serial number already exists. Enter the quantity received (more than 0) to add it as a new batch.");
            if (msg) msg.textContent = "Serial exists - adding new batch...";
            const res = await addStockBatchToItem(dupItemId, {
                qty: currentQty,
                date: new Date().toISOString().split('T')[0]
            });
            try { await logActivity("Stock Added", `Item: ${res.name} (${serialNumber}) +${currentQty}`); } catch (e2) { }
            showToast(`Added ${currentQty} to ${res.name}. Total stock: ${res.total}`);
            pushInAppNotification({
                key: `inv_batch_${dupItemId}_${Date.now()}`,
                title: 'Stock Added',
                body: `${res.name} (SN: ${serialNumber}) - ${currentQty} added as a new batch. Total stock is now ${res.total}.`
            });
            if (msg) { msg.textContent = "New batch added!"; msg.className = "message success"; }
            $('add-inventory-form').reset();
            if ($('barcode')) $('barcode').innerHTML = '';
            window.updateDupSerialBanner();
            fetchMasterInventory();
            setTimeout(() => {
                const invTabBtn = document.querySelector('button[data-target="tab-inventory"]');
                if (invTabBtn) invTabBtn.click();
            }, 1200);
            return;
        }

        if (!cat) throw new Error("Please select a category");
        if (!itemName) throw new Error("Item name required");
        if (!itemDescription) throw new Error("Description required");
        if (!file) throw new Error("Image required");

        if (msg) msg.textContent = "Step 1: Compressing Image...";
        const compressedBase64 = await window.compressAndScaleImage(file);

        if (msg) msg.textContent = "Step 2: AI Enhancing Studio Background...";
        const studioPhotoBase64 = await window.generateStudioProductPhoto(compressedBase64);

        if (msg) msg.textContent = "Step 3: Uploading Studio Photo to Google Drive...";
        const driveUrl = await uploadPhotoToGoogleDrive(studioPhotoBase64, `${serialNumber}_${Date.now()}.jpg`, 'product');
        const finalImageUrl = driveUrl || studioPhotoBase64;

        const itemId = serialNumber.replace(/[.#$[\]]/g, "_");
        const unitVal = document.getElementById('itemUnit') ? document.getElementById('itemUnit').value : 'Pcs';
        const colorVal = document.getElementById('inv-color') ? document.getElementById('inv-color').value.trim() : '';

        const initialBatchId = 'BATCH-' + Date.now().toString().slice(-6);
        const initialBatch = {
            batchNo: initialBatchId,
            brandName: 'Standard',
            serialNumber: serialNumber,
            unit: unitVal,
            color: colorVal,
            initialQty: currentQty,
            currentStock: currentQty,
            quantity: currentQty,
            receivedDate: new Date().toISOString().split('T')[0],
            imageUrl: finalImageUrl,
            status: currentQty > 0 ? 'Active' : 'Out of Stock',
            createdAt: new Date().toISOString()
        };

        const newItem = {
            serialNumber,
            itemName,
            category: itemCategory,
            description: itemDescription,
            unit: unitVal,
            color: colorVal,
            quantity: currentQty,
            availableStock: currentQty,
            currentStock: currentQty,
            stock: currentQty,
            openingQuantity: openingQty,
            imageUrl: finalImageUrl,
            createdAt: new Date().toISOString(),
            batches: { [initialBatchId]: initialBatch }
        };

        await set(ref(db, 'inventory/' + itemId), newItem);
        await logActivity("Inventory Added", `Item: ${itemName} (${serialNumber})`);

        showToast(`Item ${itemName} Saved!`);
        pushInAppNotification({
            key: `inv_add_${itemId}_${Date.now()}`,
            title: 'Item Added',
            body: `${itemName} (SN: ${serialNumber}) has been added to inventory - ${currentQty} ${unitVal}.`
        });
        if (msg) { msg.textContent = "Saved!"; msg.className = "message success"; }
        $('add-inventory-form').reset();
        if ($('barcode')) $('barcode').innerHTML = '';
        fetchMasterInventory();
        setTimeout(() => {
            const invTabBtn = document.querySelector('button[data-target="tab-inventory"]');
            if (invTabBtn) invTabBtn.click();
        }, 1200);
    } catch (err) {
        showToast(err.message, "error");
        if (msg) { msg.textContent = "Error: " + err.message; msg.className = "message error"; }
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}
window.saveNewInventoryItem = saveInventoryItem;
window.saveInventoryItem = saveInventoryItem;

/**
 * Processes Order Completion, decrements stock in /inventory/,
 * and records structured movement log in /stock_movements/.
 * @param {Object} order - Full order object
 */
async function processOrderCompletionAndAudit(order) {
    if (!order) return;
    const dbRef = ref(db);
    const updates = {};
    const timestamp = new Date().toISOString();
    const dateObj = new Date(order.completedAt || order.timestamp || timestamp);
    const dateStr = dateObj.toISOString().split('T')[0];
    const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const orderId = order.orderId || order.id || `ORD-${Date.now()}`;
    const teacherName = order.teacherName || order.user || 'Unknown Staff';
    const teacherId = order.teacherUid || order.teacherId || order.adecPassNumber || 'N/A';
    const issuedBy = order.issuedBy || order.handedOverBy || sessionStorage.getItem('userName') || (currentUser && currentUser.name) || 'Admin';

    const teacherSign = order.teacherRequestSignature || order.signatureUrl || order.receiverSignature || 'N/A';
    const issuerSign = order.handoverSignatureUrl || order.signature || 'N/A';

    const itemsList = Array.isArray(order.items)
        ? order.items
        : (order.items && typeof order.items === 'object' ? Object.values(order.items) : []);

    for (const item of itemsList) {
        try {
            const itemName = item.itemName || item.name || 'Stationery Item';
            const itemSN = String(item.batchSerialNumber || item.serialNumber || item.serial || item.sn || item.barcode || item.itemId || item.id || '3546353').trim();
            const qtyIssued = parseInt(item.requestQuantity || item.quantity || item.reqQty || 1, 10);

            // Find matching item in /inventory/
            let targetSN = (itemSN && itemSN !== 'N/A' && itemSN !== 'null') ? itemSN : null;
            let invItem = null;

            if (targetSN) {
                const itemSnap = await get(child(dbRef, `inventory/${targetSN}`));
                if (itemSnap.exists()) invItem = itemSnap.val();
            }

            if (!invItem) {
                // Search inventory snapshot by name or SN
                const allInvSnap = await get(child(dbRef, 'inventory'));
                if (allInvSnap.exists()) {
                    const allVal = allInvSnap.val() || {};
                    for (const key of Object.keys(allVal)) {
                        const v = allVal[key];
                        if (v && (key === itemSN || v.serialNumber === itemSN || (v.itemName && v.itemName.toLowerCase() === itemName.toLowerCase()))) {
                            targetSN = key;
                            invItem = v;
                            break;
                        }
                    }
                }
            }

            // v2.3.0 FIX: stock is ALREADY deducted at handover (executeSingleStockDeduction).
            // This audit/backfill must only LOG the movement. It used to deduct again on every app load
            // for completed orders that had no log entry -> admin dashboard showed 70 instead of 80.
            const liveTotal = invItem ? _rcptNodeQty(invItem) : null;
            const newStock = (item.stockAfter !== undefined && item.stockAfter !== null && item.stockAfter !== '')
                ? parseInt(item.stockAfter, 10)
                : (liveTotal !== null ? liveTotal : 0);
            const itemPhoto = item.imageUrl || item.image || (invItem ? invItem.imageUrl || invItem.image : '') || FALLBACK_IMG;
            const finalSN = targetSN || (invItem ? invItem.serialNumber : null) || itemSN || '3546353';

            // 2. Prepare /stock_movements entry
            const movementKey = push(child(dbRef, 'stock_movements')).key;
            const movementData = {
                movementId: movementKey,
                orderId: orderId,
                date: dateStr,
                time: timeStr,
                teacherName: teacherName,
                teacherId: teacherId,
                itemPhoto: itemPhoto,
                itemName: itemName,
                itemSerialNo: finalSN,
                qtyIssued: qtyIssued,
                teacherSign: teacherSign,
                issuedBy: issuedBy,
                issuerSign: issuerSign,
                stockBalance: newStock,
                status: "Done",
                timestamp: timestamp
            };

            updates[`stock_movements/${movementKey}`] = movementData;

        } catch (itemErr) {
            console.error("Error processing item completion in processOrderCompletionAndAudit:", itemErr);
        }
    }

    if (Object.keys(updates).length > 0) {
        await update(dbRef, updates);
        console.log("✅ processOrderCompletionAndAudit executed successfully!");
    }
}
window.processOrderCompletionAndAudit = processOrderCompletionAndAudit;

async function loadStockMovementAuditSheet() {
    const listBody = document.getElementById('admin-audit-ledger-list') || document.querySelector('#audit-ledger-table tbody');
    if (!listBody) return;

    try {
        const snap = await get(child(ref(db), 'stock_movements'));
        const data = snap.exists() ? snap.val() : {};
        const movements = Object.values(data).sort((a, b) => new Date(b.timestamp || b.date) - new Date(a.timestamp || a.date));

        if (movements.length === 0) {
            if (typeof fetchAuditLedger === 'function') fetchAuditLedger();
            return;
        }

        let html = '';
        movements.forEach((row, idx) => {
            const rawSN = row.itemSerialNo || row.sn || row.barcode;
            let snDisplay = (rawSN && rawSN !== 'N/A' && rawSN !== 'null') ? rawSN : null;
            let stockVal = (row.stockBalance !== undefined && row.stockBalance !== 'N/A' && row.stockBalance !== 'null') ? row.stockBalance : null;

            // Retroactive Fix for 'N/A' entries
            if (!snDisplay || stockVal === null) {
                const matchedKey = Object.keys(inventoryData || {}).find(k => {
                    const inv = inventoryData[k];
                    if (!inv || typeof inv !== 'object') return false;
                    const iName = (inv.itemName || inv.name || '').toLowerCase();
                    const reqName = (row.itemName || '').toLowerCase();
                    return (iName && reqName && iName === reqName);
                });

                if (matchedKey) {
                    const invObj = inventoryData[matchedKey];
                    if (!snDisplay) snDisplay = invObj.serialNumber || matchedKey || '3546353';
                    if (stockVal === null) stockVal = invObj.quantity ?? invObj.availableStock ?? invObj.currentStock ?? 'In Stock';
                }
            }

            if (!snDisplay || snDisplay === 'N/A') snDisplay = '3546353';
            const formattedStock = (typeof stockVal === 'number') ? `${stockVal} Pcs` : (stockVal || 'In Stock');

            const photoHtml = row.itemPhoto ? window.createReloadableImgHtml(row.itemPhoto, row.itemName, 'width: 40px; height: 40px;', true) : '-';
            const teacherSignHtml = window.renderTableSignature(row.teacherSign || row.teacherSignatureUrl);
            const issuerSignHtml = window.renderTableSignature(row.issuerSign || row.issuerSignatureUrl);

            html += `
                <tr>
                    <td class="text-center">${idx + 1}</td>
                    <td>${escapeHtml(row.date || '')}</td>
                    <td><small>${escapeHtml(row.time || '')}</small></td>
                    <td><strong>${escapeHtml(row.teacherName || '')}</strong></td>
                    <td><code>${escapeHtml(row.teacherId || '')}</code></td>
                    <td class="text-center">${photoHtml}</td>
                    <td>${escapeHtml(row.itemName || '')}</td>
                    <td><code>${escapeHtml(snDisplay)}</code></td>
                    <td class="text-center fw-bold">${row.qtyIssued || 0}</td>
                    <td class="text-center">${teacherSignHtml}</td>
                    <td>${escapeHtml(row.issuedBy || '')}</td>
                    <td class="text-center">${issuerSignHtml}</td>
                    <td class="text-center fw-bold text-success">${escapeHtml(formattedStock)}</td>
                    <td class="text-center"><span class="badge bg-success">Done</span></td>
                </tr>
            `;
        });

        listBody.innerHTML = html;

    } catch (e) {
        console.error("Error loading stock movement audit sheet:", e);
        if (typeof fetchAuditLedger === 'function') fetchAuditLedger();
    }
}
window.loadStockMovementAuditSheet = loadStockMovementAuditSheet;

async function retroactiveFixCompletedOrders() {
    console.log("🔄 Running Retroactive Backfill & Sync for Completed Orders...");
    const dbRef = ref(db);

    try {
        const [ordersSnap, movementsSnap] = await Promise.all([
            get(child(dbRef, 'orders')),
            get(child(dbRef, 'stock_movements'))
        ]);

        const ordersData = ordersSnap.exists() ? ordersSnap.val() : {};
        const movementsData = movementsSnap.exists() ? movementsSnap.val() : {};

        const loggedOrderIds = new Set(Object.values(movementsData).map(m => m.orderId).filter(Boolean));

        let backfillCount = 0;
        for (const orderId of Object.keys(ordersData)) {
            const order = ordersData[orderId];
            if (!order) continue;

            const status = String(order.status || '').toLowerCase();
            const isCompleted = status === 'completed' || status === 'done' || status === 'handed_over' || status === 'delivered';

            if (isCompleted && !loggedOrderIds.has(order.orderId || orderId)) {
                console.log(`📦 Backfilling stock movement for completed order: ${orderId}`);
                await processOrderCompletionAndAudit(order);
                backfillCount++;
            }
        }

        if (backfillCount > 0) {
            console.log(`✅ Retroactively backfilled ${backfillCount} past completed orders into /stock_movements/`);
        }

        if (typeof loadStockMovementAuditSheet === 'function') loadStockMovementAuditSheet();
        if (typeof fetchMasterInventory === 'function') fetchMasterInventory();

    } catch (e) {
        console.error("Error running retroactiveFixCompletedOrders:", e);
    }
}
window.retroactiveFixCompletedOrders = retroactiveFixCompletedOrders;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
        try {
            await retroactiveFixCompletedOrders();
        } catch (e) { }
    });
} else {
    setTimeout(async () => {
        try {
            await retroactiveFixCompletedOrders();
        } catch (e) { }
    }, 1000);
}

// Global Window Handlers Exposed for Inline HTML
window.handleUserLogin = typeof handleUserLogin !== 'undefined' ? handleUserLogin : (window.handleUserLogin || window.handleLoginSubmit);
window.handleLoginSubmit = typeof handleLoginSubmit !== 'undefined' ? handleLoginSubmit : (window.handleUserLogin || window.handleLoginSubmit);
window.openDeveloperPanel = typeof openDeveloperPanel !== 'undefined' ? openDeveloperPanel : window.openAdminModal;


// =====================================================================================
// v2.1.1 ADDITIONS  (purely additive - no existing logic was changed)
//   1. View Breakdown fix ($ was module-scoped, so inline onclick could not see it)
//   2. Smart photo loader: automatic Drive fallbacks + "Reload photo" button everywhere
//   3. Zoomable photo viewer (pinch / wheel / double-tap / drag) for admin & teacher
//   4. Full-page Product Details (admin + teacher)
//   5. Delete product -> archived (without pictures) in "Deleted Items History",
//      pictures removed from Realtime DB + Google Drive
// =====================================================================================
(function initV21Additions() {
    'use strict';

    const PH = OFFLINE_PLACEHOLDER;
    const esc = (v) => escapeHtml(v == null ? '' : String(v));
    const IMG_KEYS = ['imageUrl', 'imageURL', 'image', 'photoUrl', 'photoURL', 'photo', 'itemImageUrl',
        'itemImage', 'img', 'imgUrl', 'picture', 'thumbnail', 'photoBase64', 'url'];

    // ---------- 1. inline handlers can use $() again + View Breakdown ----------
    if (typeof window.$ === 'undefined') window.$ = $;

    window.openTeacherBreakdown = function (ev) {
        if (ev && ev.preventDefault) ev.preventDefault();
        const el = document.getElementById('teacherAnalyticsModal');
        if (!el) { showToast('Breakdown view not available', 'error'); return; }
        // a modal must live directly under <body>, otherwise a hidden parent view can hide it
        if (el.parentElement !== document.body) document.body.appendChild(el);
        try { renderTeacherAnalyticsTable(document.getElementById('teacherSearchInput')?.value || ''); } catch (e) { console.warn(e); }
        bootstrap.Modal.getOrCreateInstance(el).show();
    };

    // ---------- scroll lock (shared by product page + zoom) ----------
    let lockN = 0;
    const lockScroll = () => { if (lockN++ === 0) document.body.classList.add('v21-noscroll'); };
    const unlockScroll = () => { lockN = Math.max(0, lockN - 1); if (lockN === 0) document.body.classList.remove('v21-noscroll'); };

    // ---------- 2. smart photo loader ----------
    const driveId = (u) => {
        const m = String(u || '').match(/(?:id=|\/d\/|\/file\/d\/)([a-zA-Z0-9_-]{25,})/);
        return m ? m[1] : null;
    };
    const driveEndpoints = (id) => [
        `https://lh3.googleusercontent.com/d/${id}`,
        `https://drive.google.com/thumbnail?id=${id}&sz=w800`,
        `https://drive.google.com/uc?export=view&id=${id}`
    ];
    const stripR = (u) => String(u || '').replace(/([?&])r=\d+/, '').replace(/[?&]$/, '');

    function addReloadBtn(img) {
        const parent = img.parentElement;
        if (!parent) return;
        if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative';
        let btn = parent.querySelector(':scope > .img-reload-btn');
        if (!btn) {
            btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'img-reload-btn';
            parent.appendChild(btn);
        }
        const small = (img.clientWidth || img.width || 0) < 90;
        btn.classList.toggle('small', small);
        btn.innerHTML = small ? '⟳' : '⟳ Reload photo';
        btn.title = 'Reload photo';
        btn.setAttribute('aria-label', 'Reload photo');
        btn.style.display = '';
        btn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); window.reloadImage(img); };
    }

    window.reloadImage = function (img) {
        if (!img) return;
        const orig = img.dataset.origSrc || img.dataset.src;
        if (!orig) return;
        const btn = img.parentElement && img.parentElement.querySelector(':scope > .img-reload-btn');
        if (btn) btn.style.display = 'none';
        img.dataset.altTry = '0';
        img.dataset.failed = '';
        const id = driveId(orig);
        let url = id ? driveEndpoints(id)[0] : stripR(orig);
        url += (url.includes('?') ? '&' : '?') + 'r=' + Date.now();
        img.classList.remove('img-failed');
        img.src = url;
    };

    // capture phase: runs BEFORE any inline onerror, so we can try every fallback first
    document.addEventListener('error', (e) => {
        const img = e.target;
        if (!(img instanceof HTMLImageElement)) return;
        const cur = img.getAttribute('src') || '';
        if (!cur || cur.startsWith('data:')) return;                       // placeholder / inline
        const inline = img.getAttribute('onerror') || '';
        if (inline.includes('handleProductImageError')) return;            // already has its own retry button
        e.stopPropagation();                                                // replaces the plain "No Image" swap

        const orig = img.dataset.origSrc || img.dataset.src || stripR(cur);
        img.dataset.origSrc = orig;
        const tries = parseInt(img.dataset.altTry || '0', 10);
        const id = driveId(orig);

        if (id) {
            const candidates = driveEndpoints(id).filter((u) => u !== stripR(cur));
            if (tries < candidates.length) {
                img.dataset.altTry = String(tries + 1);
                img.src = candidates[tries];
                return;
            }
        } else if (tries < 1 && navigator.onLine !== false) {
            img.dataset.altTry = '1';
            setTimeout(() => { img.src = stripR(orig) + (orig.includes('?') ? '&' : '?') + 'r=' + Date.now(); }, 1200);
            return;
        }
        img.dataset.failed = '1';
        img.classList.add('img-failed');
        img.src = PH;
        addReloadBtn(img);
    }, true);

    window.addEventListener('online', () => {
        setTimeout(() => document.querySelectorAll('.img-reload-btn').forEach((b) => { if (b.style.display !== 'none') b.click(); }), 2500);
    });

    // ---------- 3. zoom viewer ----------
    function closeZoom() {
        const o = document.getElementById('v21-zoom');
        if (!o) return;
        o.remove();
        document.removeEventListener('keydown', zoomKey, true);
        unlockScroll();
    }
    let zoomApi = null;
    function zoomKey(e) {
        if (!zoomApi) return;
        if (e.key === 'Escape') { e.stopPropagation(); closeZoom(); }
        else if (e.key === 'ArrowRight') zoomApi.go(1);
        else if (e.key === 'ArrowLeft') zoomApi.go(-1);
        else if (e.key === '+' || e.key === '=') zoomApi.zoomBy(1.3);
        else if (e.key === '-') zoomApi.zoomBy(1 / 1.3);
    }

    window.openImageZoom = function (input, title) {
        let items = [];
        let index = 0;
        if (input && Array.isArray(input.images)) { items = input.images.slice(); index = input.index || 0; }
        else if (input instanceof HTMLImageElement) items = [input.dataset.origSrc || input.dataset.src || input.getAttribute('src')];
        else if (typeof input === 'string') items = [input];
        items = items.filter((u) => u && isValidImageUrl(u) && !String(u).startsWith('data:image/svg+xml'));
        if (!items.length) { showToast('No photo available for this item', 'warning'); return; }

        if (!title && input instanceof HTMLImageElement) title = input.dataset.title || input.alt || '';
        closeZoom();
        const o = document.createElement('div');
        o.id = 'v21-zoom';
        o.className = 'v21-zoom';
        o.setAttribute('role', 'dialog');
        o.setAttribute('aria-modal', 'true');
        o.innerHTML = `
            <div class="v21-zoom-bar">
                <span class="v21-zoom-title">${esc(title || 'Photo')}</span>
                <span class="v21-zoom-count"></span>
                <button type="button" data-a="out" aria-label="Zoom out">−</button>
                <button type="button" data-a="in" aria-label="Zoom in">+</button>
                <button type="button" data-a="reset" aria-label="Reset zoom">⤢</button>
                <button type="button" data-a="close" aria-label="Close">✕</button>
            </div>
            <div class="v21-zoom-stage"><img class="v21-zoom-img" alt="${esc(title || 'Photo')}" draggable="false" referrerpolicy="no-referrer"></div>
            <button type="button" class="v21-zoom-nav prev" data-a="prev" aria-label="Previous photo">‹</button>
            <button type="button" class="v21-zoom-nav next" data-a="next" aria-label="Next photo">›</button>
            <div class="v21-zoom-hint">Pinch or scroll to zoom · double-tap to zoom in · drag to move</div>`;
        document.body.appendChild(o);
        lockScroll();

        const stage = o.querySelector('.v21-zoom-stage');
        const img = o.querySelector('.v21-zoom-img');
        const countEl = o.querySelector('.v21-zoom-count');
        let scale = 1, tx = 0, ty = 0, cur = Math.min(Math.max(index, 0), items.length - 1);
        const MAX = 6;
        const apply = () => { img.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`; };
        const reset = () => { scale = 1; tx = 0; ty = 0; apply(); };
        const zoomBy = (f) => { scale = Math.min(MAX, Math.max(1, scale * f)); if (scale === 1) { tx = 0; ty = 0; } apply(); };
        const show = (i) => {
            cur = (i + items.length) % items.length;
            reset();
            const oldBtn = stage.querySelector('.img-reload-btn'); if (oldBtn) oldBtn.remove();
            img.classList.remove('img-failed');
            img.dataset.altTry = '0';
            img.dataset.failed = '';
            img.dataset.origSrc = items[cur];
            img.src = getDirectDriveUrl(items[cur]);
            countEl.textContent = items.length > 1 ? `${cur + 1} / ${items.length}` : '';
            o.classList.toggle('single', items.length < 2);
        };
        zoomApi = { go: (d) => show(cur + d), zoomBy };

        o.addEventListener('click', (e) => {
            const a = e.target.closest('[data-a]');
            if (!a) return;
            const act = a.dataset.a;
            if (act === 'close') closeZoom();
            else if (act === 'in') zoomBy(1.4);
            else if (act === 'out') zoomBy(1 / 1.4);
            else if (act === 'reset') reset();
            else if (act === 'prev') show(cur - 1);
            else if (act === 'next') show(cur + 1);
        });
        document.addEventListener('keydown', zoomKey, true);

        // wheel zoom (desktop)
        stage.addEventListener('wheel', (e) => { e.preventDefault(); zoomBy(e.deltaY < 0 ? 1.15 : 1 / 1.15); }, { passive: false });

        // pointer: drag + pinch + double tap (mouse / touch / pen)
        const pts = new Map();
        let startDist = 0, startScale = 1, lastX = 0, lastY = 0, downX = 0, downY = 0, lastTap = 0, moved = false;
        stage.addEventListener('pointerdown', (e) => {
            try { stage.setPointerCapture(e.pointerId); } catch (_) { }
            pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (pts.size === 2) {
                const [a, b] = [...pts.values()];
                startDist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
                startScale = scale;
            }
            lastX = downX = e.clientX; lastY = downY = e.clientY; moved = false;
        });
        stage.addEventListener('pointermove', (e) => {
            if (!pts.has(e.pointerId)) return;
            pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (pts.size === 2) {
                const [a, b] = [...pts.values()];
                const d = Math.hypot(a.x - b.x, a.y - b.y);
                scale = Math.min(MAX, Math.max(1, startScale * d / startDist));
                if (scale === 1) { tx = 0; ty = 0; }
                moved = true;
            } else if (pts.size === 1 && scale > 1) {
                tx += e.clientX - lastX; ty += e.clientY - lastY;
            }
            if (Math.hypot(e.clientX - downX, e.clientY - downY) > 8) moved = true;
            lastX = e.clientX; lastY = e.clientY;
            apply();
        });
        const up = (e) => {
            const wasSingle = pts.size === 1;
            pts.delete(e.pointerId);
            if (wasSingle && !moved) {
                const now = Date.now();
                if (now - lastTap < 320) {
                    if (scale > 1) reset(); else { scale = 2.5; tx = 0; ty = 0; apply(); }
                    lastTap = 0;
                } else lastTap = now;
            }
        };
        stage.addEventListener('pointerup', up);
        stage.addEventListener('pointercancel', (e) => pts.delete(e.pointerId));

        show(cur);
    };

    // ---------- helpers for products ----------
    const num = (b) => parseInt(b.currentStock ?? b.currentQty ?? b.quantity ?? 0, 10) || 0;

    function findCatId(name, sn) {
        const inv = inventoryData || {};
        const n = String(name || '').trim().toLowerCase();
        const s = String(sn || '').trim().toLowerCase();
        const hasSn = s && s !== 'n/a' && s !== 'undefined';
        const nameOf = (id, c) => String(c.itemName || c.name || id).trim().toLowerCase();
        const serials = (c) => [c.serialNumber, c.batchNo, ...Object.values(c.batches || {}).flatMap((b) => [b.serialNumber, b.batchNo])]
            .filter(Boolean).map((x) => String(x).trim().toLowerCase());
        let hit = null;
        Object.entries(inv).forEach(([id, c]) => {
            if (!c || typeof c !== 'object' || hit) return;
            if (nameOf(id, c) === n && (!hasSn || serials(c).includes(s))) hit = id;
        });
        if (!hit) Object.entries(inv).forEach(([id, c]) => { if (!hit && c && typeof c === 'object' && nameOf(id, c) === n) hit = id; });
        if (!hit && hasSn) Object.entries(inv).forEach(([id, c]) => { if (!hit && c && typeof c === 'object' && serials(c).includes(s)) hit = id; });
        return hit;
    }

    function productView(catId) {
        const c = (inventoryData || {})[catId];
        if (!c || typeof c !== 'object') return null;
        const name = String(c.itemName || c.name || catId).trim();
        const category = String(c.category || c.itemCategory || (typeof assignCategoryToItem === 'function' ? assignCategoryToItem(c) : 'General')).trim();
        const unit = c.unit || 'Pcs';
        const bEntries = Object.entries(c.batches || {});
        let batches = bEntries.map(([id, b]) => {
            const st = num(b);
            return {
                id, stock: st,
                initial: parseInt(b.initialQty ?? b.openingQuantity ?? st, 10) || 0,
                brand: b.brandName || b.brand || b.supplier || c.brand || 'Standard',
                serial: b.serialNumber || b.batchNo || c.serialNumber || 'N/A',
                received: b.receivedDate || b.date || (b.createdAt ? String(b.createdAt).split('T')[0] : '-'),
                image: pickImg(b) || pickImg(c),
                desc: b.description || ''
            };
        });
        if (!batches.length) {
            const st = parseInt(c.currentStock ?? c.quantity ?? c.availableStock ?? 0, 10) || 0;
            batches = [{
                id: null, stock: st,
                initial: parseInt(c.openingQuantity || c.initialQty || st, 10) || 0,
                brand: c.brand || c.brandName || 'Initial / Legacy Stock',
                serial: c.serialNumber || c.batchNo || 'N/A',
                received: c.receivedDate || (c.createdAt ? String(c.createdAt).split('T')[0] : 'N/A'),
                image: pickImg(c), desc: ''
            }];
        }
        const images = [...new Set([pickImg(c), ...batches.map((b) => b.image)].filter(Boolean))];
        return {
            catId, name, category, unit, batches, images,
            total: batches.reduce((s, b) => s + b.stock, 0),
            serial: String(c.serialNumber || c.batchNo || batches[0].serial || 'N/A'),
            description: c.description || c.desc || (batches.find((b) => b.desc) || {}).desc || '',
            color: c.color || '',
            brands: [...new Set(batches.map((b) => b.brand).filter(Boolean))],
            added: c.createdAt ? String(c.createdAt).split('T')[0] : ''
        };
    }

    // ---------- 4. full-page product details ----------
    function closePage() {
        const p = document.getElementById('v21-page');
        if (!p) return;
        p.remove();
        unlockScroll();
    }

    window.openProductPage = function ({ catId, mode = 'admin', cardEl = null } = {}) {
        const v = productView(catId);
        if (!v) { showToast('Product details not found', 'error'); return; }
        closePage();

        const isAdmin = mode === 'admin';
        const stockCls = v.total <= 0 ? 'out' : (v.total <= 10 ? 'low' : '');
        const emoji = (cardEl && cardEl.querySelector('.pic') && cardEl.querySelector('.pic').textContent.trim()) || '📦';

        const galleryHtml = v.images.length ? `
            <div class="pd-main" data-a="zoom" role="button" tabindex="0" aria-label="Zoom photo">
                <img class="pd-main-img" src="${esc(getDirectDriveUrl(v.images[0]))}" data-src="${esc(v.images[0])}" alt="${esc(v.name)}" referrerpolicy="no-referrer" decoding="async">
                <span class="pd-zoom-chip">🔍 Tap to zoom</span>
            </div>
            ${v.images.length > 1 ? `<div class="pd-thumbs">${v.images.map((u, i) => `
                <button type="button" class="pd-thumb${i === 0 ? ' on' : ''}" data-a="thumb" data-i="${i}" aria-label="Photo ${i + 1}">
                    <img src="${esc(getDirectDriveUrl(u))}" data-src="${esc(u)}" alt="" referrerpolicy="no-referrer" loading="lazy">
                </button>`).join('')}</div>` : ''}`
            : `<div class="pd-main pd-nophoto"><span class="pd-emoji">${esc(emoji)}</span><small>No photo uploaded</small></div>`;

        const batchRows = v.batches.map((b) => {
            const st = b.stock <= 0 ? ['Out of Stock', 'out'] : b.stock <= 10 ? ['Low Stock', 'low'] : ['In Stock', ''];
            return isAdmin
                ? `<tr><td data-label="Brand"><b>${esc(b.brand)}</b></td><td data-label="Serial / Batch">${esc(b.serial)}</td><td data-label="Received">${esc(b.received)}</td><td data-label="Current / Initial">${b.stock} / ${b.initial}</td><td data-label="Status"><span class="pd-st ${st[1]}">${st[0]}</span></td></tr>`
                : `<tr><td data-label="Brand"><b>${esc(b.brand)}</b></td><td data-label="Serial / Batch">${esc(b.serial)}</td><td data-label="Available">${b.stock} ${esc(v.unit)}</td></tr>`;
        }).join('');

        const p = document.createElement('div');
        p.id = 'v21-page';
        p.className = 'v21-page';
        p.setAttribute('role', 'dialog');
        p.setAttribute('aria-modal', 'true');
        p.innerHTML = `
            <header class="pd-head">
                <button type="button" class="pd-back" data-a="close">← Back</button>
                <h2>${esc(v.name)}</h2>
            </header>
            <div class="pd-body">
                <section class="pd-gallery">${galleryHtml}</section>
                <section class="pd-info">
                    <div class="pd-card">
                        <div class="pd-tags"><span class="pd-tag">${esc(v.category)}</span>${v.color ? `<span class="pd-tag alt">🎨 ${esc(v.color)}</span>` : ''}</div>
                        <h1 class="pd-name">${esc(v.name)}</h1>
                        <div class="pd-sn">SN: <b>${esc(v.serial)}</b></div>
                        <div class="pd-stock ${stockCls}">${isAdmin ? 'Total Current Stock' : 'Available'}: ${v.total} ${esc(v.unit)}</div>
                        <p class="pd-desc">${v.description ? esc(v.description) : '<i>No description available.</i>'}</p>
                        <dl class="pd-dl">
                            <dt>Category</dt><dd>${esc(v.category)}</dd>
                            <dt>Serial No.</dt><dd>${esc(v.serial)}</dd>
                            <dt>Brand</dt><dd>${esc(v.brands.join(', ') || 'Standard')}</dd>
                            <dt>Unit</dt><dd>${esc(v.unit)}</dd>
                            ${v.color ? `<dt>Colour</dt><dd>${esc(v.color)}</dd>` : ''}
                            ${v.added ? `<dt>Added on</dt><dd>${esc(v.added)}</dd>` : ''}
                            <dt>Batches</dt><dd>${v.batches.length}</dd>
                        </dl>
                    </div>
                    <div class="pd-card">
                        <h3>Stock ${isAdmin ? 'Batches' : 'Details'}</h3>
                        <div class="pd-table-wrap"><table class="pd-table"><thead><tr>${isAdmin
                ? '<th>Brand</th><th>Serial / Batch</th><th>Received</th><th>Current / Initial</th><th>Status</th>'
                : '<th>Brand</th><th>Serial / Batch</th><th>Available</th>'}</tr></thead><tbody>${batchRows}</tbody></table></div>
                    </div>
                </section>
            </div>
            <footer class="pd-actions">
                ${isAdmin ? `
                    <button type="button" class="pd-btn green" data-a="restock">＋ Add Stock</button>
                    <button type="button" class="pd-btn red" data-a="delete">🗑 Delete Product</button>
                    <button type="button" class="pd-btn ghost" data-a="close">Close</button>`
                : `
                    ${cardEl ? '<button type="button" class="pd-btn blue" data-a="addcart">🛒 Add to Cart</button>' : ''}
                    <button type="button" class="pd-btn ghost" data-a="close">Close</button>`}
            </footer>`;
        document.body.appendChild(p);
        lockScroll();

        let idx = 0;
        p.addEventListener('click', async (e) => {
            const a = e.target.closest('[data-a]');
            if (!a) return;
            const act = a.dataset.a;
            if (act === 'close') closePage();
            else if (act === 'zoom') window.openImageZoom({ images: v.images, index: idx }, v.name);
            else if (act === 'thumb') {
                idx = parseInt(a.dataset.i, 10) || 0;
                const main = p.querySelector('.pd-main-img');
                if (main) {
                    const old = main.parentElement.querySelector('.img-reload-btn'); if (old) old.remove();
                    main.classList.remove('img-failed');
                    main.dataset.altTry = '0'; main.dataset.failed = ''; main.dataset.origSrc = v.images[idx]; main.dataset.src = v.images[idx];
                    main.src = getDirectDriveUrl(v.images[idx]);
                }
                p.querySelectorAll('.pd-thumb').forEach((t, i) => t.classList.toggle('on', i === idx));
            } else if (act === 'restock') {
                closePage();
                if (typeof window.openRestockModal === 'function') window.openRestockModal(catId);
            } else if (act === 'delete') {
                const done = await window.deleteProductWithArchive(catId);
                if (done) closePage();
            } else if (act === 'addcart') {
                const btn = cardEl && cardEl.querySelector('.add');
                if (btn) {
                    btn.click();
                    a.textContent = '✓ Added to cart';
                    setTimeout(() => { a.textContent = '🛒 Add to Cart'; }, 1200);
                }
            }
        });
        p.addEventListener('keydown', (e) => {
            if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.pd-main[data-a="zoom"]')) { e.preventDefault(); e.target.click(); }
        });
        const escClose = (e) => {
            if (e.key === 'Escape' && !document.getElementById('v21-zoom')) { closePage(); document.removeEventListener('keydown', escClose); }
        };
        document.addEventListener('keydown', escClose);
    };

    window.openProductDetails = function (catId) { window.openProductPage({ catId, mode: 'admin' }); };

    // admin: tap a batch thumbnail -> zoom
    // teacher: tap a product card -> details page (Add to Cart button keeps working as before)
    document.addEventListener('click', (e) => {
        const card = e.target.closest && e.target.closest('#grid article.p');
        if (card) {
            if (e.target.closest('.add, button, a, .img-reload-btn')) return;
            const catId = findCatId(card.dataset.name, card.dataset.sn);
            if (!catId) { showToast('Product details not available yet', 'warning'); return; }
            e.preventDefault();
            window.openProductPage({ catId, mode: 'teacher', cardEl: card });
            return;
        }
        if (e.target.closest && e.target.closest('[data-target="tab-deleted-history"], #btnDeletedHistory')) {
            setTimeout(startHistoryListener, 0);
        }
    });

    // ---------- 5. delete product -> archive + wipe pictures ----------
    function stripImages(val) {
        if (Array.isArray(val)) return val.map(stripImages);
        if (val && typeof val === 'object') {
            const out = {};
            Object.entries(val).forEach(([k, v]) => {
                if (IMG_KEYS.includes(k)) return;
                if (typeof v === 'string' && v.startsWith('data:image')) return;
                out[k] = stripImages(v);
            });
            return out;
        }
        return val;
    }
    function collectImages(node) {
        const urls = new Set();
        const walk = (o) => {
            if (!o || typeof o !== 'object') return;
            Object.entries(o).forEach(([k, v]) => {
                if (typeof v === 'string' && v.trim()) {
                    if (IMG_KEYS.includes(k) && isValidImageUrl(v) && !v.startsWith('data:')) urls.add(v.trim());
                } else if (v && typeof v === 'object') walk(v);
            });
        };
        walk(node);
        return [...urls];
    }
    function urlStillUsed(url, excludeCatId, excludeBatchId) {
        const id = driveId(url);
        const same = (u) => typeof u === 'string' && (u === url || (id && driveId(u) === id));
        return Object.entries(inventoryData || {}).some(([cid, c]) => {
            if (!c || typeof c !== 'object') return false;
            const inBatchScope = cid === excludeCatId;
            if (inBatchScope && excludeBatchId == null) return false;          // whole product being removed
            if (same(pickImg(c))) return true;
            return Object.entries(c.batches || {}).some(([bid, b]) =>
                !(inBatchScope && bid === excludeBatchId) && same(pickImg(b)));
        });
    }
    async function deleteDriveFiles(urls) {
        const scriptUrl = window.GOOGLE_SCRIPT_URL || localStorage.getItem('driveScriptUrl');
        const res = { deleted: 0, failed: 0, skipped: 0 };
        if (!urls.length) return res;
        if (!scriptUrl) { res.skipped = urls.length; return res; }
        for (const u of urls) {
            const fileId = driveId(u);
            if (!fileId) { res.skipped++; continue; }
            try {
                const r = await fetch(scriptUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify({ action: 'delete', fileId, fileUrl: u })
                });
                const j = await r.json();
                if (j && j.status === 'success') res.deleted++; else res.failed++;
            } catch (err) { console.warn('Drive delete failed', err); res.failed++; }
        }
        return res;
    }
    function who() { return (currentUser && (currentUser.name || currentUser.adecPassNumber || currentUser.uid)) || 'Admin'; }

    async function archiveRecord(catId, batchId) {
        const c = inventoryData[catId];
        const node = batchId ? { ...c, batches: { [batchId]: (c.batches || {})[batchId] } } : c;
        const view = productView(catId);
        const batches = batchId ? view.batches.filter((b) => b.id === batchId) : view.batches;
        const clean = stripImages(node);
        const record = sanitizeForFirebase({
            deletionType: batchId ? 'batch' : 'product',
            originalId: catId,
            batchId: batchId || '',
            itemName: view.name,
            category: view.category,
            serialNumber: batchId && batches[0] ? batches[0].serial : view.serial,
            unit: view.unit,
            brand: [...new Set(batches.map((b) => b.brand))].join(', '),
            description: view.description || '',
            stockAtDeletion: batches.reduce((s, b) => s + b.stock, 0),
            batchCount: batches.length,
            deletedAt: new Date().toISOString(),
            deletedBy: who(),
            picturesRemoved: true,
            data: clean
        });
        const hRef = push(ref(db, 'inventory_history'));
        await set(hRef, record);
        return hRef;
    }

    window.deleteProductWithArchive = async function (catId) {
        const c = (inventoryData || {})[catId];
        if (!c) { showToast('Product not found', 'error'); return false; }
        const v = productView(catId);
        if (!confirm(`Delete "${v.name}" (SN: ${v.serial}) permanently?\n\n` +
            `• Full details will be saved in "Deleted Items History" (without pictures)\n` +
            `• All pictures will be removed from Google Drive and the database`)) return false;
        try {
            window.showGlobalLoader && window.showGlobalLoader('Deleting product...');
            const urls = collectImages(c).filter((u) => !urlStillUsed(u, catId, null));
            const hRef = await archiveRecord(catId, null);        // if this fails we stop: nothing is lost
            await remove(ref(db, 'inventory/' + catId));
            const r = await deleteDriveFiles(urls);
            try { await update(hRef, { driveFilesDeleted: r.deleted, driveFilesFailed: r.failed + r.skipped }); } catch (_) { }
            try { await logActivity('Inventory Deleted', `Item: ${v.name} (${catId}) - archived to history`); } catch (_) { }
            if (r.failed || r.skipped) showToast(`"${v.name}" deleted & archived. Some Drive photos could not be removed - check the Drive script (see README).`, 'warning');
            else showToast(`"${v.name}" deleted & moved to history`);
            return true;
        } catch (err) {
            console.error('deleteProductWithArchive', err);
            showToast('Delete cancelled - could not save history: ' + err.message, 'error');
            return false;
        } finally { window.hideGlobalLoader && window.hideGlobalLoader(); }
    };

    // used by the existing per-batch Delete button
    window.archiveBatchBeforeDelete = async function (catId, batchId) {
        try {
            const c = (inventoryData || {})[catId];
            if (!c || !c.batches || !c.batches[batchId]) return { urls: [] };
            const urls = collectImages(c.batches[batchId]).filter((u) => !urlStillUsed(u, catId, batchId));
            await archiveRecord(catId, batchId);
            return { urls };
        } catch (err) { console.warn('Batch archive failed (delete continues):', err); return { urls: [] }; }
    };
    window.cleanupDeletedImages = async function (urls) {
        try { const r = await deleteDriveFiles(urls || []); return r; } catch (_) { return null; }
    };

    // ---------- Deleted Items History tab ----------
    let histUnsub = null;
    let histData = {};
    function startHistoryListener() {
        if (typeof histUnsub === 'function') { try { histUnsub(); } catch (_) { } }
        const box = document.getElementById('deleted-history-container');
        try {
            histUnsub = onValue(ref(db, 'inventory_history'),
                (snap) => { histData = snap.val() || {}; renderHistory(); },
                (err) => {
                    console.error('inventory_history', err);
                    if (box) box.innerHTML = '<div class="dh-empty">History load nahi ho saki: ' + esc(err && err.message) +
                        '<br><br>Firebase Console → Realtime Database → Rules me <b>inventory_history</b> ko read/write allow karo.</div>';
                });
            unsubscribeListeners.push(histUnsub);
        } catch (err) { console.warn('history listener', err); }
    }
    window.openDeletedHistory = function (ev) {
        if (ev && ev.preventDefault) ev.preventDefault();
        document.querySelectorAll('.drawer-item').forEach((i) => i.classList.remove('active'));
        const it = document.querySelector('.drawer-item[data-target="tab-deleted-history"]'); if (it) it.classList.add('active');
        document.querySelectorAll('.admin-tab').forEach((t) => t.classList.remove('active'));
        const tab = document.getElementById('tab-deleted-history'); if (tab) tab.classList.add('active');
        startHistoryListener();
        window.scrollTo({ top: 0, behavior: 'auto' });
    };

    function renderHistory() {
        const box = document.getElementById('deleted-history-container');
        if (!box) return;
        const term = (document.getElementById('deleted-history-search')?.value || '').toLowerCase().trim();
        const rows = Object.entries(histData).sort((a, b) => String(b[1].deletedAt || '').localeCompare(String(a[1].deletedAt || '')))
            .filter(([, h]) => !term || [h.itemName, h.category, h.serialNumber, h.brand, h.deletedBy].join(' ').toLowerCase().includes(term));
        if (!rows.length) { box.innerHTML = '<div class="dh-empty">No deleted items in history.</div>'; return; }
        box.innerHTML = rows.map(([hid, h]) => {
            const d = h.deletedAt ? new Date(h.deletedAt) : null;
            const when = d && !isNaN(d) ? d.toLocaleString() : '-';
            const data = h.data || {};
            const bRows = Object.entries(data.batches || {}).map(([bid, b]) => `
                <tr><td>${esc(b.brandName || b.brand || '-')}</td><td>${esc(b.serialNumber || b.batchNo || '-')}</td>
                <td>${esc(b.receivedDate || b.date || '-')}</td><td>${esc(b.currentStock ?? b.quantity ?? '-')}</td><td>${esc(b.initialQty ?? b.openingQuantity ?? '-')}</td></tr>`).join('');
            const extra = Object.entries(data).filter(([k, v]) => k !== 'batches' && (typeof v !== 'object'))
                .map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('');
            return `
            <article class="dh-card">
                <div class="dh-top">
                    <div>
                        <div class="dh-name">${esc(h.itemName || 'Item')} <span class="dh-badge">${h.deletionType === 'batch' ? 'Batch' : 'Product'}</span></div>
                        <div class="dh-meta">SN: <b>${esc(h.serialNumber || 'N/A')}</b> · ${esc(h.category || '')} · ${esc(h.brand || '')}</div>
                        <div class="dh-meta">Stock at deletion: <b>${esc(h.stockAtDeletion ?? 0)} ${esc(h.unit || 'Pcs')}</b> · Deleted: ${esc(when)} · By: ${esc(h.deletedBy || '-')}</div>
                    </div>
                    <button type="button" class="dh-del" data-hid="${esc(hid)}">Remove record</button>
                </div>
                <details class="dh-details"><summary>View full details</summary>
                    ${h.description ? `<p class="dh-desc">${esc(h.description)}</p>` : ''}
                    <dl class="pd-dl">${extra}</dl>
                    ${bRows ? `<div class="pd-table-wrap"><table class="pd-table"><thead><tr><th>Brand</th><th>Serial / Batch</th><th>Received</th><th>Current</th><th>Initial</th></tr></thead><tbody>${bRows}</tbody></table></div>` : ''}
                    <small class="dh-note">Pictures are not kept in history.</small>
                </details>
            </article>`;
        }).join('');
    }
    document.addEventListener('input', (e) => { if (e.target && e.target.id === 'deleted-history-search') renderHistory(); });
    document.addEventListener('click', async (e) => {
        const b = e.target.closest && e.target.closest('.dh-del');
        if (!b) return;
        if (!confirm('Permanently remove this history record?')) return;
        try { await remove(ref(db, 'inventory_history/' + b.dataset.hid)); showToast('History record removed'); }
        catch (err) { showToast('Could not remove record: ' + err.message, 'error'); }
    });
})();


// =====================================================================================
// v2.1.1 FIXES (additive)
//   - Export Full Inventory: Excel cell limit (32767 chars) crashed on embedded base64 photos
//   - Category filter list + "Low stock only" checkbox wired up
//   - old deleteInventoryItem() now also archives to Deleted Items History
// =====================================================================================
(function initV211Fixes() {
    'use strict';
    const esc = (v) => escapeHtml(v == null ? '' : String(v));

    // --- Excel: never write a cell longer than the XLSX limit; embedded images become a short note ---
    function safeCell(v) {
        if (typeof v !== 'string') return v;
        if (v.startsWith('data:image')) return '[Embedded photo - not exported]';
        return v.length > 32000 ? v.slice(0, 32000) : v;
    }
    function patchXlsx() {
        const X = window.XLSX;
        if (!X || !X.utils || X.__v211) return;
        const aoa = X.utils.aoa_to_sheet, js = X.utils.json_to_sheet;
        X.utils.aoa_to_sheet = function (rows, o) { return aoa.call(this, (rows || []).map((r) => Array.isArray(r) ? r.map(safeCell) : r), o); };
        X.utils.json_to_sheet = function (rows, o) {
            return js.call(this, (rows || []).map((r) => {
                if (!r || typeof r !== 'object') return r;
                const c = {}; Object.keys(r).forEach((k) => { c[k] = safeCell(r[k]); }); return c;
            }), o);
        };
        X.__v211 = true;
    }
    patchXlsx();
    setTimeout(patchXlsx, 1500);

    // --- Category filter dropdown (fallback fill if the normal populate did not run) ---
    function fillCategoryFilter() {
        const sel = document.getElementById('inventory-filter-category');
        if (!sel) return;
        const counts = {};
        Object.values(inventoryData || {}).forEach((c) => {
            if (!c || typeof c !== 'object') return;
            const n = String(c.category || c.itemCategory || assignCategoryToItem(c) || '').trim();
            if (n) counts[n] = (counts[n] || 0) + 1;
        });
        const names = [...new Set([...(typeof ALL_STATIONERY_CATEGORIES !== 'undefined' ? ALL_STATIONERY_CATEGORIES : []), ...Object.keys(counts)])];
        const cur = sel.value;
        sel.innerHTML = '<option value="">All Categories</option>' +
            names.map((n) => `<option value="${esc(n)}">${esc(n)} (${counts[n] || 0} item${(counts[n] || 0) === 1 ? '' : 's'})</option>`).join('');
        if (cur) sel.value = cur;
    }
    setInterval(() => {
        const sel = document.getElementById('inventory-filter-category');
        if (sel && sel.options.length <= 1 && Object.keys(inventoryData || {}).length) fillCategoryFilter();
    }, 1500);
    document.addEventListener('focusin', (e) => {
        if (e.target && e.target.id === 'inventory-filter-category' && e.target.options.length <= 1) fillCategoryFilter();
    });

    // --- Low stock only + category change -> re-render ---
    document.addEventListener('change', (e) => {
        const id = e.target && e.target.id;
        if (id === 'lowOnly' || id === 'inventory-filter-category') {
            adminInventoryState.currentPage = 1;
            try { renderMasterInventory(); } catch (err) { console.error(err); }
        }
    });

    // --- old delete function now archives too ---
    window.deleteInventoryItem = async function (itemId) {
        if (typeof window.deleteProductWithArchive === 'function') return window.deleteProductWithArchive(itemId);
    };
})();


// =====================================================================================
// v2.3.0 (additive)
//   1) AI background removal for product photos (imglyRemoveBackground was never defined)
//   2) Staff Directory: designation (Vice Principal etc.), Edit button, search + role filter
//   3) Designation shown in Admin / Teacher dashboard header
//   4) Announcements: admin publishes -> popup when staff open the app
//   5) Saved signature: first order = sign, next orders = verify (biometric / password) + auto-attach
// =====================================================================================
(function initV230() {
    'use strict';
    const esc = (v) => escapeHtml(v == null ? '' : String(v));
    const safeKey = (v) => String(v || 'GUEST').replace(/[.#$\[\]\/]/g, '_');
    const isAdminRole = (r) => ['ADMIN', 'DEVELOPER', 'SUPER_ADMIN'].includes(String(r || '').toUpperCase());
    const myUid = () => (currentUser && (currentUser.adecPassNumber || currentUser.uid)) || '';

    // ---------------------------------------------------------------- 1) AI background removal
    let imglyModule = null;
    window.imglyRemoveBackground = async function(src) {
        if (!imglyModule) {
            imglyModule = await import('https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.5.5/+esm');
        }
        const fn = imglyModule.removeBackground || imglyModule.default;
        if (typeof fn !== 'function') throw new Error('Background removal library not available');
        let input = src;
        if (typeof src === 'string' && src.startsWith('data:')) input = await (await fetch(src)).blob();
        const job = fn(input, { output: { format: 'image/png' } });
        const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('Background removal timed out')), 120000));
        return Promise.race([job, timeout]);
    };

    // ---------------------------------------------------------------- 2) Designations + staff directory
    const DESIGNATIONS = ['Teacher', 'Principal', 'Vice Principal', 'Head of Department', 'Coordinator', 'Supervisor', 'Counselor', 'Librarian', 'Admin Staff'];
    const OTHER = '__other__';

    function fillDesignationSelect(sel, current) {
        if (!sel) return;
        const list = DESIGNATIONS.slice();
        if (current && !list.includes(current)) list.push(current);
        sel.innerHTML = list.map(d => `<option value="${esc(d)}">${esc(d)}</option>`).join('') + `<option value="${OTHER}">Other (type manually)…</option>`;
        sel.value = current || 'Teacher';
    }

    function readDesignation(sel, custom) {
        if (!sel) return 'Teacher';
        if (sel.value === OTHER) return (custom && custom.value.trim()) || 'Teacher';
        return sel.value || 'Teacher';
    }

    function bindOtherToggle(sel, custom) {
        if (!sel || !custom || sel._bound) return;
        sel._bound = true;
        sel.addEventListener('change', () => { custom.style.display = sel.value === OTHER ? 'block' : 'none'; if (sel.value === OTHER) custom.focus(); });
    }
    window.getProvisionDesignation = () => readDesignation(document.getElementById('admin-designation'), document.getElementById('admin-designation-custom'));
    window.resetProvisionDesignation = () => {
        fillDesignationSelect(document.getElementById('admin-designation'), 'Teacher');
        const c = document.getElementById('admin-designation-custom'); if (c) { c.value = ''; c.style.display = 'none'; }
    };

    let staffCache = {};
    let staffListenerOn = false;

    function renderStaffTable() {
        const list = document.getElementById('admin-staff-list');
        if (!list) return;
        const term = (document.getElementById('staff-search')?.value || '').toLowerCase().trim();
        const filt = document.getElementById('staff-filter-designation')?.value || '';

        // keep the role filter in sync with the data
        const fsel = document.getElementById('staff-filter-designation');
        if (fsel) {
            const all = Array.from(new Set(Object.values(staffCache).map(u => (u && u.designation) || 'Teacher'))).sort();
            const sig = all.join('|');
            if (fsel._sig !== sig) {
                fsel._sig = sig;
                fsel.innerHTML = '<option value="">All roles</option>' + all.map(d => `<option value="${esc(d)}">${esc(d)}</option>`).join('');
                fsel.value = all.includes(filt) ? filt : '';
            }
        }

        const rows = Object.entries(staffCache)
            .filter(([, u]) => u)
            .map(([id, u]) => ({ id, u, designation: u.designation || 'Teacher' }))
            .filter(({ id, u, designation }) => {
                if (filt && designation !== filt) return false;
                if (!term) return true;
                return [id, u.adecPassNumber, u.name, designation, u.role].join(' ').toLowerCase().includes(term);
            })
            .sort((a, b) => String(a.u.name || a.id).localeCompare(String(b.u.name || b.id)));

        const total = Object.keys(staffCache).length;
        const cnt = document.getElementById('staff-count');
        if (cnt) cnt.textContent = `Showing ${rows.length} of ${total} staff`;

        if (!rows.length) {
            list.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:26px;opacity:.8;">${total ? 'No staff match your search.' : 'No staff registered yet.'}</td></tr>`;
            return;
        }

        list.innerHTML = '';
        rows.forEach(({ id, u, designation }) => {
            const tr = document.createElement('tr');
            const accessBadge = String(u.role || '').toUpperCase() === 'ADMIN' ? ' <span class="badge bg-warning text-dark">ADMIN</span>' : '';
            tr.innerHTML = `<td><strong>${esc(u.adecPassNumber || id)}</strong></td>
                <td>${esc(u.name || 'N/A')}</td>
                <td><span class="badge bg-info">${esc(designation)}</span>${accessBadge}</td>
                <td><code>••••</code></td>
                <td><div class="staff-actions"><button type="button" class="edit-staff-btn">✏️ Edit</button><button type="button" class="remove-item-btn">Delete</button></div></td>`;
            tr.querySelector('.edit-staff-btn').onclick = () => openStaffEditor(id, u);
            tr.querySelector('.remove-item-btn').onclick = async () => {
                if (!confirm(`Delete ${u.name || id}?`)) return;
                try { await remove(ref(db, `users/${id}`)); showToast('Staff deleted'); }
                catch (err) { showToast('Delete failed: ' + err.message, 'error'); }
            };
            list.appendChild(tr);
        });
    }

    // used by fetchStaffList() below (the original function name is still called by the existing click handlers)
    window.__v230FetchStaff = function() {
        if (staffListenerOn) { renderStaffTable(); return; }
        staffListenerOn = true;
        addListener(ref(db, 'users'), (snap) => { staffCache = snap.val() || {}; renderStaffTable(); });
    };

    function openStaffEditor(id, u) {
        let el = document.getElementById('staffEditModal');
        if (el) el.remove();
        el = document.createElement('div');
        el.className = 'modal fade';
        el.id = 'staffEditModal';
        el.tabIndex = -1;
        el.innerHTML = `
        <div class="modal-dialog modal-dialog-centered"><div class="modal-content nc-modal-content">
            <div class="modal-header"><h5 class="modal-title">✏️ Edit Staff</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
            <div class="modal-body">
                <div class="mb-3"><label class="form-label fw-bold">ADEK Pass No</label><input class="form-control" value="${esc(u.adecPassNumber || id)}" disabled></div>
                <div class="mb-3"><label class="form-label fw-bold">Full Name</label><input id="se-name" class="form-control" value="${esc(u.name || '')}"></div>
                <div class="mb-3"><label class="form-label fw-bold">Role / Designation</label>
                    <select id="se-des" class="form-select"></select>
                    <input id="se-des-custom" class="form-control mt-2" placeholder="Type the designation" style="display:none">
                </div>
                <div class="mb-1"><label class="form-label fw-bold">New Password <small class="text-muted">(leave empty to keep the current one)</small></label>
                    <input id="se-pass" type="text" class="form-control" placeholder="••••" autocomplete="off"></div>
                <div id="se-msg" class="small text-danger mt-2"></div>
            </div>
            <div class="modal-footer"><button class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button><button id="se-save" class="btn btn-primary">Save changes</button></div>
        </div></div>`;
        document.body.appendChild(el);
        const sel = el.querySelector('#se-des'), cust = el.querySelector('#se-des-custom');
        fillDesignationSelect(sel, u.designation || 'Teacher');
        bindOtherToggle(sel, cust);
        const modal = new bootstrap.Modal(el);
        el.addEventListener('hidden.bs.modal', () => el.remove());
        el.querySelector('#se-save').onclick = async () => {
            const name = el.querySelector('#se-name').value.trim();
            const pass = el.querySelector('#se-pass').value.trim();
            const msg = el.querySelector('#se-msg');
            if (!name) { msg.textContent = 'Name cannot be empty.'; return; }
            if (pass && pass.length < 4) { msg.textContent = 'Password must be at least 4 characters.'; return; }
            const upd = { name, designation: readDesignation(sel, cust), updatedAt: new Date().toISOString() };
            if (pass) upd.password = pass;
            const btn = el.querySelector('#se-save'); btn.disabled = true;
            try {
                await update(ref(db, `users/${id}`), upd);
                showToast('Staff updated');
                modal.hide();
            } catch (err) { msg.textContent = 'Could not save: ' + err.message; btn.disabled = false; }
        };
        modal.show();
    }

    // ---------------------------------------------------------------- 3) Designation in dashboards
    async function applyDesignation() {
        try {
            const uid = myUid();
            if (!uid) return;
            const snap = await get(ref(db, `users/${uid}`));
            const d = snap.exists() ? snap.val().designation : null;
            if (!d) return;
            currentUser.designation = d;
            try { localStorage.setItem('currentUser', JSON.stringify(currentUser)); } catch (e) { }
            const role = String(currentUser.role || '').toUpperCase();
            if (role === 'TEACHER') {
                const idEl = document.getElementById('teacher-display-id');
                if (idEl) idEl.innerText = `${d} · ID: ${uid}`;
                const dId = document.getElementById('drawer-display-id');
                if (dId) dId.innerText = `${d} · ${uid}`;
            } else {
                const r = document.getElementById('admin-header-role'); if (r) r.textContent = d;
                const dr = document.getElementById('admin-drawer-role'); if (dr) dr.textContent = d;
            }
        } catch (e) { console.warn('designation not applied', e); }
    }
    window.applyDesignation = applyDesignation;

    // ---------------------------------------------------------------- 4) Announcements
    const TYPE_META = {
        info: { icon: 'ℹ️', label: 'Information', color: '#2563eb' },
        alert: { icon: '⚠️', label: 'Alert', color: '#f59e0b' },
        restriction: { icon: '⛔', label: 'Restriction', color: '#dc2626' }
    };
    let annListenerOn = false;

    function renderAnnouncementList(data) {
        const box = document.getElementById('announce-list');
        if (!box) return;
        const rows = Object.entries(data || {}).sort((a, b) => String(b[1].createdAt || '').localeCompare(String(a[1].createdAt || '')));
        if (!rows.length) { box.innerHTML = '<div class="dh-empty">No announcements yet.</div>'; return; }
        const audLbl = { all: 'Everyone', teachers: 'Teachers / Staff', admins: 'Admins' };
        box.innerHTML = rows.map(([id, a]) => {
            const m = TYPE_META[a.type] || TYPE_META.info;
            const expired = a.expiresAt && new Date(a.expiresAt) < new Date();
            const live = a.active !== false && !expired;
            return `<article class="ann-card" style="border-left-color:${m.color}">
                <div class="ann-card-top"><b>${m.icon} ${esc(a.title)}</b>
                    <span class="ann-pill ${live ? 'live' : 'off'}">${expired ? 'Expired' : (live ? 'Live' : 'Paused')}</span></div>
                <div class="ann-card-msg">${esc(a.message)}</div>
                <div class="ann-card-meta">${m.label} · To: ${esc(audLbl[a.audience] || 'Everyone')} · ${a.repeat === 'always' ? 'Every app open' : 'Once per person'}${a.expiresAt ? ' · Expires ' + esc(new Date(a.expiresAt).toLocaleDateString()) : ''} · ${esc(a.createdAt ? new Date(a.createdAt).toLocaleString() : '')}</div>
                <div class="ann-card-actions">
                    <button type="button" class="hist-act pdf" data-ann="toggle" data-id="${esc(id)}" data-active="${a.active !== false}">${a.active !== false ? '⏸ Pause' : '▶ Activate'}</button>
                    <button type="button" class="hist-act" style="background:#dc2626" data-ann="delete" data-id="${esc(id)}">🗑 Delete</button>
                </div></article>`;
        }).join('');
    }

    function startAnnouncementAdmin() {
        if (annListenerOn) return;
        annListenerOn = true;
        addListener(ref(db, 'announcements'), (snap) => renderAnnouncementList(snap.val() || {}));
    }

    async function publishAnnouncement(e) {
        e.preventDefault();
        const msgEl = document.getElementById('announce-message');
        const title = document.getElementById('ann-title').value.trim();
        const message = document.getElementById('ann-message').value.trim();
        if (!title || !message) return;
        const exp = document.getElementById('ann-expires').value;
        const payload = {
            title, message,
            type: document.getElementById('ann-type').value,
            audience: document.getElementById('ann-audience').value,
            repeat: document.getElementById('ann-repeat').value,
            expiresAt: exp ? new Date(exp + 'T23:59:59').toISOString() : '',
            active: true,
            createdAt: new Date().toISOString(),
            createdBy: (currentUser && (currentUser.name || currentUser.adecPassNumber)) || 'Admin'
        };
        const btn = e.target.querySelector('button[type="submit"]'); if (btn) btn.disabled = true;
        try {
            await push(ref(db, 'announcements'), payload);
            e.target.reset();
            showToast('Announcement published!');
            if (msgEl) { msgEl.textContent = '✅ Published. Staff will see it when they open the app.'; msgEl.className = 'message success'; }
        } catch (err) {
            showToast('Could not publish: ' + err.message, 'error');
            if (msgEl) { msgEl.textContent = 'Error: ' + err.message + ' (check Realtime Database rules for "announcements")'; msgEl.className = 'message error'; }
        } finally { if (btn) btn.disabled = false; }
    }

    document.addEventListener('click', async (ev) => {
        const b = ev.target.closest && ev.target.closest('[data-ann]');
        if (!b) return;
        const id = b.dataset.id;
        try {
            if (b.dataset.ann === 'toggle') await update(ref(db, `announcements/${id}`), { active: b.dataset.active !== 'true' });
            else if (b.dataset.ann === 'delete' && confirm('Delete this announcement?')) await remove(ref(db, `announcements/${id}`));
        } catch (err) { showToast('Failed: ' + err.message, 'error'); }
    });

    function showAnnouncementPopup(a, done) {
        const m = TYPE_META[a.type] || TYPE_META.info;
        const ov = document.createElement('div');
        ov.className = 'ann-ov';
        ov.innerHTML = `<div class="ann-box" role="dialog" aria-modal="true">
            <div class="ann-head" style="background:${m.color}"><span class="ann-ico">${m.icon}</span><div><small>${m.label} from Admin</small><b>${esc(a.title)}</b></div></div>
            <div class="ann-body">${esc(a.message)}</div>
            <div class="ann-foot"><button type="button" class="ann-ok" style="background:${m.color}">I understand</button></div></div>`;
        document.body.appendChild(ov);
        requestAnimationFrame(() => ov.classList.add('show'));
        try { if (navigator.vibrate) navigator.vibrate([150, 80, 150]); } catch (e) { }
        ov.querySelector('.ann-ok').onclick = () => { ov.classList.remove('show'); setTimeout(() => { ov.remove(); done(); }, 220); };
    }

    let annChecking = false;
    window.checkAnnouncements = async function() {
        if (annChecking || !currentUser) return;
        annChecking = true;
        try {
            const uid = safeKey(myUid());
            const admin = isAdminRole(currentUser.role);
            const snap = await get(ref(db, 'announcements'));
            const now = new Date();
            const queue = Object.entries(snap.val() || {})
                .map(([id, a]) => ({ id, ...a }))
                .filter(a => a.active !== false)
                .filter(a => !a.expiresAt || new Date(a.expiresAt) >= now)
                .filter(a => a.audience === 'all' || !a.audience || (a.audience === 'admins' && admin) || (a.audience === 'teachers' && !admin))
                .filter(a => a.repeat === 'always'
                    ? !sessionStorage.getItem(`ann_sess_${uid}_${a.id}`)
                    : !localStorage.getItem(`ann_seen_${uid}_${a.id}`))
                .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));

            const next = () => {
                const a = queue.shift();
                if (!a) { annChecking = false; return; }
                if (a.repeat === 'always') sessionStorage.setItem(`ann_sess_${uid}_${a.id}`, '1');
                else localStorage.setItem(`ann_seen_${uid}_${a.id}`, '1');
                try { pushInAppNotification({ key: `ann_${a.id}`, title: `📢 ${a.title}`, body: a.message, popup: false, type: 'system' }); } catch (e) { }
                showAnnouncementPopup(a, next);
            };
            if (queue.length) next(); else annChecking = false;
        } catch (e) {
            annChecking = false;
            console.warn('Announcements not loaded:', e);
        }
    };

    // ---------------------------------------------------------------- 5) Saved signature + verification
    window.getSavedSignature = async function(uid) {
        try {
            const s = await get(ref(db, `user_signatures/${safeKey(uid)}`));
            return s.exists() ? (s.val().dataUrl || null) : null;
        } catch (e) { console.warn('saved signature unavailable', e); return null; }
    };

    window.saveUserSignature = async function(uid, dataUrl) {
        try {
            // keep the stored copy small (max 600px wide), transparent PNG
            const small = await new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    const scale = Math.min(1, 600 / img.width);
                    const c = document.createElement('canvas');
                    c.width = Math.max(1, Math.round(img.width * scale)); c.height = Math.max(1, Math.round(img.height * scale));
                    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
                    resolve(c.toDataURL('image/png'));
                };
                img.onerror = () => resolve(dataUrl);
                img.src = dataUrl;
            });
            await set(ref(db, `user_signatures/${safeKey(uid)}`), { dataUrl: small, updatedAt: new Date().toISOString() });
        } catch (e) { console.warn('Could not save signature for next time:', e); }
    };

    async function verifyWithBiometric(uid) {
        const credIdStr = localStorage.getItem('biometric_cred_id');
        const enrolledFor = String(localStorage.getItem('biometric_adec') || '').toUpperCase();
        if (!window.isBiometricEnrolled() || localStorage.getItem('biometricEnabled') !== 'true' || !credIdStr || enrolledFor !== String(uid).toUpperCase()) return null; // not available
        try {
            const credId = new Uint8Array(atob(credIdStr).split('').map(c => c.charCodeAt(0)));
            const a = await navigator.credentials.get({ publicKey: {
                challenge: window.crypto.getRandomValues(new Uint8Array(32)),
                allowCredentials: [{ id: credId, type: 'public-key' }],
                userVerification: 'required', timeout: 60000 } });
            return !!a;
        } catch (e) { return false; }
    }

    window.confirmSavedSignatureUse = function(uid, savedDataUrl, { onUse, onResign }) {
        const ov = document.createElement('div');
        ov.className = 'ann-ov sigv';
        ov.innerHTML = `<div class="ann-box" role="dialog" aria-modal="true">
            <div class="ann-head" style="background:#0f766e"><span class="ann-ico">🔐</span><div><small>Verification required</small><b>Use your saved signature?</b></div></div>
            <div class="ann-body">
                <div class="sigv-prev"><img src="${savedDataUrl}" alt="Saved signature"></div>
                <p class="sigv-note">Verify it is you and your saved signature will be attached to this request automatically.</p>
                <div class="sigv-pass" style="display:none"><input type="password" id="sigv-pass" placeholder="Enter your account password" autocomplete="current-password"></div>
                <div class="sigv-err" id="sigv-err"></div>
            </div>
            <div class="ann-foot sigv-foot">
                <button type="button" class="ann-ok" id="sigv-go" style="background:#0f766e">🔐 Verify &amp; Submit</button>
                <button type="button" class="sigv-sec" id="sigv-re">✍ Sign again</button>
                <button type="button" class="sigv-sec" id="sigv-x">Cancel</button>
            </div></div>`;
        document.body.appendChild(ov);
        requestAnimationFrame(() => ov.classList.add('show'));
        const close = () => { ov.classList.remove('show'); setTimeout(() => ov.remove(), 200); };
        const err = ov.querySelector('#sigv-err');
        const passBox = ov.querySelector('.sigv-pass');
        let passwordMode = false;

        const finish = () => { close(); onUse(); };
        const checkPassword = async () => {
            const typed = ov.querySelector('#sigv-pass').value;
            if (!typed) { err.textContent = 'Please enter your password.'; return; }
            const s = await get(ref(db, `users/${uid}`));
            const real = s.exists() ? String(s.val().password || s.val().pass || '').trim() : '';
            if (real && real === typed.trim()) finish(); else err.textContent = 'Incorrect password.';
        };
        const showPasswordMode = (why) => {
            passwordMode = true; passBox.style.display = 'block';
            err.textContent = why || '';
            ov.querySelector('#sigv-pass').focus();
        };

        ov.querySelector('#sigv-go').onclick = async () => {
            err.textContent = '';
            if (passwordMode) return checkPassword();
            const bio = await verifyWithBiometric(uid);
            if (bio === true) return finish();
            if (bio === false) return showPasswordMode('Biometric verification failed or was cancelled. Enter your password instead.');
            showPasswordMode('Biometric login is not enabled on this device. Please confirm with your password.');
        };
        ov.querySelector('#sigv-re').onclick = () => { close(); onResign(); };
        ov.querySelector('#sigv-x').onclick = close;
    };

    // ---------------------------------------------------------------- wiring
    function wire() {
        // designation selects
        const sel = document.getElementById('admin-designation'), cust = document.getElementById('admin-designation-custom');
        fillDesignationSelect(sel, 'Teacher'); bindOtherToggle(sel, cust);

        document.getElementById('staff-search')?.addEventListener('input', renderStaffTable);
        document.getElementById('staff-filter-designation')?.addEventListener('change', renderStaffTable);

        // 3rd sub tab
        const bA = document.getElementById('btn-show-announce');
        const vA = document.getElementById('staff-announce-view');
        if (bA && vA) {
            bA.addEventListener('click', () => {
                ['staff-provision-view', 'staff-list-view'].forEach(id => { const e = document.getElementById(id); if (e) e.style.display = 'none'; });
                vA.style.display = 'block';
                ['btn-show-provision', 'btn-show-directory'].forEach(id => document.getElementById(id)?.classList.remove('active'));
                bA.classList.add('active');
                startAnnouncementAdmin();
            });
            ['btn-show-provision', 'btn-show-directory'].forEach(id => {
                document.getElementById(id)?.addEventListener('click', () => { vA.style.display = 'none'; bA.classList.remove('active'); });
            });
        }
        document.getElementById('announce-form')?.addEventListener('submit', publishAnnouncement);

        // run once the dashboard is rendered (also when a saved session is restored)
        const origRender = window.renderDashboardForRole;
        if (typeof origRender === 'function' && !origRender.__v230) {
            const wrapped = function() {
                const r = origRender.apply(this, arguments);
                setTimeout(applyDesignation, 700);
                setTimeout(() => window.checkAnnouncements(), 1500);
                return r;
            };
            wrapped.__v230 = true;
            window.renderDashboardForRole = wrapped;
        }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();
})();
