// Firebase SDK imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getDatabase, ref, get, child, set, push, onValue, update, remove } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-analytics.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging.js";

// Define Current App Version
const APP_VERSION = "1.8.68";

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
const OFFLINE_PLACEHOLDER = "data:image/svg+xml;utf8," + OFF_SVG;
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

window.enableFcmNotifications = async function() {
    console.log("🔔 Enable Notifications menu item clicked...");

    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
        alert("This browser does not support Web Push Notifications.");
        return;
    }

    if (Notification.permission === 'denied') {
        alert("⚠️ Notifications are blocked in your browser settings.\n\nTo enable notifications:\n1. Click the lock icon near the website URL bar.\n2. Set Notifications to 'Allow'.\n3. Reload the page.");
        return;
    }

    try {
        const btnAdmin = document.getElementById('enable-notifications-btn-admin');
        const btnTeacher = document.getElementById('enable-notifications-btn-teacher');
        [btnAdmin, btnTeacher].forEach(b => { if (b) b.textContent = "⏳ Registering FCM..."; });

        const permission = await Notification.requestPermission();

        if (permission === 'granted') {
            const swReg = await navigator.serviceWorker.register('firebase-messaging-sw.js');
            console.log("✅ FCM Service Worker registered:", swReg);

            const token = await getToken(messaging, { serviceWorkerRegistration: swReg });

            if (token) {
                console.log("🔑 FCM Registration Token:", token);

                const teacherId = (currentUser && (currentUser.adecPassNumber || currentUser.uid)) || localStorage.getItem('stationery_user_adec') || 'GUEST_USER';

                const tokenPayload = {
                    fcmToken: token,
                    fcmTokenLastUpdated: new Date().toISOString()
                };

                await update(ref(db, `users/${teacherId}`), tokenPayload);
                await update(ref(db, `fcm_tokens/${teacherId}`), {
                    token: token,
                    teacherId: teacherId,
                    lastUpdated: new Date().toISOString()
                });

                showToast("🎉 Push Notifications Enabled Successfully!", "success");
            } else {
                showToast("⚠️ Could not retrieve FCM token.", "error");
            }
        } else {
            showToast("Notification permission was not granted.", "error");
        }

        window.updateFcmUIStatus();

    } catch (err) {
        console.error("FCM Registration Error:", err);
        showToast("FCM Error: " + err.message, "error");
        window.updateFcmUIStatus();
    }
};

