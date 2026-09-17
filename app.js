// Firebase SDK imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getDatabase, ref, get, child, set, push, onValue, update, remove } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-analytics.js";

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
try { getAnalytics(app); } catch (e) { console.warn("Analytics blocked"); }

// ==================== CONSTANTS ====================
const PAGE_SIZE = 10;
const IMG_RETRY_LIMIT = 3;
const IMG_RETRY_BASE_MS = 1000;

const FALLBACK_IMG = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
        <rect width="100%" height="100%" fill="#f1f5f9"/>
        <text x="50%" y="50%" font-size="14" fill="#94a3b8" text-anchor="middle" dy=".3em" font-family="sans-serif">No Image</text>
    </svg>`
);

// ==================== STATE ====================
let currentUser = null;
let cart = {};
let inventoryData = {};
let adminPad = null;
let teacherPad = null;
let activeHandoverRequestId = null;
let unsubscribeListeners = [];
let html5QrCode = null;
let ocrStream = null;
let currentOcrTarget = null; // Global target for OCR extraction

const catalogState = {
    allItems: [],
    filtered: [],
    currentPage: 1,
    searchTerm: '',
    prefetchCache: new Map(),
};

const adminInventoryState = {
    allItems: [],
    filtered: [],
    currentPage: 1,
    searchTerm: '',
};

const auditLedgerState = {
    allItems: [],
    currentPage: 1,
};

const teacherOrdersState = {
    allItems: [],
    currentPage: 1,
};

const alertedRequests = new Set();

// ==================== IMAGE UTILITIES ====================
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

window.handleImageError = function(imgElement, originalUrl) {
    let retries = parseInt(imgElement.getAttribute('data-retries') || '0');
    const maxRetries = 3;

    if (retries < maxRetries) {
        retries++;
        imgElement.setAttribute('data-retries', retries);

        // Cycle to next endpoint on each retry attempt
        const newUrl = getDirectDriveUrl(originalUrl, retries) + (originalUrl.includes('?') ? '&' : '?') + 't=' + Date.now();
        console.log(`Retrying image load (${retries}/${maxRetries}) with alternate endpoint: ${newUrl}`);

        setTimeout(() => {
            imgElement.src = newUrl;
        }, 800 * retries);
    } else {
        console.warn('Max retries reached for image:', originalUrl);
        imgElement.src = FALLBACK_IMG;
        imgElement.classList.add('img-fallback');
        imgElement.onerror = null;
    }
};

function attachSmartImage(imgEl, rawUrl) {
    const url = getDirectDriveUrl(rawUrl, 0);
    imgEl.classList.add('lazy-load');
    imgEl.setAttribute('data-retries', '0');

    imgEl.onload = () => {
        imgEl.classList.remove('lazy-load');
        imgEl.classList.add('loaded');
        imgEl.parentElement?.classList.remove('skeleton');
    };

    imgEl.onerror = () => handleImageError(imgEl, rawUrl);
    imgEl.src = url;
}

// ==================== UTILITIES ====================
function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
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

// ==================== MAIN LIFECYCLE ====================
document.addEventListener('DOMContentLoaded', () => {
    console.log("App Initialized");

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('sw.js')
                .then(reg => console.log('SW Registered'))
                .catch(err => console.log('SW Registration failed', err));
        });
    }

    const loginForm = $('login-form');
    const bypassAdminBtn = $('bypass-admin-btn');
    const logoutBtns = document.querySelectorAll('.logout-btn');
    const inventoryForm = $('add-inventory-form');
    const categorySelect = $('inv-category');
    const serialNumberInput = $('inv-serial-number');
    const cartBtn = $('cart-btn');
    const closeCartBtn = $('close-cart-btn');
    const submitRequisitionBtn = $('submit-requisition-btn');
    const stationerySearch = $('stationery-search');
    const adminInventorySearch = $('admin-inventory-search');
    const exportInventoryBtn = $('export-inventory-btn');
    const exportHistoryBtn = $('export-history-btn');
    const exportAuditBtn = $('export-audit-ledger-btn');
    const closeNotificationBtn = $('close-notification-btn');
    const closeHandoverModalBtn = $('close-handover-modal-btn');
    const completeOrderBtn = $('complete-order-btn');
    const closeOrderDetailBtn = $('close-order-detail-btn');
    const closeItemDetailBtn = $('close-item-detail-btn');
    const startScanBtn = $('start-scan-btn');
    const closeScannerBtn = $('close-scanner-btn');

    // --- OCR Elements ---
    const ocrTriggerBtns = document.querySelectorAll('.btn-ocr-trigger');
    const ocrSnapBtn = $('ocr-snap-btn');
    const closeOcrBtn = $('close-ocr-btn');

    // --- Drawer Logic ---
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

    const drawerItems = document.querySelectorAll('.drawer-item[data-target]');
    drawerItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetId = item.dataset.target;
            drawerItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            const adminTabs = document.querySelectorAll('.admin-tab');
            adminTabs.forEach(tab => tab.classList.remove('active'));
            const targetTab = $(targetId);
            if (targetTab) targetTab.classList.add('active');
            toggleDrawer(false);
        });
    });

    $('drawer-cart-btn')?.addEventListener('click', () => {
        toggleDrawer(false);
        $('cart-modal').classList.add('active');
        renderCart();
    });

    $('drawer-history-btn')?.addEventListener('click', () => {
        toggleDrawer(false);
        window.scrollTo({
            top: $('teacher-history-area').offsetTop - 100,
            behavior: 'smooth'
        });
    });

    [$('logout-btn-admin'), $('logout-btn-teacher'), ...logoutBtns].forEach(btn => {
        btn?.addEventListener('click', () => {
            toggleDrawer(false);
            cleanupListeners();
            localStorage.removeItem('stationery_user_adec');
            currentUser = null;
            cart = {};
            updateCartBadge();
            catalogState.allItems = [];
            catalogState.filtered = [];
            catalogState.currentPage = 1;
            catalogState.searchTerm = '';
            showView('login-view');
        });
    });

    // --- Tab Navigation ---
    const adminNavButtons = document.querySelectorAll('.admin-nav button[data-target]');
    adminNavButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.dataset.target;
            adminNavButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const adminTabs = document.querySelectorAll('.admin-tab');
            adminTabs.forEach(tab => tab.classList.remove('active'));
            const targetTab = document.getElementById(targetId);
            if (targetTab) targetTab.classList.add('active');
        });
    });

    // --- Google Drive Connector ---
    const appsScriptInput = $('apps-script-url');
    const saveAppsScriptBtn = $('save-apps-script-url');
    if (appsScriptInput) appsScriptInput.value = localStorage.getItem('google_apps_script_url') || '';
    if (saveAppsScriptBtn) {
        saveAppsScriptBtn.addEventListener('click', () => {
            const url = appsScriptInput.value.trim();
            if (!url) return showToast("Please enter a valid URL", 'error');
            localStorage.setItem('google_apps_script_url', url);
            showToast("Google Apps Script URL saved!");
            updateDriveStatus();
        });
    }

    // --- Authentication ---
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const rawAdecNumber = $('adec-number').value.trim();
            const password = $('password').value.trim();
            const loginError = $('login-error');
            const loginBtn = $('login-btn');
            if (!rawAdecNumber || !password) return;
            loginBtn.disabled = true;
            loginBtn.textContent = "Authenticating...";
            try {
                const snapshot = await get(ref(db, 'users'));
                if (snapshot.exists()) {
                    const users = snapshot.val();
                    const matchedKey = Object.keys(users).find(key => key.toLowerCase() === rawAdecNumber.toLowerCase());
                    if (matchedKey) {
                        const userData = users[matchedKey];
                        if (userData.password === password) {
                            localStorage.setItem('stationery_user_adec', matchedKey);
                            handleUserRole(matchedKey);
                            if (loginError) loginError.textContent = "";
                        } else {
                            if (loginError) loginError.textContent = "Incorrect Password.";
                            showToast("Incorrect Password", "error");
                        }
                    } else {
                        if (loginError) loginError.textContent = "ADEK Pass Number not found.";
                        showToast("Account not found", "error");
                    }
                } else {
                    if (loginError) loginError.textContent = "Database error: No users found.";
                }
            } catch (err) {
                console.error(err);
                if (loginError) loginError.textContent = "Connection failed.";
            } finally {
                loginBtn.disabled = false;
                loginBtn.textContent = "Login";
            }
        });
    }

    if (bypassAdminBtn) {
        bypassAdminBtn.addEventListener('click', () => {
            currentUser = { uid: "bypass_admin", name: "System Developer", role: "DEVELOPER" };
            showView('developer-dashboard');
            fetchAuditLogs();
            fetchSystemBranding();
            fetchCategories();
        });
    }

    const savedAdec = localStorage.getItem('stationery_user_adec');
    if (savedAdec) handleUserRole(savedAdec);
    else showView('login-view');

    // --- Forms ---
    if (inventoryForm) inventoryForm.addEventListener('submit', saveInventoryItem);
    if (categorySelect) {
        categorySelect.addEventListener('change', () => {
            const customGroup = $('custom-category-group');
            if (customGroup) customGroup.style.display = categorySelect.value === 'Other' ? 'block' : 'none';
        });
    }
    if (serialNumberInput) {
        serialNumberInput.addEventListener('input', () => {
            const serial = serialNumberInput.value.trim();
            if (serial) {
                try { JsBarcode("#barcode", serial, { format: "CODE128", displayValue: true, fontSize: 16 }); } catch (e) { }
            } else $('barcode').innerHTML = '';
        });
    }

    if (cartBtn) cartBtn.addEventListener('click', () => { $('cart-modal').classList.add('active'); renderCart(); });
    if (closeCartBtn) closeCartBtn.addEventListener('click', () => $('cart-modal').classList.remove('active'));
    if (submitRequisitionBtn) submitRequisitionBtn.addEventListener('click', submitRequisitionRequest);

    if (stationerySearch) {
        let t;
        stationerySearch.addEventListener('input', (e) => {
            clearTimeout(t);
            t = setTimeout(() => {
                catalogState.searchTerm = e.target.value.toLowerCase().trim();
                catalogState.currentPage = 1;
                resetCatalog();
            }, 250);
        });
    }
    if (adminInventorySearch) {
        adminInventorySearch.addEventListener('input', (e) => {
            adminInventoryState.searchTerm = e.target.value.toLowerCase().trim();
            adminInventoryState.currentPage = 1;
            renderMasterInventory();
        });
    }

    if (closeNotificationBtn) closeNotificationBtn.addEventListener('click', () => $('notification-modal').classList.remove('active'));
    if (closeHandoverModalBtn) closeHandoverModalBtn.addEventListener('click', () => $('handover-modal').classList.remove('active'));
    if (completeOrderBtn) completeOrderBtn.addEventListener('click', completeHandoverAction);
    if (closeOrderDetailBtn) closeOrderDetailBtn.addEventListener('click', () => $('order-detail-modal').classList.remove('active'));
    if (closeItemDetailBtn) closeItemDetailBtn.addEventListener('click', () => $('item-detail-modal').classList.remove('active'));

    if (startScanBtn) startScanBtn.addEventListener('click', () => { $('qr-scanner-modal').classList.add('active'); initScanner(); });
    if (closeScannerBtn) closeScannerBtn.addEventListener('click', stopScanner);

    ocrTriggerBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            currentOcrTarget = btn.dataset.target;
            $('ocr-scanner-modal').classList.add('active');
            startOcrCamera();
        });
    });
    if (ocrSnapBtn) ocrSnapBtn.addEventListener('click', captureAndRecognize);
    if (closeOcrBtn) closeOcrBtn.addEventListener('click', stopOcrCamera);

    if (exportInventoryBtn) exportInventoryBtn.addEventListener('click', exportInventory);
    if (exportHistoryBtn) exportHistoryBtn.addEventListener('click', exportHistory);
    if (exportAuditBtn) exportAuditBtn.addEventListener('click', exportAuditLedger);

    $('upload-branding-btn')?.addEventListener('click', () => {
        const file = $('branding-logo-upload').files[0];
        if (file) uploadLogo(file);
    });
    $('add-category-btn')?.addEventListener('click', () => {
        const name = $('new-category-name').value.trim();
        if (name) addCategory(name);
    });

    adminPad = setupSignaturePad('admin-canvas');
    teacherPad = setupSignaturePad('teacher-canvas');
    $('clear-admin-sig-btn')?.addEventListener('click', () => adminPad?.clear());
    $('clear-teacher-sig-btn')?.addEventListener('click', () => teacherPad?.clear());

    const btnShowProvision = $('btn-show-provision');
    const btnShowDirectory = $('btn-show-directory');
    const provisionView = $('staff-provision-view');
    const directoryView = $('staff-list-view');
    if (btnShowProvision && btnShowDirectory) {
        btnShowProvision.addEventListener('click', () => {
            btnShowProvision.classList.add('active'); btnShowDirectory.classList.remove('active');
            provisionView.style.display = 'block'; directoryView.style.display = 'none';
        });
        btnShowDirectory.addEventListener('click', () => {
            btnShowDirectory.classList.add('active'); btnShowProvision.classList.remove('active');
            provisionView.style.display = 'none'; directoryView.style.display = 'block';
        });
    }

    const devCreateAccountForm = $('dev-create-account-form');
    if (devCreateAccountForm) {
        devCreateAccountForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = $('dev-name').value.trim();
            const adec = $('dev-adec-number').value.trim();
            const pass = $('dev-password').value;
            const role = $('dev-role').value;
            if (!name || !adec || !pass || !role) return;
            try {
                await set(ref(db, 'users/' + adec), { name, adecPassNumber: adec, password: pass, role, createdAt: new Date().toISOString() });
                showToast("Account created!");
                devCreateAccountForm.reset();
            } catch (err) { showToast(err.message, "error"); }
        });
    }

    const adminCreateTeacherForm = $('admin-create-teacher-form');
    if (adminCreateTeacherForm) {
        adminCreateTeacherForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = $('admin-name').value.trim();
            const adec = $('admin-adec-number').value.trim();
            const pass = $('admin-password').value;
            if (!name || !adec || !pass) return;
            try {
                await set(ref(db, 'users/' + adec), { name, adecPassNumber: adec, password: pass, role: 'TEACHER', createdAt: new Date().toISOString() });
                showToast("Teacher account created!");
                adminCreateTeacherForm.reset();
            } catch (err) { showToast(err.message, "error"); }
        });
    }
});

// ==================== NOTIFICATIONS ====================
function listenForNewOrders() {
    addListener(ref(db, 'orders'), (snapshot) => {
        const data = snapshot.val() || {};
        const pendingCount = Object.values(data).filter(o => o.status === 'Pending Approval').length;
        const badge = $('notif-badge');
        if (badge) { badge.textContent = pendingCount; badge.style.display = pendingCount > 0 ? 'flex' : 'none'; }
        Object.entries(data).forEach(([id, order]) => {
            if (order.status === 'Pending Approval' && !alertedRequests.has(id)) {
                alertedRequests.add(id);
                if (Notification.permission === "granted") {
                    new Notification("New Requisition Request", { body: `From: ${order.teacherName}`, icon: 'school.png' });
                }
            }
        });
    });
}

// ==================== SCANNER / OCR ====================
async function initScanner() {
    if (!html5QrCode) html5QrCode = new Html5Qrcode("reader");
    const config = { fps: 10, qrbox: { width: 250, height: 150 }, aspectRatio: 1.0 };
    try {
        await html5QrCode.start({ facingMode: "environment" }, config, (decodedText) => {
            const input = $('inv-serial-number');
            if (input) { input.value = decodedText; input.dispatchEvent(new Event('input')); }
            showToast("Code Scanned!", "success");
            stopScanner();
        }, () => { });
    } catch (err) { showToast("Camera error", "error"); stopScanner(); }
}

async function stopScanner() {
    $('qr-scanner-modal').classList.remove('active');
    if (html5QrCode && html5QrCode.isScanning) { try { await html5QrCode.stop(); } catch (e) { } }
}

async function startOcrCamera() {
    const video = $('ocr-video');
    try {
        if (ocrStream) stopOcrCamera();
        ocrStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } } });
        if (video) { video.srcObject = ocrStream; await video.play(); }
    } catch (err) { showToast("Camera error", "error"); stopOcrCamera(); }
}

function stopOcrCamera() {
    if (ocrStream) { ocrStream.getTracks().forEach(track => track.stop()); ocrStream = null; }
    const video = $('ocr-video'); if (video) video.srcObject = null;
    $('ocr-loader').style.display = 'none';
    $('ocr-scanner-modal').classList.remove('active');
}

function preprocessCanvasForOcr(canvas) {
    const ctx = canvas.getContext('2d');
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;

    for (let i = 0; i < data.length; i += 4) {
        // Grayscale average
        const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
        // High-contrast binarization threshold
        const threshold = avg > 115 ? 255 : 0;
        data[i] = threshold;     // Red
        data[i + 1] = threshold; // Green
        data[i + 2] = threshold; // Blue
    }
    ctx.putImageData(imgData, 0, 0);
    return canvas;
}

async function captureAndRecognize() {
    const video = $('ocr-video');
    const canvas = $('ocr-canvas');
    const loader = $('ocr-loader');
    if (!video || !video.srcObject) return;
    if (!currentOcrTarget) { showToast("No target input designated for OCR auto-fill.", "error"); return; }

    // Capture Frame
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);

    // Apply High-Contrast Pre-processing
    preprocessCanvasForOcr(canvas);

    // UI Loading State
    loader.style.display = 'flex';
    $('ocr-status-text').textContent = "Scanning & Reading Text...";

    try {
        // Create specialized worker for high-precision alphanumeric reading
        const worker = await Tesseract.createWorker('eng');
        await worker.setParameters({
            tessedit_char_whitelist: '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ@#$-_./&()%+= ',
            preserve_interword_spaces: '1',
            tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT_OR_LINE
        });

        const result = await worker.recognize(canvas);
        const rawText = result.data.text
            .replace(/[\r\n]+/g, ' ')  // Replace line breaks with single space
            .replace(/\s+/g, ' ')      // Clean multiple spaces to single space
            .trim();

        await worker.terminate();

        const inputEl = document.getElementById(currentOcrTarget);
        if (inputEl && rawText.length > 0) {
            inputEl.value = rawText;
            inputEl.dispatchEvent(new Event('input'));
            alert(`Exact Text Captured: "${rawText}"`);
        } else {
            alert("Unable to read text clearly. Please adjust camera focus or lighting.");
        }

        stopOcrCamera();
    } catch (err) {
        console.error("OCR Error:", err);
        showToast("OCR Processing Failed", "error");
        loader.style.display = 'none';
    }
}

// ==================== ROLE / DASHBOARD ====================
async function handleUserRole(adecNumber) {
    try {
        const snapshot = await get(child(ref(db), `users/${adecNumber}`));
        if (snapshot.exists()) {
            const userData = snapshot.val();
            currentUser = { uid: adecNumber, ...userData };
            fetchSystemBranding();
            fetchCategories();
            $('admin-menu').style.display = userData.role === 'ADMIN' ? 'flex' : 'none';
            $('teacher-menu').style.display = userData.role === 'TEACHER' ? 'flex' : 'none';
            if ("Notification" in window) Notification.requestPermission();
            if (userData.role === 'DEVELOPER') {
                showView('developer-dashboard'); fetchAuditLogs();
            } else if (userData.role === 'ADMIN') {
                showView('admin-dashboard'); initAdminDashboards(); listenForNewOrders();
            } else if (userData.role === 'TEACHER') {
                showView('teacher-dashboard'); fetchInventory(); fetchTeacherOrderHistory(adecNumber);
            }
        } else { localStorage.removeItem('stationery_user_adec'); showView('login-view'); }
    } catch (e) { }
}

function showView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const target = $(viewId); if (target) target.classList.add('active');
    window.scrollTo(0, 0);
}

async function logActivity(action, details) {
    const user = currentUser ? (currentUser.name || currentUser.adecPassNumber) : "System";
    try { await push(ref(db, 'audit_logs'), { timestamp: new Date().toISOString(), user, action, details }); } catch (e) { }
}

function initAdminDashboards() {
    try { fetchAdminOrders(); } catch (e) { }
    try { fetchMasterInventory(); } catch (e) { }
    try { fetchOrderHistoryForAnalytics(); } catch (e) { }
    try { fetchStaffList(); } catch (e) { }
    try { updateDriveStatus(); } catch (e) { }
    try { fetchAuditLedger(); } catch (e) { }
}

// ==================== CATALOG ====================
function fetchInventory() {
    addListener(ref(db, 'inventory'), (snapshot) => {
        const data = snapshot.val() || {};
        inventoryData = data;
        catalogState.allItems = Object.entries(data).map(([id, d]) => ({ id, data: d }));
        resetCatalog();
    });
}

function resetCatalog() {
    const term = catalogState.searchTerm;
    catalogState.filtered = term
        ? catalogState.allItems.filter(({ data }) => (data.itemName || '').toLowerCase().includes(term) || (data.serialNumber || '').toLowerCase().includes(term))
        : catalogState.allItems.slice();
    renderCatalogPage();
}

function renderCatalogPage() {
    const list = $('stationery-list'); if (!list) return;
    list.innerHTML = '';
    const start = (catalogState.currentPage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const pageItems = catalogState.filtered.slice(start, end);
    if (pageItems.length === 0) { list.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#64748b;padding:30px;">No items found.</p>'; return; }
    pageItems.forEach(({ id, data }) => {
        const card = document.createElement('div'); card.className = 'inventory-card';
        card.innerHTML = `<div class="card-img-wrap skeleton"><img alt="" loading="lazy"></div><div class="card-body"><h3 class="card-title">${escapeHtml(data.itemName)}</h3><p class="serial">SN: ${escapeHtml(data.serialNumber || 'N/A')}</p><p class="description">${escapeHtml(data.description || '')}</p><button class="add-to-cart-btn">View Details</button></div>`;
        attachSmartImage(card.querySelector('img'), data.imageUrl);
        card.onclick = (e) => { if (e.target.tagName !== 'BUTTON') showItemDetail(id, data); };
        card.querySelector('button').onclick = () => showItemDetail(id, data);
        list.appendChild(card);
    });
    renderPaginationControls('stationery-list', catalogState, renderCatalogPage);
}

function renderPaginationControls(containerId, state, renderFn) {
    const targetElement = $(containerId); if (!targetElement) return;
    let wrap = $(`${containerId}-pagination-wrap`);
    if (!wrap) {
        wrap = document.createElement('div'); wrap.id = `${containerId}-pagination-wrap`; wrap.className = 'catalog-pagination';
        targetElement.parentNode.insertBefore(wrap, targetElement.nextSibling);
    }
    const totalPages = Math.ceil(state.filtered.length / PAGE_SIZE) || 1;
    if (state.currentPage > totalPages) state.currentPage = totalPages;
    wrap.innerHTML = `<button class="page-btn prev" ${state.currentPage === 1 ? 'disabled' : ''}>Prev</button><span class="page-info">Page <strong>${state.currentPage}</strong> of <strong>${totalPages}</strong></span><button class="page-btn next" ${state.currentPage >= totalPages ? 'disabled' : ''}>Next</button>`;
    wrap.querySelector('.prev').onclick = () => { state.currentPage--; renderFn(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    wrap.querySelector('.next').onclick = () => { state.currentPage++; renderFn(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
}

function showItemDetail(id, data) {
    const content = $('item-detail-content');
    const isOut = (parseInt(data.quantity) || 0) <= 0;
    content.innerHTML = `<img class="item-detail-img" src="${FALLBACK_IMG}"><div class="item-detail-info"><span class="badge bg-info">${escapeHtml(data.category || 'General')}</span><h3>${escapeHtml(data.itemName)}</h3><p><strong>SN:</strong> ${escapeHtml(data.serialNumber)}</p><div class="item-detail-desc">${escapeHtml(data.description)}</div><div class="item-detail-footer"><input type="number" id="detail-qty" value="1" min="1" max="${data.quantity}" style="width:70px; padding:8px; border-radius:6px; border:1px solid #ddd;"><button id="detail-add-btn" class="primary-btn green" style="flex:1;" ${isOut ? 'disabled' : ''}>${isOut ? 'Out of Stock' : 'Add to Cart'}</button></div></div>`;
    attachSmartImage(content.querySelector('img'), data.imageUrl);
    $('detail-add-btn').onclick = () => { addToCart(id, data, parseInt($('detail-qty').value) || 1); $('item-detail-modal').classList.remove('active'); };
    $('item-detail-modal').classList.add('active');
}

// ==================== MASTER INVENTORY ====================
function fetchMasterInventory() {
    addListener(ref(db, 'inventory'), (snapshot) => {
        const data = snapshot.val() || {};
        inventoryData = data;
        adminInventoryState.allItems = Object.values(data);
        renderMasterInventory();
    });
}

function renderMasterInventory() {
    const list = $('master-inventory-list'); if (!list) return;
    const term = adminInventoryState.searchTerm;
    adminInventoryState.filtered = term ? adminInventoryState.allItems.filter(i => (i.itemName || '').toLowerCase().includes(term) || (i.serialNumber || '').toLowerCase().includes(term)) : adminInventoryState.allItems.slice();
    list.innerHTML = '';
    const start = (adminInventoryState.currentPage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const pageItems = adminInventoryState.filtered.slice(start, end);
    if (pageItems.length === 0) { list.innerHTML = '<tr><td colspan="7" style="text-align:center;">No items.</td></tr>'; return; }
    pageItems.forEach(item => {
        const tr = document.createElement('tr'); const qty = parseInt(item.quantity) || 0;
        if (qty < 5) tr.className = 'row-low-stock';
        tr.innerHTML = `<td>${escapeHtml(item.serialNumber)}</td><td>${escapeHtml(item.itemName)}</td><td>${escapeHtml(item.description)}</td><td>${item.openingQuantity || 0}</td><td>${qty} ${qty < 5 ? '<span class="badge-low-stock">Low</span>' : ''}</td><td><img class="inventory-thumb"></td><td><span class="badge ${qty > 0 ? 'bg-success' : 'bg-secondary'}">${qty > 0 ? 'In Stock' : 'Out'}</span></td>`;
        attachSmartImage(tr.querySelector('img'), item.imageUrl);
        list.appendChild(tr);
    });
    renderPaginationControls('admin-inventory-pagination', adminInventoryState, renderMasterInventory);
}

// ==================== ANALYTICS & LEDGER ====================
function fetchOrderHistoryForAnalytics() {
    addListener(ref(db, 'orders'), (snap) => {
        const container = $('analytics-cards'); if (!container) return;
        const data = snap.val() || {}; const entries = Object.values(data);
        let total = entries.length, p = 0, a = 0, d = 0; const stats = {};
        entries.forEach(o => {
            if (o.status === 'Pending Approval') p++; else if (o.status === 'Approved') a++; else if (o.status === 'Handover Complete / Done') d++;
            const name = o.teacherName || 'Staff'; const units = (o.items || []).reduce((s, i) => s + (parseInt(i.requestQuantity) || 0), 0);
            stats[name] = (stats[name] || 0) + units;
        });
        container.innerHTML = `<div class="analytics-card"><h4>Total Orders</h4><div class="total-items">${total}</div><p>Lifetime</p></div><div class="analytics-card"><h4>Pipeline</h4><div class="total-items" style="font-size:16px; margin-top:8px;"><span style="color:#f1c40f;">${p}P</span> | <span style="color:#3498db;">${a}A</span> | <span style="color:#27ae60;">${d}D</span></div><p>P/A/D Status</p></div>`;
        Object.entries(stats).sort((a, b) => b[1] - a[1]).slice(0, 2).forEach(([name, count]) => {
            const card = document.createElement('div'); card.className = 'analytics-card';
            card.innerHTML = `<h4>${escapeHtml(name)}</h4><div class="total-items">${count}</div><p>Units Issued</p>`;
            container.appendChild(card);
        });
    });
}

function fetchAuditLedger() {
    addListener(ref(db, 'orders'), (snap) => {
        const data = snap.val() || {}; const ledgerData = [];
        Object.entries(data).reverse().forEach(([id, order]) => {
            (order.items || []).forEach(item => {
                ledgerData.push({ orderId: id, timestamp: order.timestamp, teacher: `${order.teacherName} (${order.teacherUid})`, item: `${item.itemName} (${item.serial})`, qty: item.requestQuantity, status: order.status });
            });
        });
        auditLedgerState.allItems = ledgerData; renderAuditLedger();
    });
}

function renderAuditLedger() {
    const list = $('admin-audit-ledger-list'); if (!list) return;
    list.innerHTML = '';
    const start = (auditLedgerState.currentPage - 1) * PAGE_SIZE; const end = start + PAGE_SIZE;
    const pageItems = auditLedgerState.allItems.slice(start, end);
    if (pageItems.length === 0) { list.innerHTML = '<tr><td colspan="6" style="text-align:center;">No movements.</td></tr>'; return; }
    pageItems.forEach(row => {
        const tr = document.createElement('tr');
        const serial = row.item.match(/\((.*?)\)/)?.[1];
        let balance = 'N/A'; if (serial) { const it = Object.values(inventoryData).find(i => i.serialNumber === serial); if (it) balance = it.quantity; }
        const statusBadge = row.status === 'Pending Approval' ? 'bg-warning' : row.status === 'Approved' ? 'bg-info' : 'bg-success';
        tr.innerHTML = `<td>${new Date(row.timestamp).toLocaleString()}</td><td>${escapeHtml(row.teacher)}</td><td>${escapeHtml(row.item)}</td><td><strong>${row.qty}</strong></td><td>${balance}</td><td><span class="badge ${statusBadge}">${row.status}</span></td>`;
        list.appendChild(tr);
    });
    renderPaginationControls('admin-audit-pagination', auditLedgerState, renderAuditLedger);
}

async function exportAuditLedger() {
    const data = auditLedgerState.allItems.map(row => {
        const serial = row.item.match(/\((.*?)\)/)?.[1];
        let balance = 'N/A'; if (serial) { const it = Object.values(inventoryData).find(i => i.serialNumber === serial); if (it) balance = it.quantity; }
        return { 'Date & Time': new Date(row.timestamp).toLocaleString(), 'Teacher (ADEK)': row.teacher, 'Item (Serial)': row.item, 'Qty Issued': row.qty, 'Stock Balance': balance, 'Status': row.status };
    });
    const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Audit"); XLSX.writeFile(wb, `Audit_${Date.now()}.xlsx`);
}

// ==================== CART / ORDERS ====================
function addToCart(id, data, customQty = 1) {
    const stock = parseInt(data.quantity) || 0;
    if (cart[id]) {
        if (cart[id].requestQuantity + customQty <= stock) { cart[id].requestQuantity += customQty; showToast("Updated"); } else showToast("No stock", 'error');
    } else { cart[id] = { ...data, requestQuantity: customQty }; showToast("Added"); }
    updateCartBadge();
}

function updateCartBadge() {
    const count = Object.values(cart).reduce((sum, item) => sum + item.requestQuantity, 0);
    if ($('cart-count')) $('cart-count').textContent = count;
}

function renderCart() {
    const container = $('cart-items'); if (!container) return;
    container.innerHTML = ''; const items = Object.entries(cart);
    if (items.length === 0) { container.innerHTML = '<p style="text-align:center;color:#64748b;padding:20px;">Empty</p>'; return; }
    items.forEach(([id, item]) => {
        const div = document.createElement('div'); div.className = 'cart-item';
        div.innerHTML = `<div class="cart-item-info"><strong>${escapeHtml(item.itemName)}</strong><small>SN: ${item.serialNumber}</small></div><div class="cart-item-controls"><input type="number" class="qty-input" data-id="${id}" value="${item.requestQuantity}" min="1" max="${item.quantity}"><button class="remove-item-btn" data-id="${id}">🗑️</button></div>`;
        container.appendChild(div);
    });
    container.querySelectorAll('.qty-input').forEach(inp => inp.onchange = (e) => {
        const it = cart[inp.dataset.id]; if (!it) return;
        let v = parseInt(e.target.value) || 1; if (v > it.quantity) v = it.quantity; it.requestQuantity = v; updateCartBadge();
    });
    container.querySelectorAll('.remove-item-btn').forEach(btn => btn.onclick = () => { delete cart[btn.dataset.id]; renderCart(); updateCartBadge(); });
}

async function submitRequisitionRequest() {
    if (Object.keys(cart).length === 0) return showToast("Empty", 'error');
    const orderId = 'JYS-' + Math.floor(10000 + Math.random() * 90000);
    try {
        const items = Object.entries(cart).map(([id, item]) => ({ itemId: id, itemName: item.itemName, serial: item.serialNumber, requestQuantity: item.requestQuantity, imageUrl: item.imageUrl }));
        await set(ref(db, 'orders/' + orderId), { orderId, teacherUid: currentUser.adecPassNumber || currentUser.uid, teacherName: currentUser.name, timestamp: new Date().toISOString(), items, status: 'Pending Approval' });
        cart = {}; updateCartBadge(); $('cart-modal').classList.remove('active'); showToast(`Submitted ${orderId}`);
    } catch (e) { showToast("Error", 'error'); }
}

// ==================== LIVE ORDERS (ADMIN) ====================
function fetchAdminOrders() {
    addListener(ref(db, 'orders'), (snapshot) => {
        const list = $('admin-requests-list'); const historyList = $('admin-history-list'); if (!list || !historyList) return;
        list.innerHTML = ''; historyList.innerHTML = '';
        const orders = Object.entries(snapshot.val() || {}).reverse();
        orders.forEach(([id, order]) => {
            if (order.status === 'Handover Complete / Done') {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${id}</td><td>${escapeHtml(order.teacherName)}</td><td>${new Date(order.timestamp).toLocaleDateString()}</td><td><div class="it-wrap" style="display:flex;gap:4px;"></div></td><td><span class="badge bg-success">Done</span></td><td><button class="view-details-btn">View</button></td>`;
                const wrap = tr.querySelector('.it-wrap'); (order.items || []).slice(0, 3).forEach(it => { const img = document.createElement('img'); img.className = 'inventory-thumb'; wrap.appendChild(img); attachSmartImage(img, it.imageUrl); });
                tr.querySelector('button').onclick = () => viewOrderDetails(id);
                historyList.appendChild(tr);
            } else {
                const card = document.createElement('div'); card.className = `request-card ${order.status === 'Pending Approval' ? 'pending' : 'approved'}`;
                card.innerHTML = `<div class="request-header"><h4>${escapeHtml(order.teacherName)}</h4><span class="badge ${order.status === 'Pending Approval' ? 'bg-warning' : 'bg-info'}">${order.status}</span></div><div class="request-items" style="display:flex;gap:10px;padding:10px 0;"></div><div class="request-actions">${order.status === 'Pending Approval' ? `<button class="action-btn prepare-btn" style="flex:1;">Approve</button>` : ''}<button class="action-btn handover-btn" style="flex:1;">${order.status === 'Approved' ? 'Complete Handover & Sign' : 'Force Handover'}</button></div>`;
                const wrap = card.querySelector('.request-items'); (order.items || []).forEach(it => { const d = document.createElement('div'); d.className = 'req-item-mini'; d.innerHTML = `<img class="inventory-thumb" width="40" height="40"><br><small>x${it.requestQuantity}</small>`; wrap.appendChild(d); attachSmartImage(d.querySelector('img'), it.imageUrl); });
                card.querySelector('.prepare-btn')?.addEventListener('click', () => updateOrderStatus(id, 'Approved'));
                card.querySelector('.handover-btn').onclick = () => { activeHandoverRequestId = id; adminPad?.clear(); teacherPad?.clear(); $('handover-modal').classList.add('active'); };
                list.appendChild(card);
            }
        });
    });
}

async function updateOrderStatus(id, status) {
    try { await update(ref(db, `orders/${id}`), { status }); showToast(`Status: ${status}`); } catch (e) { }
}

function fetchTeacherOrderHistory(adec) {
    addListener(ref(db, 'orders'), (snap) => {
        const data = snap.val() || {}; const entries = Object.entries(data).reverse();
        teacherOrdersState.allItems = entries.filter(([id, o]) => o.teacherUid === adec); renderTeacherOrderHistory();
    });
}

function renderTeacherOrderHistory() {
    const list = $('teacher-history-list'); const cards = $('teacher-history-cards'); if (!list || !cards) return;
    list.innerHTML = ''; cards.innerHTML = '';
    const start = (teacherOrdersState.currentPage - 1) * PAGE_SIZE; const end = start + PAGE_SIZE;
    const pageItems = teacherOrdersState.allItems.slice(start, end);
    if (pageItems.length === 0) { list.innerHTML = '<tr><td colspan="5" style="text-align:center;">No history</td></tr>'; cards.innerHTML = '<p style="text-align:center; padding:20px; color:#64748b;">No orders placed yet.</p>'; return; }
    pageItems.forEach(([id, order]) => {
        const dateStr = new Date(order.timestamp).toLocaleDateString();
        const statusBadge = order.status === 'Pending Approval' ? 'bg-warning' : order.status === 'Approved' ? 'bg-info' : 'bg-success';
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${id}</td><td>${dateStr}</td><td><div class="it-wrap" style="display:flex;gap:4px;"></div></td><td><span class="badge ${statusBadge}">${order.status}</span></td><td><button class="view-details-btn">View</button></td>`;
        const trWrap = tr.querySelector('.it-wrap'); (order.items || []).slice(0, 3).forEach(it => { const img = document.createElement('img'); img.className='inventory-thumb'; trWrap.appendChild(img); attachSmartImage(img, it.imageUrl); });
        tr.querySelector('button').onclick = () => viewOrderDetails(id);
        list.appendChild(tr);

        const card = document.createElement('div'); card.className = 'order-mobile-card';
        card.innerHTML = `<div class="omc-header"><span class="omc-id">${id}</span><span class="badge ${statusBadge}">${order.status}</span></div><div class="omc-body"><div class="omc-items"></div><div class="omc-info"><p><strong>Date:</strong> ${dateStr}</p><p><strong>Items:</strong> ${order.items?.length || 0}</p></div></div><button class="primary-btn blue omc-view-btn">View Details</button>`;
        const cardItemsWrap = card.querySelector('.omc-items'); (order.items || []).slice(0, 3).forEach(it => { const img = document.createElement('img'); img.className='inventory-thumb'; cardItemsWrap.appendChild(img); attachSmartImage(img, it.imageUrl); });
        card.querySelector('.omc-view-btn').onclick = () => viewOrderDetails(id);
        cards.appendChild(card);
    });
    renderPaginationControls('teacher-orders-pagination', teacherOrdersState, renderTeacherOrderHistory);
}

async function viewOrderDetails(id) {
    const snap = await get(ref(db, `orders/${id}`)); const order = snap.val();
    const content = $('order-detail-content');
    content.innerHTML = `<div style="text-align:center;margin-bottom:15px;"><h3>Requisition Receipt</h3><p>ID: ${id}</p></div><p><strong>Staff:</strong> ${escapeHtml(order.teacherName)} (${order.teacherUid})</p><table class="history-table" style="margin:15px 0;"><thead><tr><th>Item</th><th>Qty</th></tr></thead><tbody>${order.items.map(i => `<tr><td>${escapeHtml(i.itemName)}</td><td>${i.requestQuantity}</td></tr>`).join('')}</tbody></table>${order.signatures ? `<div class="order-detail-signatures"><div class="signature-display-box"><small>Admin</small><br><img src="${order.signatures.admin}"></div><div class="signature-display-box"><small>Staff</small><br><img src="${order.signatures.teacher}"></div></div>` : ''}`;
    $('order-detail-modal').classList.add('active');
}

async function completeHandoverAction() {
    if (adminPad.isEmpty() || teacherPad.isEmpty()) return showToast("Signatures required", 'error');
    const btn = $('complete-order-btn'); btn.disabled = true;
    try {
        const snap = await get(ref(db, `orders/${activeHandoverRequestId}`));
        const data = snap.val();
        for (const item of data.items) {
            const qtyRef = ref(db, `inventory/${item.itemId}/quantity`);
            const curr = (await get(qtyRef)).val() || 0;
            await set(qtyRef, Math.max(0, curr - item.requestQuantity));
        }
        const sigs = { admin: adminPad.getDataUrl(), teacher: teacherPad.getDataUrl(), completedAt: new Date().toISOString() };
        await update(ref(db, `orders/${activeHandoverRequestId}`), { status: 'Handover Complete / Done', signatures: sigs });
        $('handover-modal').classList.remove('active'); showToast("Handover Complete!");
    } catch (e) { } finally { btn.disabled = false; }
}

// ==================== SYSTEM / STAFF / DRIVE ====================
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
    const url = localStorage.getItem('google_apps_script_url'); if (!url) return;
    try {
        const res = await fetch(url, { method: 'POST', body: JSON.stringify({ action: 'status' }) });
        const result = await res.json();
        if (result.status === 'success') {
            $('drive-connection-indicator').innerHTML = '<span style="color:#10b981;">🟢 Connected (Active)</span>';
            $('drive-storage-text').textContent = `${result.storageUsed || result.used || '0 MB'} / ${result.total || '15 GB'} Used`;
            $('drive-storage-bar').style.width = result.percent || '0%';
        }
    } catch (e) { }
}

function fetchSystemBranding() { addListener(ref(db, 'settings/logo'), (snap) => { if (snap.val()) document.querySelectorAll('#school-logo').forEach(img => img.src = snap.val()); }); }

function fetchCategories() {
    addListener(ref(db, 'settings/categories'), (snap) => {
        const data = snap.val() || {}; const select = $('inv-category');
        if (select) {
            select.innerHTML = '<option value="" disabled selected>Select Category</option>';
            Object.values(data).forEach(name => { const opt = document.createElement('option'); opt.value = name; opt.textContent = name; select.appendChild(opt); });
            select.innerHTML += '<option value="Other">Other (Custom)</option>';
        }
        const list = $('system-categories-list');
        if (list) {
            list.innerHTML = '';
            Object.entries(data).forEach(([key, name]) => {
                const li = document.createElement('li'); li.className = 'category-item';
                li.innerHTML = `<span>${escapeHtml(name)}</span><button class="delete-cat-btn">Delete</button>`;
                li.querySelector('button').onclick = async () => { if(confirm("Delete?")) await set(ref(db, `settings/categories/${key}`), null); };
                list.appendChild(li);
            });
        }
    });
}

async function uploadLogo(file) {
    const reader = new FileReader(); const base = await new Promise((res) => { reader.onload = () => res(reader.result); reader.readAsDataURL(file); });
    await set(ref(db, 'settings/logo'), base); showToast("Logo Updated!");
}

async function addCategory(name) { await push(ref(db, 'settings/categories'), name); $('new-category-name').value = ''; showToast("Added!"); }

function setupSignaturePad(canvasId) {
    const canvas = $(canvasId); if (!canvas) return null;
    const ctx = canvas.getContext('2d'); ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = '#1e293b';
    let drawing = false;
    const getPos = (e) => { const rect = canvas.getBoundingClientRect(); const cx = e.touches ? e.touches[0].clientX : e.clientX; const cy = e.touches ? e.touches[0].clientY : e.clientY; return { x: (cx - rect.left) * (canvas.width / rect.width), y: (cy - rect.top) * (canvas.height / rect.height) }; };
    const start = (e) => { drawing = true; const p = getPos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); e.preventDefault(); };
    const move = (e) => { if (!drawing) return; const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); e.preventDefault(); };
    const stop = () => { drawing = false; };
    canvas.addEventListener('mousedown', start); canvas.addEventListener('mousemove', move); canvas.addEventListener('mouseup', stop);
    canvas.addEventListener('touchstart', start, { passive: false }); canvas.addEventListener('touchmove', move, { passive: false }); canvas.addEventListener('touchend', stop);
    return { clear: () => ctx.clearRect(0,0, canvas.width, canvas.height), isEmpty: () => { const d = ctx.getImageData(0,0, canvas.width, canvas.height).data; for (let i = 3; i < d.length; i += 4) if (d[i] !== 0) return false; return true; }, getDataUrl: () => canvas.toDataURL() };
}

async function exportInventory() {
    const data = Object.values((await get(ref(db, 'inventory'))).val() || {}).map(i => ({ 'Serial': i.serialNumber, 'Name': i.itemName, 'Qty': i.quantity }));
    const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Inventory"); XLSX.writeFile(wb, `Inv_${Date.now()}.xlsx`);
}

async function exportHistory() {
    const data = []; Object.values((await get(ref(db, 'orders'))).val() || {}).forEach(o => { (o.items || []).forEach(i => { data.push({ 'ID': o.orderId, 'Staff': o.teacherName, 'Item': i.itemName, 'Qty': i.requestQuantity, 'Date': o.timestamp }); }); });
    const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Order_History"); XLSX.writeFile(wb, `History_${Date.now()}.xlsx`);
}

// ==================== INVENTORY SAVE ====================
async function saveInventoryItem(e) {
    if (e) e.preventDefault();
    const btn = $('save-inventory-btn'); const msg = $('form-message'); const appsScriptUrl = localStorage.getItem('google_apps_script_url');
    if (!btn) return;
    btn.disabled = true; const originalText = btn.textContent; btn.textContent = "Saving...";
    if (msg) { msg.textContent = "Processing..."; msg.className = "message"; }
    try {
        const cat = $('inv-category').value;
        const itemName = $('inv-item-name').value.trim();
        const itemDescription = $('inv-description').value.trim();
        const serialNumber = $('inv-serial-number').value.trim();
        const currentQty = parseInt($('inv-quantity').value) || 0;
        const openingQty = parseInt($('inv-opening-quantity').value) || 0;
        const file = $('inv-image').files[0];
        const itemCategory = cat === 'Other' ? $('inv-custom-category').value.trim() : cat;
        if (!itemName || !serialNumber) throw new Error("Name and SN required");
        if (!file) throw new Error("Image required");
        const reader = new FileReader(); const base64 = await new Promise((res, rej) => { reader.onload = () => res(reader.result); reader.onerror = rej; reader.readAsDataURL(file); });
        let finalImageUrl = base64;
        if (appsScriptUrl) {
            try {
                if (msg) msg.textContent = "Uploading image...";
                const res = await fetch(appsScriptUrl, { method: 'POST', body: JSON.stringify({ fileData: base64, fileName: `${serialNumber}_${Date.now()}.jpg`, mimeType: file.type }) });
                const result = await res.json();
                if (result.status === 'success' && result.url) finalImageUrl = getDirectDriveUrl(result.url);
            } catch (cloudErr) { }
        }
        const itemId = serialNumber.replace(/[.#$[\]]/g, "_");
        const newItem = { serialNumber, itemName, category: itemCategory, description: itemDescription, quantity: currentQty, openingQuantity: openingQty, imageUrl: finalImageUrl, createdAt: new Date().toISOString() };
        await set(ref(db, 'inventory/' + itemId), newItem);
        await logActivity("Inventory Added", `Item: ${itemName} (${serialNumber})`);
        showToast(`Item ${itemName} Saved!`);
        if (msg) { msg.textContent = "Saved!"; msg.className = "message success"; }
        $('add-inventory-form').reset(); if ($('barcode')) $('barcode').innerHTML = '';
        fetchMasterInventory();
        setTimeout(() => { const invTabBtn = document.querySelector('button[data-target="tab-inventory"]'); if (invTabBtn) invTabBtn.click(); }, 1200);
    } catch (err) {
        showToast(err.message, "error");
        if (msg) { msg.textContent = "Error: " + err.message; msg.className = "message error"; }
    } finally { btn.disabled = false; btn.textContent = originalText; }
}