try {
    onMessage(messaging, (payload) => {
        console.log("🔔 Foreground Push Message Received:", payload);
        const title = payload.notification?.title || "Stationery Alert";
        const body = payload.notification?.body || "New update received";
        showToast(`🔔 ${title}: ${body}`, "info");
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
    const container = document.getElementById('stationery-rain-container') || document.getElementById('stationeryRainContainer');
    if (!container) return;

    const isMobile = window.innerWidth <= 768;
    const targetCount = isMobile ? 18 : 32;

    container.innerHTML = '';

    const stationerySVGs = [
        // 1. Pencil
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path d="M6 26l3 3 17-17-3-3L6 26z" fill="#FFC107"/><path d="M4 28l2-2 3 3-2 2H4v-3z" fill="#795548"/><path d="M23 6l3 3 2-2-3-3-2 2z" fill="#E91E63"/><path d="M22 7l3 3 1-1-3-3-1 1z" fill="#9E9E9E"/></svg>`,
        // 2. Ballpoint Pen
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path d="M8 24l2 2 16-16-2-2L8 24z" fill="#2196F3"/><path d="M5 27l3-3-2-2-3 3v2h2z" fill="#0D47A1"/><path d="M24 6l2 2 3-3-2-2-3 3z" fill="#B0BEC5"/><path d="M20 10l6-6" stroke="#90A4AE" stroke-width="2"/></svg>`,
        // 3. Eraser
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path d="M6 18l12 10 10-10L16 8 6 18z" fill="#FF80AB"/><path d="M12 23l6 5 10-10-6-5-10 10z" fill="#3F51B5"/></svg>`,
        // 4. Sharpener
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect x="6" y="8" width="20" height="16" rx="3" fill="#00BCD4"/><circle cx="16" cy="16" r="4" fill="#37474F"/><path d="M16 12v8" stroke="#CFD8DC" stroke-width="2"/></svg>`,
        // 5. Ruler
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect x="4" y="10" width="24" height="12" rx="2" fill="#FFD54F"/><path d="M8 10v4M12 10v6M16 10v4M20 10v4" stroke="#5D4037" stroke-width="1.5"/></svg>`,
        // 6. Highlighter
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path d="M10 12h12v12H10z" fill="#76FF03"/><path d="M12 6h8v6h-8z" fill="#33691E"/><path d="M13 24l3 5 3-5h-6z" fill="#CCFF90"/></svg>`,
        // 7. Marker
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect x="11" y="10" width="10" height="14" rx="2" fill="#FF3D00"/><path d="M13 4h6v6h-6z" fill="#DD2C00"/><path d="M14 24l2 4 2-4h-4z" fill="#FF9E80"/></svg>`,
        // 8. Notebook
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect x="8" y="5" width="18" height="22" rx="2" fill="#3F51B5"/><path d="M6 8h4M6 12h4M6 16h4M6 20h4M6 24h4" stroke="#FFF" stroke-width="2"/><path d="M12 9h10M12 14h10M12 19h10" stroke="#9FA8DA" stroke-width="1.5"/></svg>`,
        // 9. Paper Sheet
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path d="M8 4h11l7 7v17H8V4z" fill="#ECEFF1"/><path d="M19 4v7h7" fill="#CFD8DC"/><path d="M11 14h10M11 18h10M11 22h7" stroke="#90A4AE" stroke-width="1.5"/></svg>`,
        // 10. Sticky Note
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path d="M6 6h20v14l-6 6H6V6z" fill="#FFEE58"/><path d="M20 20v6l6-6h-6z" fill="#FBC02D"/></svg>`,
        // 11. Paper Clip
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path d="M12 8v12a4 4 0 0 0 8 0V7a2.5 2.5 0 0 0-5 0v11a1 1 0 0 0 2 0V9" fill="none" stroke="#B0BEC5" stroke-width="2.5" stroke-linecap="round"/></svg>`,
        // 12. Binder Clip
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path d="M8 18h16l-3 8H11l-3-8z" fill="#263238"/><path d="M12 8c0-3 2-4 4-4s4 1 4 4v10h-8V8z" fill="none" stroke="#B0BEC5" stroke-width="2"/></svg>`,
        // 13. Scissors
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="10" cy="24" r="3" fill="none" stroke="#E91E63" stroke-width="2"/><circle cx="22" cy="24" r="3" fill="none" stroke="#E91E63" stroke-width="2"/><path d="M11 21l8-13M21 21L13 8" stroke="#B0BEC5" stroke-width="2.5"/></svg>`,
        // 14. Glue Stick
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect x="11" y="12" width="10" height="14" rx="1" fill="#FF9800"/><rect x="11" y="6" width="10" height="6" fill="#FFF"/><path d="M11 22h10v4h-10z" fill="#E65100"/></svg>`,
        // 15. Stapler
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path d="M6 22h20v3H6z" fill="#455A64"/><path d="M6 18c0-4 4-6 10-6h10v6H6z" fill="#1E88E5"/><path d="M6 18v4h2v-4H6z" fill="#CFD8DC"/></svg>`,
        // 16. Pencil Case
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect x="5" y="10" width="22" height="12" rx="4" fill="#9C27B0"/><path d="M5 14h22" stroke="#BA68C8" stroke-width="2"/><circle cx="24" cy="14" r="1.5" fill="#FFD54F"/></svg>`,
        // 17. Crayon
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path d="M8 12l10-6 6 6-10 16-6-16z" fill="#E91E63"/><path d="M11 10l3-1.8 3 3L14 13l-3-3z" fill="#C2185B"/></svg>`,
        // 18. Correction Tape
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path d="M6 12a8 8 0 0 1 12-7l8 5a5 5 0 0 1 0 8l-8 5a8 8 0 0 1-12-11z" fill="#009688"/><circle cx="12" cy="16" r="3" fill="#FFF"/></svg>`,
        // 19. Folder
        `<svg viewBox="0 0 32 32"><path d="M4 8h8l3 3h13v13H4V8z" fill="#FFCA28"/><path d="M4 12h24v12H4V12z" fill="#FFB300"/></svg>`,
        // 20. Set Square Ruler
        `<svg viewBox="0 0 32 32"><path d="M6 26V6l20 20H6z" fill="#FF7043"/><path d="M10 22V12l10 10H10z" fill="#FFF"/></svg>`
    ];

    for (let i = 0; i < targetCount; i++) {
        const drop = document.createElement('div');
        drop.className = 'stationery-drop';

        const svgIndex = i % stationerySVGs.length;
        drop.innerHTML = stationerySVGs[svgIndex];

        const leftPos = Math.random() * 92 + 2; // 2% to 94%
        const size = getStationeryItemSize(); // Responsive item size
        const duration = (Math.random() * 8 + 7).toFixed(2); // 7s to 15s
        const delay = (Math.random() * -12).toFixed(2); // -12s to 0s
        const sway = (Math.random() * 50 - 25).toFixed(0); // -25px to 25px
        const opacity = (Math.random() * 0.15 + 0.85).toFixed(2); // 0.85 to 1.0 opacity

        drop.style.setProperty('--x', `${leftPos}%`);
        drop.style.setProperty('--size', `${size}px`);
        drop.style.setProperty('--duration', `${duration}s`);
        drop.style.setProperty('--delay', `${delay}s`);
        drop.style.setProperty('--sway', `${sway}px`);
        drop.style.opacity = opacity;

        container.appendChild(drop);
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
        const blob = await imglyRemoveBackground(base64OrFile);
        const transparentUrl = URL.createObjectURL(blob);
        return new Promise((resolve) => {
            const img = new Image();
            img.src = transparentUrl;
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
    if (!itemData) {
        try {
            const snapshot = await get(itemRef);
            itemData = snapshot.val();
        } catch (e) {
            console.error("Failed to fetch item for deduction:", e);
        }
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
window.initSignaturePad = function(canvasId, clearBtnId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;

    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width || 400;
    canvas.height = 200;

    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";

    let isDrawing = false;

    function getPos(e) {
        const r = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return { x: clientX - r.left, y: clientY - r.top };
    }

    function startDraw(e) {
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
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width * ratio;
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
        return { x: clientX - rect.left, y: clientY - rect.top };
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
        getDataUrl: () => canvas.toDataURL('image/png')
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
    if (typeof startOcrCamera === 'function') startOcrCamera();
};

async function initScanner() {
    if (!html5QrCode) html5QrCode = new Html5Qrcode("reader");
    const config = { fps: 10, qrbox: { width: 250, height: 150 }, aspectRatio: 1.0 };

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
    } catch (err) {
        console.error("Scanner Error:", err);
        showToast("Camera error: Check permissions.", "error");
        stopScanner();
    }
}

async function stopScanner() {
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
            alert("Live camera failed. Opening device camera app...");
            fallbackInput.click();
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

async function runOcrScan(canvasElement) {
    const loader = $('ocr-loader');
    const statusText = $('ocr-status-text');
    if (loader) loader.style.display = 'flex';

    try {
        const worker = await Tesseract.createWorker('eng');
        await worker.setParameters({
            tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
            tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz:-./ ',
            preserve_interword_spaces: '1'
        });

        if (statusText) statusText.textContent = "Enhancing image for OCR...";
        const enhancedCanvas = preprocessImageForOcr(canvasElement);

        if (statusText) statusText.textContent = "Reading text from label...";
        const { data } = await worker.recognize(enhancedCanvas);
        const sanitized = data.text.trim();

        await worker.terminate();

        const inputEl = $(currentOcrTarget);
        if (inputEl && sanitized.length > 1) {
            inputEl.value = sanitized;
            inputEl.dispatchEvent(new Event('input'));
            speakExtractedText(sanitized);
            showToast(`Captured: ${sanitized}`, 'success');
        } else {
            alert("Could not extract clear text. Please ensure the label is in focus and well-lit.");
        }
        stopOcrCamera();
    } catch (error) {
        console.error("OCR Error:", error);
        showToast("OCR processing error.", "error");
        if (loader) loader.style.display = 'none';
    }
}

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
                    authenticatorAttachment: "platform",
                    userVerification: "required",
                },
                timeout: 60000,
                attestation: "direct"
            }
        };

        const credential = await navigator.credentials.create(createCredentialOptions);

        if (credential) {
            localStorage.setItem('biometric_enrolled', 'true');
            localStorage.setItem('biometric_adec', adecNumber);
            localStorage.setItem('biometric_cred_id', btoa(String.fromCharCode(...new Uint8Array(credential.rawId))));
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

window.toggleBiometricAuth = async function(event) {
    const isChecked = event.target.checked;
    if (isChecked) {
        const supported = await window.checkBiometricSupport();
        if (!supported) {
            alert("Biometric authentication is not supported on this device/browser.");
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
        localStorage.setItem('biometricEnabled', 'false');
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

    if (!passNumber || !password) {
        alert("Please enter credentials.");
        return;
    }

    if (passNumber === "ASIF" && password === "Asif8013@#$") {
        console.log("Bypass Login Successful for Admin: Asif");
        sessionStorage.setItem('isAdminAuthenticated', 'true');
        currentUser = { role: 'ADMIN', name: 'Asif', uid: 'Asif', adecPassNumber: 'Asif' };
        localStorage.setItem('stationery_user_adec', 'Asif');
        localStorage.setItem('currentUser', JSON.stringify(currentUser));

        const loginEl = document.getElementById('login-view');
        if (loginEl) {
            loginEl.classList.add('d-none');
            loginEl.style.display = 'none';
        }

        window.renderDashboardForRole('ADMIN', 'Asif');
        if (loginError) loginError.textContent = "";
        return;
    }

    if (loginBtn) {
        loginBtn.disabled = true;
        loginBtn.textContent = "Authenticating...";
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
                localStorage.setItem('stationery_user_adec', matchedKey);

                const role = userData.role || 'TEACHER';
                currentUser = {
                    role: role,
                    name: userData.name || matchedKey,
                    uid: matchedKey,
                    adecPassNumber: matchedKey
                };
                localStorage.setItem('currentUser', JSON.stringify(currentUser));

                const loginEl = document.getElementById('login-view');
                if (loginEl) {
                    loginEl.classList.add('d-none');
                    loginEl.style.display = 'none';
                }

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
                alert("⚠️ Incorrect Password. Please try again.");
            }
        } else {
            alert("⚠️ ADEK Pass Number not found. Please check your credentials or contact administrator.");
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

    if (confirm("Are you sure you want to logout?")) {
        console.log("Clearing user session...");

        localStorage.removeItem('stationery_user_adec');
        localStorage.removeItem('currentUserPass');
        localStorage.removeItem('currentUserRole');
        localStorage.removeItem('currentUserName');
        localStorage.removeItem('teacherStationeryCart');
        sessionStorage.removeItem('isAdminAuthenticated');
        sessionStorage.clear();

        cleanupListeners();
        currentUser = null;
        window.stationeryCart = [];
        updateCartBadge();
        catalogState.allItems = []; catalogState.filtered = []; catalogState.currentPage = 1; catalogState.searchTerm = '';

        alert("Logged out successfully.");
        window.location.reload();
    }
};

window.safeShowView = function(viewIdToShow) {
    const allViews = document.querySelectorAll('.view, .dashboard-view');

    let targetFound = false;
    allViews.forEach(view => {
        if (view) {
            if (view.id === viewIdToShow) {
                view.classList.add('active');
                view.classList.remove('d-none');
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
            fallbackView.style.display = 'flex';
        }
    }
};

window.addEventListener('error', function(e) {
    console.error("Global JS Error caught:", e.error);
    const userView = $('user-view-container');
    if (userView && (userView.classList.contains('d-none') || userView.style.display === 'none')) {
        window.safeShowView('user-view-container');
    }
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
                bioBtn.onclick = window.loginWithBiometrics;
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
                    createdAt: new Date().toISOString()
                });
                showToast("Teacher account provisioned!");
                adminCreateTeacherForm.reset();
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

    const adminToggle = $('biometric-toggle-admin');
    const teacherToggle = $('biometric-toggle-drawer');
    if (adminToggle) adminToggle.checked = bioEnabled;
    if (teacherToggle) teacherToggle.checked = bioEnabled;

    if (savedAdec) {
        if (savedAdec === 'Asif' || (savedUser && savedUser.role === 'ADMIN')) {
            currentUser = {
                role: 'ADMIN',
                name: 'Asif',
                uid: 'Asif',
                adecPassNumber: 'Asif'
            };
            window.renderDashboardForRole('ADMIN', 'Asif');
        } else if (savedAdec === 'DEV001' || (savedUser && savedUser.role === 'developer')) {
            currentUser = {
                role: 'developer',
                name: 'Developer Mode',
                uid: 'DEV001',
                adecPassNumber: 'DEV001'
            };
            window.renderDashboardForRole('developer', 'DEV001');
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
        const cropWidth = vw * 0.8;
        const cropHeight = vh * 0.4;
        const cropX = (vw - cropWidth) / 2;
        const cropY = (vh - cropHeight) / 2;

        canvas.width = cropWidth;
        canvas.height = cropHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(video, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

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

    $('notification-bell')?.addEventListener('click', () => {
        renderNotificationList();
        const notifModal = new bootstrap.Modal($('notificationModal'));
        notifModal.show();
        const badgeEl = $('notif-badge');
        if (badgeEl) { badgeEl.textContent = '0'; badgeEl.classList.add('d-none'); }
    });

    $('clear-all-notifications-btn')?.addEventListener('click', () => {
        notificationsList = []; renderNotificationList(); updateNotificationBadge();
    });

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
function listenForNewOrders() {
    addListener(ref(db, 'orders'), (snapshot) => {
        const data = snapshot.val() || {};
        const pendingCount = Object.values(data).filter(o => o.status === 'Pending Approval').length;
        const badge = $('notif-badge');
        if (badge) {
            badge.textContent = pendingCount;
            badge.style.display = pendingCount > 0 ? 'flex' : 'none';
            if (pendingCount > 0) badge.classList.remove('d-none');
        }
        Object.entries(data).forEach(([id, order]) => {
            if (order.status === 'Pending Approval' && !alertedRequests.has(id)) {
                alertedRequests.add(id);
                addSystemNotification('New Order Received', `Order ID #${id} from ${order.teacherName}`);
                if (Notification.permission === "granted") {
                    new Notification("New Requisition Request", { body: `From: ${order.teacherName}`, icon: 'school.png' });
                }
            }
        });
    });
}

function addSystemNotification(title, message, timestamp = new Date()) {
    const notif = {
        id: Date.now(),
        title,
        message,
        time: new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    notificationsList.unshift(notif);
    updateNotificationBadge();
}

function updateNotificationBadge() {
    const badgeEl = $('notif-badge');
    if (badgeEl) {
        badgeEl.textContent = notificationsList.length;
        if (notificationsList.length > 0) {
            badgeEl.classList.remove('d-none');
            badgeEl.style.display = 'flex';
        }
    }
}

function renderNotificationList() {
    const container = $('notification-list-container');
    if (!container) return;
    if (notificationsList.length === 0) {
        container.innerHTML = `<li class="list-group-item text-center text-muted py-4">No notifications yet</li>`;
        return;
    }
    container.innerHTML = notificationsList.map(n => `
        <li class="list-group-item d-flex justify-content-between align-items-start p-3">
            <div>
                <strong class="d-block text-dark">${escapeHtml(n.title)}</strong>
                <small class="text-secondary">${escapeHtml(n.message)}</small>
            </div>
            <span class="badge bg-light text-dark ms-2" style="font-size:10px;">${n.time}</span>
        </li>
    `).join('');
}

// ==================== ROLE / DASHBOARD ====================
window.renderDashboardForRole = function(userRole, adecNumber) {
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
        if (overlay) overlay.classList.remove('active');
        sidebar.classList.remove('open');
    }

    const roleUpper = String(userRole).toUpperCase();
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
            listenForNewOrders();
        }
    } else if (roleUpper === 'TEACHER') {
        const teacherContainer = $('user-view-container');
        if (teacherContainer) {
            teacherContainer.classList.remove('d-none');
            teacherContainer.classList.add('active');
            teacherContainer.style.display = 'flex';

            const teacherNameEl = $('teacher-display-name');
            const teacherIdEl = $('teacher-display-id');
            if (teacherNameEl) teacherNameEl.innerText = currentUser?.name || 'Staff Member';
            if (teacherIdEl) teacherIdEl.innerText = `Employee ID: ${adecNumber || 'N/A'}`;

            fetchInventory();
            fetchTeacherOrderHistory(adecNumber);
        }
    } else {
        showView('login-view');
    }
};

async function handleUserRole(adecNumber) {
    try {
        const snapshot = await get(child(ref(db), `users/${adecNumber}`));
        if (snapshot.exists()) {
            const userData = snapshot.val();
            currentUser = { uid: adecNumber, ...userData };

            localStorage.setItem('currentUser', JSON.stringify(currentUser));

            fetchSystemBranding(); fetchCategories();

            if ("Notification" in window) Notification.requestPermission();

            window.renderDashboardForRole(userData.role, adecNumber);
        } else {
            localStorage.removeItem('stationery_user_adec');
            showView('login-view');
        }
    } catch (e) {
        console.error("Role Handling Error:", e);
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
                        <div class="mt-auto d-flex justify-content-between align-items-center pt-2">
                            ${stockBadgeHTML}
                            <button class="btn btn-primary btn-sm px-3 fw-bold" onclick="window.addToCart('${escapeHtml(product.id)}')">Add to Cart</button>
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
        const category = parentItem.category || parentItem.itemCategory || assignCategoryToItem(parentItem);
        const itemName = parentItem.itemName || parentItem.name || itemId;
        const serialNumber = parentItem.serialNumber || parentItem.sn || 'N/A';

        const qty = parseInt($('restockQty')?.value) || 0;
        const date = $('restockDate')?.value || new Date().toISOString().split('T')[0];
        const brand = $('restockBrand')?.value.trim() || parentItem.brand || 'Standard';
        const file = $('restockPhotoInput')?.files[0];

        if (qty <= 0) throw new Error("Please enter a valid Quantity Received (> 0).");

        let imageUrl = parentItem.imageUrl || FALLBACK_IMG;

        if (file) {
            showToast("Processing batch photo...");
            const compressed = await window.compressAndScaleImage(file);
            const studio = await window.generateStudioProductPhoto(compressed);
            const driveUrl = await uploadToGoogleDrive(studio, `Restock_${serialNumber}_${Date.now()}.jpg`, 'product');
            imageUrl = driveUrl || studio;
        }

        const batchId = 'BATCH_' + Date.now().toString().slice(-6) + '_' + serialNumber.replace(/[.#$[\]]/g, "_");

        const batchData = {
            brandName: brand,
            brand: brand,
            serialNumber: serialNumber,
            initialQty: qty,
            currentQty: qty,
            currentStock: qty,
            quantity: qty,
            receivedDate: date,
            imageUrl: imageUrl,
            createdAt: new Date().toISOString()
        };

        // 1. Write new batch sub-row under /inventory/${itemId}/batches/${batchId}
        await set(ref(db, `inventory/${itemId}/batches/${batchId}`), batchData);

        // 2. Recalculate combined stock = sum of all active batches
        const parentRef = ref(db, `inventory/${itemId}`);
        const snap = await get(parentRef);
        let existingBatches = {};
        if (snap.exists()) {
            existingBatches = snap.val().batches || {};
        }
        existingBatches[batchId] = batchData;

        const totalStock = Object.values(existingBatches).reduce(
            (sum, b) => sum + (parseInt(b.currentQty ?? b.currentStock ?? b.quantity ?? 0, 10) || 0),
            0
        );

        // 3. Update parent item root fields
        await update(parentRef, {
            category: category,
            itemName: itemName,
            name: itemName,
            serialNumber: serialNumber,
            brand: brand,
            quantity: totalStock,
            currentStock: totalStock,
            availableStock: totalStock,
            stock: totalStock,
            imageUrl: imageUrl
        });

        showToast(`Restock batch added for ${itemName}! Total Stock: ${totalStock} Pcs`);

        const modalEl = document.getElementById('restockBatchModal');
        if (modalEl) {
            bootstrap.Modal.getInstance(modalEl)?.hide();
        }

        fetchMasterInventory();
        fetchInventory();

    } catch (err) {
        alert("Error: " + err.message);
    } finally {
        if (btn) btn.disabled = false;
    }
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
        const catFilter = ($('inventory-filter-category')?.value || '').trim().toLowerCase();

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

        // Build Accordion HTML for Category -> Unique Parent Card (per Serial Number) -> Batch Sub-Rows
        let html = '<div class="accordion inventory-category-accordion" id="adminInventoryCategoryAccordion">';
        let categoryIndex = 0;

        categoryGroupMap.forEach((categoryProductsMap, categoryName) => {
            categoryIndex++;
            const categoryAccordionId = `inv_cat_acc_${categoryIndex}`;
            const isFirst = categoryIndex === 1;

            const productsList = Array.from(categoryProductsMap.values());
            const categoryTotalStock = productsList.reduce((sum, p) => sum + p.totalStock, 0);

            let catBadgeClass = 'bg-primary';
            if (categoryTotalStock <= 0) catBadgeClass = 'bg-secondary';
            else if (categoryTotalStock <= 5) catBadgeClass = 'bg-danger animate-pulse';
            else if (categoryTotalStock < 20) catBadgeClass = 'bg-warning text-dark';

            html += `
                <div class="accordion-item mb-3 border rounded shadow-sm overflow-hidden" style="border-radius: 12px !important;">
                    <h2 class="accordion-header" id="heading_${categoryAccordionId}">
                        <button class="accordion-button ${isFirst ? '' : 'collapsed'} bg-white py-3 fw-bold fs-5 text-dark d-flex justify-content-between align-items-center"
                                type="button" data-bs-toggle="collapse" data-bs-target="#collapse_${categoryAccordionId}"
                                aria-expanded="${isFirst ? 'true' : 'false'}" aria-controls="collapse_${categoryAccordionId}">
                            <div class="d-flex align-items-center gap-2">
                                <i class="bi bi-folder-fill text-warning me-1"></i>
                                <span>${escapeHtml(categoryName)}</span>
                                <span class="badge bg-light text-secondary border small ms-2">${productsList.length} Unique Product${productsList.length === 1 ? '' : 's'}</span>
                            </div>
                            <span class="badge ${catBadgeClass} p-2 px-3 me-3">
                                Category Stock: ${categoryTotalStock}
                            </span>
                        </button>
                    </h2>
                    <div id="collapse_${categoryAccordionId}" class="accordion-collapse collapse ${isFirst ? 'show' : ''}"
                         aria-labelledby="heading_${categoryAccordionId}" data-bs-parent="#adminInventoryCategoryAccordion">
                        <div class="accordion-body bg-light p-3">
            `;

            productsList.forEach((prod) => {
                const { catId, catData, productName, serialNumber, totalStock, allBatches, unit } = prod;
                const unitLabel = unit || catData?.unit || 'Pcs';

                let adminStockBadgeHTML = '';
                if (totalStock <= 0) {
                    adminStockBadgeHTML = `<span class="badge bg-secondary text-white p-2 px-3 fs-6">❌ Out of Stock (0 ${unitLabel})</span>`;
                } else if (totalStock <= 5) {
                    adminStockBadgeHTML = `<span class="badge bg-danger text-white p-2 px-3 fs-6 animate-pulse">⚠️ Emergency Reorder Needed (${totalStock} ${unitLabel} Left)</span>`;
                } else if (totalStock < 20) {
                    adminStockBadgeHTML = `<span class="badge bg-warning text-dark p-2 px-3 fs-6">Total Current Stock: ${totalStock} ${unitLabel}</span>`;
                } else {
                    adminStockBadgeHTML = `<span class="badge bg-success text-white p-2 px-3 fs-6">Total Current Stock: ${totalStock} ${unitLabel}</span>`;
                }

                html += `
                    <div class="card mb-3 border-0 shadow-sm overflow-hidden" style="border-radius: 10px;">
                        <div class="card-header bg-white py-3 border-bottom d-flex justify-content-between align-items-center flex-wrap gap-2">
                            <div>
                                <h5 class="mb-0 fw-bold text-dark"><i class="bi bi-box-seam text-primary me-2"></i>${escapeHtml(productName)}</h5>
                                <small class="text-muted">SN: <strong class="text-danger">${escapeHtml(serialNumber)}</strong> | Category: <strong>${escapeHtml(categoryName)}</strong></small>
                            </div>
                            <div class="d-flex align-items-center gap-2">
                                ${adminStockBadgeHTML}
                                <button class="btn btn-sm btn-success fw-bold ms-2" onclick="window.openRestockModal('${escapeHtml(catId)}')">
                                    <i class="bi bi-plus-circle me-1"></i> + Add Stock
                                </button>
                            </div>
                        </div>
                        <div class="table-responsive">
                            <table class="table table-hover align-middle mb-0 batch-inventory-table" style="font-size: 13px;">
                                <thead class="bg-light text-muted">
                                    <tr>
                                        <th style="width: 60px;">Image</th>
                                        <th>Brand / Manufacturer</th>
                                        <th>Serial / Batch No.</th>
                                        <th>Received Date</th>
                                        <th class="text-center">Current Qty</th>
                                        <th class="text-center">Initial Qty</th>
                                        <th>Status</th>
                                        <th class="text-end">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>`;

                if (allBatches.length === 0) {
                    html += `<tr><td colspan="8" class="text-center py-4 text-muted italic empty-batch-cell">No active stock batches for this product.</td></tr>`;
                } else {
                    allBatches.forEach((batchItem) => {
                        const { catId: bCatId, batchId, currentStock: cStock, initialQty, brand, serialNumber: bSerial, receivedDate, imageUrl, isLegacy } = batchItem;

                        html += `
                            <tr>
                                <td data-label="Image"><img src="${FALLBACK_IMG}" class="rounded inventory-batch-thumb" data-url="${imageUrl}" style="width: 40px; height: 40px; object-fit: contain; background: #f8f9fa;" loading="lazy"></td>
                                <td data-label="Brand / Manufacturer"><span class="fw-bold text-dark">${escapeHtml(brand)}</span></td>
                                <td data-label="Serial / Batch No."><code>${escapeHtml(bSerial)}</code></td>
                                <td data-label="Received Date">${escapeHtml(receivedDate)}</td>
                                <td data-label="Current Qty" class="text-center"><span class="badge ${cStock < 10 ? 'bg-warning text-dark' : 'bg-light text-dark border'} fw-bold">${cStock}</span></td>
                                <td data-label="Initial Qty" class="text-center text-muted">${initialQty}</td>
                                <td data-label="Status">${getStatusBadge(cStock)}</td>
                                <td data-label="Actions" class="text-end">`;
                        if (!isLegacy && batchId) {
                            html += `
                                    <button class="btn btn-sm btn-outline-primary py-0 px-2 me-1" onclick="window.openEditBatchModal('${escapeHtml(bCatId)}', '${escapeHtml(batchId)}')">Edit</button>
                                    <button class="btn btn-sm btn-outline-danger py-0 px-2" onclick="window.deleteBatch('${escapeHtml(bCatId)}', '${escapeHtml(batchId)}')">Delete</button>`;
                        } else {
                            html += `<span class="text-muted small">Legacy Record</span>`;
                        }
                        html += `</td></tr>`;
                    });
                }

                html += `</tbody></table></div></div>`;
            });

            html += `</div></div></div>`;
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
            currentStock: newQty,
            quantity: newQty,
            status: newQty > 0 ? "In Stock" : "Depleted"
        });

        const parentRef = ref(db, `inventory/${catId}`);
        const parentSnap = await get(parentRef);
        if (parentSnap.exists()) {
            const pVal = parentSnap.val();
            const allBatches = pVal.batches || {};
            const totalQty = Object.values(allBatches).reduce(
                (sum, b) => sum + (parseInt(b.currentStock ?? b.quantity ?? 0, 10) || 0),
                0
            );
            await update(parentRef, {
                quantity: totalQty,
                availableStock: totalQty,
                currentStock: totalQty,
                stock: totalQty
            });
        }

        showToast("Batch updated successfully!");
        fetchMasterInventory();
    } catch (e) {
        showToast("Error updating batch: " + e.message, "error");
    }
};

window.deleteBatch = async function(catId, batchId) {
    if (confirm(`Are you sure you want to delete this specific batch from ${catId}?`)) {
        try {
            await remove(ref(db, `inventory/${catId}/batches/${batchId}`));
            showToast("Batch deleted successfully");
        } catch (e) {
            showToast("Delete failed", "error");
        }
    }
};

// ==================== ANALYTICS ====================
function fetchOrderHistoryForAnalytics() {
    addListener(ref(db, 'orders'), (snap) => {
        const container = $('analytics-cards');
        if (!container) return;

        const data = snap.val() || {};
        const entries = Object.values(data);
        let totalOrders = entries.length;
        let p = 0, a = 0, d = 0;
        const teacherStats = {};

        entries.forEach(o => {
            if (o.status === 'Pending Approval') p++;
            else if (o.status.includes('Approved') || o.status.includes('Ready')) a++;
            else if (o.status.includes('Done') || o.status === 'Completed') d++;

            const teacherId = o.teacherUid || 'Unknown';
            const teacherName = o.teacherName || 'Staff Member';
            const key = `${teacherId}_${teacherName}`;

            if (!teacherStats[key]) {
                teacherStats[key] = { id: teacherId, name: teacherName, orders: 0, units: 0, p: 0, a: 0, d: 0 };
            }

            teacherStats[key].orders++;
            const units = (o.items || []).reduce((s, i) => s + (parseInt(i.requestQuantity) || 0), 0);
            teacherStats[key].units += units;

            if (o.status === 'Pending Approval') teacherStats[key].p++;
            else if (o.status.includes('Approved') || o.status.includes('Ready')) teacherStats[key].a++;
            else if (o.status.includes('Done') || o.status === 'Completed') teacherStats[key].d++;
        });

        teacherAnalyticsData = Object.values(teacherStats).sort((a, b) => b.units - a.units);

        let html = `
            <div class="analytics-card">
                <i class="bi bi-cart-fill fs-3 text-primary mb-2 d-block"></i>
                <h4>Total Orders</h4>
                <div class="total-items">${totalOrders}</div>
                <p class="text-muted small mb-0">Lifetime Volume</p>
            </div>`;

        html += `
            <div class="analytics-card">
                <i class="bi bi-stack fs-3 text-warning mb-2 d-block"></i>
                <h4>Pipeline Status</h4>
                <div class="total-items" style="font-size:16px; margin-top:8px;">
                    <span class="text-warning">${p}P</span> |
                    <span class="text-primary">${a}A</span> |
                    <span class="text-success">${d}D</span>
                </div>
                <p class="text-muted small mb-0">Pending / Approved / Done</p>
            </div>`;

        html += `
            <div class="analytics-card" style="border: 1px solid #3498db; background: #f0f7ff !important;">
                <i class="bi bi-people-fill fs-3 text-info mb-2 d-block"></i>
                <h4>Teacher Usage</h4>
                <div class="total-items">${teacherAnalyticsData.length} Staff</div>
                <button class="btn btn-sm btn-primary fw-bold mt-2 w-100" data-bs-toggle="modal" data-bs-target="#teacherAnalyticsModal">
                    View Breakdown 📊
                </button>
            </div>`;

        container.innerHTML = html;

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
            <td>${row.teacherSignatureUrl ? `<img src="${FALLBACK_IMG}" class="audit-thumb" data-url="${row.teacherSignatureUrl}" style="height:30px; background:#fff; border:1px solid #eee;" loading="lazy">` : '-'}</td>
            <td>${escapeHtml(row.issuerName)}</td>
            <td>${row.issuerSignatureUrl ? `<img src="${FALLBACK_IMG}" class="audit-thumb" data-url="${row.issuerSignatureUrl}" style="height:30px; background:#fff; border:1px solid #eee;" loading="lazy">` : '-'}</td>
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
                tr.innerHTML = `<td>${id}</td><td>${escapeHtml(order.teacherName)}</td><td>${new Date(order.timestamp).toLocaleDateString()}</td><td><div class="it-wrap" style="display:flex;gap:4px;"></div></td><td><span class="badge bg-success">Done</span></td><td><button class="view-details-btn">View Voucher</button></td>`;
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
                card.innerHTML = `
                    <div class="request-header">
                        <h4>${escapeHtml(order.teacherName)}</h4>
                        <span class="badge ${isPending ? 'bg-warning' : 'bg-info'}">${order.status}</span>
                    </div>
                    <div class="request-meta small text-muted mb-2">
                        ADEK: ${order.teacherUid} | Items: ${order.items?.length || 0}
                    </div>
                    <div class="request-items" style="display:flex;gap:10px;padding:10px 0;"></div>
                    ${order.teacherRequestSignature ? `
                        <div class="mb-2 text-center border rounded p-1 bg-light">
                            <small class="d-block text-muted">Teacher's Order Signature</small>
                            <img src="${order.teacherRequestSignature}" style="max-height:60px; max-width:100%;">
                        </div>
                    ` : ''}
                    <div class="request-actions">
                        ${isPending ? `<button class="action-btn prepare-btn btn-success" style="flex:1;" onclick="window.handleAdminPrepareClick(event, '${id}')">Approve Order</button>` : ''}
                        ${order.status.includes('Approved') ? `
                            <button class="action-btn handover-btn" style="flex:1;" onclick="window.handleFinalHandover(event, '${id}')">
                                Final Handover & Sign
                            </button>
                        ` : ''}
                    </div>`;

                const wrap = card.querySelector('.request-items');
                wrap.style.flexDirection = 'column';
                (order.items || []).forEach(it => {
                    const d = document.createElement('div'); d.className = 'd-flex align-items-center gap-2 mb-2 p-1 border rounded bg-white';
                    d.innerHTML = `
                        <img class="inventory-thumb admin-order-thumb" width="45" height="45" style="object-fit: contain;" data-url="${it.imageUrl}" loading="lazy">
                        <div style="flex: 1; overflow: hidden;">
                            <h6 class="mb-0 small fw-bold text-truncate">${escapeHtml(it.itemName)}</h6>
                            <small class="text-muted d-block" style="font-size: 9px;">SN: ${it.serial || it.serialNumber}</small>
                        </div>
                        <span class="badge bg-primary" style="font-size: 9px;">x${it.requestQuantity}</span>
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

// ==================== RECEIPT / REQUISITION VOUCHER ====================
window.viewOrderReceipt = async function(orderId) {
    try {
        showToast("Generating Official Requisition Voucher...", "info");
        const snap = await get(ref(db, `orders/${orderId}`));
        if (!snap.exists()) throw new Error("Order not found");
        const order = snap.val();

        const ts = new Date(order.completedAt || order.timestamp || Date.now());

        if ($('receipt-order-id')) $('receipt-order-id').innerText = orderId;
        if ($('receipt-date')) $('receipt-date').innerText = ts.toLocaleDateString() + ' ' + ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if ($('receipt-dispatch-date')) $('receipt-dispatch-date').innerText = ts.toLocaleDateString();

        if ($('receipt-teacher-name')) $('receipt-teacher-name').innerText = order.teacherName || "N/A";
        if ($('receipt-teacher-id')) $('receipt-teacher-id').innerText = order.teacherUid || order.teacherId || "N/A";
        if ($('receipt-department')) $('receipt-department').innerText = order.department || order.section || "Educational Staff";

        if ($('receipt-issuer-name')) $('receipt-issuer-name').innerText = order.issuedBy || order.handedOverBy || "Authorized Storekeeper";
        if ($('receipt-pickup-location')) $('receipt-pickup-location').innerText = order.pickupLocation || "Main Stationery Store";

        const statusBadge = $('receipt-status-badge');
        if (statusBadge) {
            const isDone = (order.status || '').toLowerCase().includes('completed') || (order.status || '').toLowerCase().includes('done');
            statusBadge.innerText = isDone ? "DELIVERED & APPROVED" : String(order.status || 'PENDING').toUpperCase();
            statusBadge.className = isDone ? "badge bg-success fs-6 px-3 py-2 mb-2 d-inline-block" : "badge bg-warning text-dark fs-6 px-3 py-2 mb-2 d-inline-block";
        }

        const itemsList = Array.isArray(order.items) ? order.items : Object.values(order.items || {});

        $('receipt-items-list').innerHTML = itemsList.map(item => {
            const itemImg = isValidImageUrl(item.imageUrl) ? item.imageUrl : (inventoryData[item.itemName]?.imageUrl || FALLBACK_IMG);
            const sn = item.batchSerialNumber || item.serialNumber || item.serial || item.sn || item.itemSn || 'N/A';
            const reqQty = item.requestQuantity || item.quantity || item.reqQty || 1;
            const issuedQty = item.issuedQty || reqQty;
            const stockBal = (item.stockBalance !== undefined && item.stockBalance !== 'N/A') ? `${item.stockBalance} Pcs` : (inventoryData[item.itemName]?.quantity !== undefined ? `${inventoryData[item.itemName].quantity} Pcs` : 'In Stock');

            return `
            <tr>
                <td class="text-center">
                    <img src="${FALLBACK_IMG}" class="receipt-thumb" data-url="${itemImg}" style="width: 50px; height: 40px; object-fit: contain; border-radius: 4px;" loading="lazy">
                </td>
                <td class="text-start">
                    <div class="fw-bold">${escapeHtml(item.itemName || item.name || 'Stationery Item')}</div>
                    ${item.brandName ? `<small class="text-muted">Brand: ${escapeHtml(item.brandName)}</small>` : ''}
                </td>
                <td class="text-center"><code>${escapeHtml(sn)}</code></td>
                <td class="text-center fw-bold">${reqQty}</td>
                <td class="text-center fw-bold text-success">${issuedQty}</td>
                <td class="text-center"><span class="badge bg-light text-dark border">${escapeHtml(stockBal)}</span></td>
            </tr>
        `}).join('');

        document.querySelectorAll('.receipt-thumb').forEach(img => {
            window.loadCachedImage(img, img.dataset.url);
        });

        // 1. Requester Signature Fallbacks
        const requesterSign = order.requesterSignature || order.teacherRequestSignature || order.teacherSign || order.teacherSignature || order.signature || order.receiverSignature || '';

        // 2. Storekeeper Signature Fallbacks
        const issuerSign = order.authorizedSignature || order.handoverSignatureUrl || order.handoverSignature || order.issuerSign || order.adminSign || order.storekeeperSign || order.issuerSignature || '';

        const teacherSigEl = $('receipt-teacher-sig');
        if (teacherSigEl && teacherSigEl.parentElement) {
            teacherSigEl.parentElement.innerHTML = renderSignatureHTML(requesterSign, "Requester Signature");
        }

        const adminSigEl = $('receipt-admin-sig');
        if (adminSigEl && adminSigEl.parentElement) {
            adminSigEl.parentElement.innerHTML = renderSignatureHTML(issuerSign, "Authorized Signature");
        }

        bootstrap.Modal.getOrCreateInstance($('receiptModal')).show();
    } catch (e) {
        showToast(e.message, "error");
    }
};

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

window.printReceipt = function() {
    window.print();
};

window.downloadReceiptPDF = function() {
    const element = document.getElementById('receipt-content');
    const orderId = document.getElementById('receipt-order-id').innerText;
    const options = {
        margin: [10, 10, 10, 10],
        filename: `Stationery_Receipt_${orderId}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(options).from(element).save();
};

// ==================== SYSTEM / STAFF ====================
function fetchStaffList() {
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
                    imageUrl: b.imageUrl || catData.imageUrl || b.photo || b.image || '',
                    photo: b.imageUrl || catData.imageUrl || b.photo || b.image || '',
                    image: b.imageUrl || catData.imageUrl || b.photo || b.image || '',
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
                imageUrl: catData.imageUrl || catData.photo || catData.image || '',
                photo: catData.imageUrl || catData.photo || catData.image || '',
                image: catData.imageUrl || catData.photo || catData.image || '',
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
        const openingQty = parseInt($('inv-opening-quantity').value) || 0;
        const file = $('inv-image').files[0];
        const itemCategory = cat === 'Other' ? $('inv-custom-category').value.trim() : cat;

        if (!itemName || !serialNumber) throw new Error("Name and SN required");

        // Duplicate Serial Number Check
        const snClean = serialNumber.toLowerCase();
        let duplicateFound = false;
        if (inventoryData) {
            Object.values(inventoryData).forEach(item => {
                if (!item) return;
                const parentSN = (item.serialNumber || item.batchNo || '').toString().trim().toLowerCase();
                if (parentSN === snClean) duplicateFound = true;
                if (item.batches && typeof item.batches === 'object') {
                    Object.values(item.batches).forEach(b => {
                        const bSN = (b.serialNumber || b.batchNo || '').toString().trim().toLowerCase();
                        if (bSN === snClean) duplicateFound = true;
                    });
                }
            });
        }

        if (duplicateFound) {
            const dupeAlert = `This Serial Number (${serialNumber}) already exists! Please use '+ Add Stock' on the existing item card instead.`;
            alert(dupeAlert);
            throw new Error(dupeAlert);
        }

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

            const currentStock = invItem ? parseInt(invItem.quantity ?? invItem.availableStock ?? invItem.currentStock ?? 0, 10) : 0;
            const newStock = Math.max(0, currentStock - qtyIssued);
            const itemPhoto = item.imageUrl || item.image || (invItem ? invItem.imageUrl || invItem.image : '') || FALLBACK_IMG;
            const finalSN = targetSN || (invItem ? invItem.serialNumber : null) || itemSN || '3546353';

            // 1. Update /inventory/{serialNumber} stock
            if (targetSN) {
                updates[`inventory/${targetSN}/quantity`] = newStock;
                updates[`inventory/${targetSN}/availableStock`] = newStock;
                updates[`inventory/${targetSN}/currentStock`] = newStock;
                updates[`inventory/${targetSN}/stock`] = newStock;
                updates[`inventory/${targetSN}/lastUpdated`] = timestamp;

                // Handle sub-batch stock update
                if (invItem && invItem.batches && typeof invItem.batches === 'object') {
                    const batchKey = item.batchId || Object.keys(invItem.batches)[0];
                    if (batchKey && invItem.batches[batchKey]) {
                        const bVal = invItem.batches[batchKey];
                        const curBStock = parseInt(bVal.currentStock ?? bVal.quantity ?? 0, 10);
                        const newBStock = Math.max(0, curBStock - qtyIssued);
                        updates[`inventory/${targetSN}/batches/${batchKey}/currentStock`] = newBStock;
                        updates[`inventory/${targetSN}/batches/${batchKey}/quantity`] = newBStock;
                    }
                }
            }

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
            const teacherSignHtml = row.teacherSign && row.teacherSign !== 'N/A' ? window.createReloadableImgHtml(row.teacherSign, "Teacher Sign", 'height: 30px; width: 60px;', true) : 'N/A';
            const issuerSignHtml = row.issuerSign && row.issuerSign !== 'N/A' ? window.createReloadableImgHtml(row.issuerSign, "Issuer Sign", 'height: 30px; width: 60px;', true) : 'N/A';

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