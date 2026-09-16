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

const catalogState = {
    allItems: [],
    filtered: [],
    currentPage: 1,
    searchTerm: '',
    prefetchCache: new Map(),
};

const adminInventoryState = {
    allItems: [],
    currentPage: 1,
    searchTerm: '',
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
        console.warn("Max retries reached for image:", originalUrl);
        imgElement.src = FALLBACK_IMG;
        imgElement.classList.add('img-fallback');
        imgElement.onerror = null; // Prevent infinite loop
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

function prefetchImages(urls) {
    urls.forEach(raw => {
        const url = getDirectDriveUrl(raw);
        if (!url || catalogState.prefetchCache.has(url)) return;
        const img = new Image();
        img.src = url;
        catalogState.prefetchCache.set(url, true);
    });
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
    let ocrStream = null;
    let currentOcrTarget = null;

    // --- Tab Navigation ---
    const adminNavButtons = document.querySelectorAll('.admin-nav button[data-target]');
    const adminTabs = document.querySelectorAll('.admin-tab');
    adminNavButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.dataset.target;
            adminNavButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
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

            console.log("Login attempt for ADEK Pass Number:", rawAdecNumber);

            try {
                // Fetch all users to allow case-insensitive lookup on the key
                const snapshot = await get(ref(db, 'users'));
                if (snapshot.exists()) {
                    const users = snapshot.val();
                    const matchedKey = Object.keys(users).find(
                        key => key.toLowerCase() === rawAdecNumber.toLowerCase()
                    );

                    if (matchedKey) {
                        const userData = users[matchedKey];
                        if (userData.password === password) {
                            console.log("Login success for:", matchedKey);
                            localStorage.setItem('stationery_user_adec', matchedKey);
                            handleUserRole(matchedKey);
                            if (loginError) loginError.textContent = "";
                        } else {
                            console.warn("Invalid password for:", matchedKey);
                            if (loginError) loginError.textContent = "Invalid ADEK Pass Number or Password.";
                            showToast("Incorrect Password", "error");
                        }
                    } else {
                        console.warn("ADEK Pass Number not found:", rawAdecNumber);
                        if (loginError) loginError.textContent = "ADEK Pass Number not found.";
                        showToast("Account not found", "error");
                    }
                } else {
                    console.error("No users node found in database.");
                    if (loginError) loginError.textContent = "Database error: No users found.";
                }
            } catch (err) {
                console.error("Authentication Crash:", err);
                if (loginError) loginError.textContent = "Connection failed. Please try again.";
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

    logoutBtns.forEach(btn => {
        btn.addEventListener('click', () => {
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

    const savedAdec = localStorage.getItem('stationery_user_adec');
    if (savedAdec) handleUserRole(savedAdec);
    else showView('login-view');

    // --- Forms ---
    if (inventoryForm) {
        inventoryForm.addEventListener('submit', saveInventoryItem);
    }
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

    // --- Cart ---
    if (cartBtn) {
        cartBtn.addEventListener('click', () => {
            $('cart-modal').classList.add('active');
            renderCart();
        });
    }
    if (closeCartBtn) closeCartBtn.addEventListener('click', () => $('cart-modal').classList.remove('active'));
    if (submitRequisitionBtn) submitRequisitionBtn.addEventListener('click', submitRequisitionRequest);

    // --- Search ---
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

    // --- Modals ---
    if (closeNotificationBtn) closeNotificationBtn.addEventListener('click', () => $('notification-modal').classList.remove('active'));
    if (closeHandoverModalBtn) closeHandoverModalBtn.addEventListener('click', () => $('handover-modal').classList.remove('active'));
    if (completeOrderBtn) completeOrderBtn.addEventListener('click', completeHandoverAction);
    if (closeOrderDetailBtn) closeOrderDetailBtn.addEventListener('click', () => $('order-detail-modal').classList.remove('active'));
    if (closeItemDetailBtn) closeItemDetailBtn.addEventListener('click', () => $('item-detail-modal').classList.remove('active'));

    // --- QR / Barcode Scanner ---
    if (startScanBtn) {
        startScanBtn.addEventListener('click', () => {
            $('qr-scanner-modal').classList.add('active');
            initScanner();
        });
    }

    if (closeScannerBtn) {
        closeScannerBtn.addEventListener('click', stopScanner);
    }

    // --- OCR Scanner Logic ---
    ocrTriggerBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            currentOcrTarget = btn.dataset.target;
            $('ocr-scanner-modal').classList.add('active');
            startOcrCamera();
        });
    });

    if (ocrSnapBtn) ocrSnapBtn.addEventListener('click', captureAndRecognize);
    if (closeOcrBtn) closeOcrBtn.addEventListener('click', stopOcrCamera);

    // --- Export / Branding / Categories ---
    if (exportInventoryBtn) exportInventoryBtn.addEventListener('click', exportInventory);
    if (exportHistoryBtn) exportHistoryBtn.addEventListener('click', exportHistory);
    $('upload-branding-btn')?.addEventListener('click', () => {
        const file = $('branding-logo-upload').files[0];
        if (file) uploadLogo(file);
    });
    $('add-category-btn')?.addEventListener('click', () => {
        const name = $('new-category-name').value.trim();
        if (name) addCategory(name);
    });

    // Signature pads
    adminPad = setupSignaturePad('admin-canvas');
    teacherPad = setupSignaturePad('teacher-canvas');
    $('clear-admin-sig-btn')?.addEventListener('click', () => adminPad?.clear());
    $('clear-teacher-sig-btn')?.addEventListener('click', () => teacherPad?.clear());

    // --- Account Provisioning ---
    const devCreateAccountForm = $('dev-create-account-form');
    if (devCreateAccountForm) {
        devCreateAccountForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = $('dev-name').value.trim();
            const adecNum = $('dev-adec-number').value.trim();
            const pass = $('dev-password').value;
            const role = $('dev-role').value;
            if (!name || !adecNum || !pass || !role) return;

            try {
                await set(ref(db, 'users/' + adecNum), {
                    name, adecPassNumber: adecNum, password: pass, role,
                    createdAt: new Date().toISOString()
                });
                await logActivity("Account Created", `Dev created ${role}: ${name} (${adecNum})`);
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
            const adecNum = $('admin-adec-number').value.trim();
            const pass = $('admin-password').value;
            if (!name || !adecNum || !pass) return;

            try {
                await set(ref(db, 'users/' + adecNum), {
                    name, adecPassNumber: adecNum, password: pass, role: 'TEACHER',
                    createdAt: new Date().toISOString()
                });
                await logActivity("Account Created", `Admin created Teacher: ${name} (${adecNum})`);
                showToast("Teacher account created!");
                adminCreateTeacherForm.reset();
            } catch (err) { showToast(err.message, "error"); }
        });
    }

    // --- Manage Staff sub-tabs ---
    const btnShowProvision = $('btn-show-provision');
    const btnShowDirectory = $('btn-show-directory');
    const provisionView = $('staff-provision-view');
    const directoryView = $('staff-list-view');
    if (btnShowProvision && btnShowDirectory) {
        btnShowProvision.addEventListener('click', () => {
            btnShowProvision.classList.add('active');
            btnShowDirectory.classList.remove('active');
            provisionView.style.display = 'block';
            directoryView.style.display = 'none';
        });
        btnShowDirectory.addEventListener('click', () => {
            btnShowDirectory.classList.add('active');
            btnShowProvision.classList.remove('active');
            provisionView.style.display = 'none';
            directoryView.style.display = 'block';
        });
    }
});

// ==================== SCANNER LOGIC ====================
async function initScanner() {
    if (!html5QrCode) {
        html5QrCode = new Html5Qrcode("reader");
    }

    const config = {
        fps: 10,
        qrbox: { width: 250, height: 150 },
        aspectRatio: 1.0
    };

    try {
        await html5QrCode.start(
            { facingMode: "environment" },
            config,
            (decodedText) => {
                console.log("Code Scanned:", decodedText);
                const input = document.getElementById('inv-serial-number');
                if (input) {
                    input.value = decodedText;
                    // Trigger input event to generate barcode preview
                    input.dispatchEvent(new Event('input'));
                }
                showToast("Code Scanned!", "success");
                stopScanner();
            },
            (errorMessage) => {
                // ignore parsing errors
            }
        );
    } catch (err) {
        console.error("Scanner Error:", err);
        showToast("Camera access denied or error", "error");
        stopScanner();
    }
}

async function stopScanner() {
    $('qr-scanner-modal').classList.remove('active');
    if (html5QrCode && html5QrCode.isScanning) {
        try {
            await html5QrCode.stop();
        } catch (e) {
            console.warn("Stop scanner error:", e);
        }
    }
}

// ==================== OCR LOGIC ====================
async function startOcrCamera() {
    const video = $('ocr-video');
    try {
        ocrStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        video.srcObject = ocrStream;
    } catch (err) {
        console.error("OCR Camera Error:", err);
        showToast("Could not access camera", "error");
        stopOcrCamera();
    }
}

function stopOcrCamera() {
    $('ocr-scanner-modal').classList.remove('active');
    if (ocrStream) {
        ocrStream.getTracks().forEach(track => track.stop());
        ocrStream = null;
    }
    const video = $('ocr-video');
    if (video) video.srcObject = null;
    $('ocr-loader').style.display = 'none';
}

async function captureAndRecognize() {
    const video = $('ocr-video');
    const canvas = $('ocr-canvas');
    const loader = $('ocr-loader');

    if (!video.srcObject) return;

    // Capture Frame
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);

    const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.9));

    // UI Loading State
    loader.style.display = 'flex';
    $('ocr-status-text').textContent = "Reading label text...";

    try {
        const result = await Tesseract.recognize(blob, 'eng', {
            logger: m => {
                if (m.status === 'recognizing text') {
                    $('ocr-status-text').textContent = `Reading... ${Math.round(m.progress * 100)}%`;
                }
            }
        });

        let text = result.data.text.trim();
        // Clean text: remove special chars, multiple newlines
        text = text.replace(/[^\w\s\-\.\(\)\:]/gi, '').replace(/\n+/g, ' ');

        const target = $(currentOcrTarget);
        if (target) {
            target.value = text;
            target.dispatchEvent(new Event('input')); // Trigger validation if any
        }

        showToast("Text Extracted Successfully!", "success");
        stopOcrCamera();
    } catch (err) {
        console.error("OCR Processing Error:", err);
        showToast("Failed to read text", "error");
        loader.style.display = 'none';
    }
}

// ==================== ROLE / VIEW ====================
async function handleUserRole(adecNumber) {
    try {
        const snapshot = await get(child(ref(db), `users/${adecNumber}`));
        if (snapshot.exists()) {
            const userData = snapshot.val();
            currentUser = { uid: adecNumber, ...userData };
            fetchSystemBranding();
            fetchCategories();
            if (userData.role === 'DEVELOPER') {
                showView('developer-dashboard');
                fetchAuditLogs();
            } else if (userData.role === 'ADMIN') {
                showView('admin-dashboard');
                initAdminDashboards();
            } else if (userData.role === 'TEACHER') {
                showView('teacher-dashboard');
                fetchInventory();
                fetchTeacherOrderHistory(adecNumber);
            }
        } else {
            localStorage.removeItem('stationery_user_adec');
            showView('login-view');
        }
    } catch (e) { console.error("RBAC Error:", e); }
}

function showView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const target = document.getElementById(viewId);
    if (target) target.classList.add('active');
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
}

// ==================== CATALOG (PAGINATION) ====================
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
        ? catalogState.allItems.filter(({ data }) =>
            (data.itemName || '').toLowerCase().includes(term) ||
            (data.serialNumber || '').toLowerCase().includes(term))
        : catalogState.allItems.slice();

    renderCatalogPage();
}

function renderCatalogPage() {
    const list = document.getElementById('stationery-list');
    if (!list) return;
    list.innerHTML = '';

    const start = (catalogState.currentPage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const pageItems = catalogState.filtered.slice(start, end);

    if (pageItems.length === 0) {
        list.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#64748b;padding:30px;">No items found.</p>';
        return;
    }

    const frag = document.createDocumentFragment();
    pageItems.forEach(({ id, data }) => {
        const card = document.createElement('div');
        card.className = 'inventory-card';
        const directUrl = getDirectDriveUrl(data.imageUrl);
        card.innerHTML = `
            <div class="card-img-wrap skeleton">
                <img alt="${escapeHtml(data.itemName)}" data-retries="0" onerror="handleImageError(this, '${directUrl}')" class="lazy-load">
            </div>
            <div class="card-body">
                <h3 class="card-title">${escapeHtml(data.itemName)}</h3>
                <p class="serial">SN: ${escapeHtml(data.serialNumber || 'N/A')}</p>
                <p class="description">${escapeHtml(data.description || '')}</p>
                <button class="add-to-cart-btn">View Details</button>
            </div>
        `;
        const img = card.querySelector('img');
        img.src = directUrl; // Initial load trigger

        img.onload = () => {
            img.classList.remove('lazy-load');
            img.classList.add('loaded');
            img.parentElement?.classList.remove('skeleton');
        };

        // Janam Kundali trigger
        card.addEventListener('click', (e) => {
            if (e.target.tagName !== 'BUTTON') showItemDetail(id, data);
        });
        card.querySelector('.add-to-cart-btn').addEventListener('click', () => showItemDetail(id, data));

        frag.appendChild(card);
    });
    list.appendChild(frag);
    renderPaginationControls('catalog-pagination', catalogState, renderCatalogPage);
}

function renderPaginationControls(containerId, state, renderFn) {
    let wrap = document.getElementById(containerId);
    if (!wrap) {
        wrap = document.createElement('div');
        wrap.id = containerId;
        wrap.className = 'catalog-pagination';
        const target = containerId === 'catalog-pagination' ? $('stationery-list') : $('master-inventory-area');
        target.after(wrap);
    }

    const totalPages = Math.ceil(state.filtered.length / PAGE_SIZE) || 1;
    if (state.currentPage > totalPages) state.currentPage = totalPages;

    wrap.innerHTML = `
        <button class="page-btn prev" ${state.currentPage === 1 ? 'disabled' : ''}>Prev</button>
        <span class="page-info">Page <strong>${state.currentPage}</strong> of <strong>${totalPages}</strong></span>
        <button class="page-btn next" ${state.currentPage === totalPages ? 'disabled' : ''}>Next</button>
    `;

    wrap.querySelector('.prev').onclick = () => { state.currentPage--; renderFn(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    wrap.querySelector('.next').onclick = () => { state.currentPage++; renderFn(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
}

// ==================== ITEM DETAIL (JANAM KUNDALI) ====================
function showItemDetail(id, data) {
    const content = $('item-detail-content');
    const isOutOfStock = (parseInt(data.quantity) || 0) <= 0;

    content.innerHTML = `
        <img class="item-detail-img" src="${FALLBACK_IMG}" alt="">
        <div class="item-detail-info">
            <span class="badge bg-info">${escapeHtml(data.category || 'General')}</span>
            <h3>${escapeHtml(data.itemName)}</h3>
            <p><strong>SN:</strong> ${escapeHtml(data.serialNumber)}</p>
            <div class="item-detail-desc">${escapeHtml(data.description)}</div>

            <div class="item-detail-footer">
                <input type="number" id="detail-qty" value="1" min="1" max="${data.quantity}" style="width:70px; padding:8px; border-radius:6px; border:1px solid #ddd;">
                <button id="detail-add-btn" class="primary-btn green" style="flex:1;" ${isOutOfStock ? 'disabled' : ''}>
                    ${isOutOfStock ? 'Out of Stock' : 'Add to Cart'}
                </button>
            </div>
        </div>
    `;

    const img = content.querySelector('.item-detail-img');
    attachSmartImage(img, data.imageUrl);

    $('detail-add-btn').onclick = () => {
        const reqQty = parseInt($('detail-qty').value) || 1;
        addToCart(id, data, reqQty);
        $('item-detail-modal').classList.remove('active');
    };

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
    const list = $('master-inventory-list');
    if (!list) return;

    const term = adminInventoryState.searchTerm;
    adminInventoryState.filtered = term
        ? adminInventoryState.allItems.filter(i =>
            (i.itemName || '').toLowerCase().includes(term) ||
            (i.serialNumber || '').toLowerCase().includes(term))
        : adminInventoryState.allItems.slice();

    list.innerHTML = '';
    const start = (adminInventoryState.currentPage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const pageItems = adminInventoryState.filtered.slice(start, end);

    if (pageItems.length === 0) {
        list.innerHTML = '<tr><td colspan="7" style="text-align:center;">No items.</td></tr>';
        return;
    }

    pageItems.forEach(item => {
        const tr = document.createElement('tr');
        const qty = parseInt(item.quantity) || 0;
        if (qty < 5) tr.className = 'row-low-stock';
        const directUrl = getDirectDriveUrl(item.imageUrl);
        tr.innerHTML = `
            <td>${escapeHtml(item.serialNumber)}</td>
            <td>${escapeHtml(item.itemName)}</td>
            <td>${escapeHtml(item.description)}</td>
            <td>${item.openingQuantity || 0}</td>
            <td>${qty} ${qty < 5 ? '<span class="badge-low-stock">Low</span>' : ''}</td>
            <td><img class="inventory-thumb lazy-load" data-retries="0" onerror="handleImageError(this, '${directUrl}')" alt=""></td>
            <td><span class="badge ${qty > 0 ? 'bg-success' : 'bg-secondary'}">${qty > 0 ? 'In Stock' : 'Out'}</span></td>
        `;
        const img = tr.querySelector('img');
        img.src = directUrl;
        img.onload = () => img.classList.remove('lazy-load');
        list.appendChild(tr);
    });
    renderPaginationControls('admin-inventory-pagination', adminInventoryState, renderMasterInventory);
}

// ==================== ANALYTICS ====================
function fetchOrderHistoryForAnalytics() {
    addListener(ref(db, 'orders'), (snap) => {
        const container = $('analytics-cards');
        if (!container) return;
        const data = snap.val() || {};
        const entries = Object.values(data);
        let total = entries.length, pending = 0, approved = 0, done = 0;
        const stats = {};
        entries.forEach(o => {
            if (o.status === 'Pending Approval') pending++;
            else if (o.status === 'Approved') approved++;
            else if (o.status === 'Handover Complete / Done') done++;
            const name = o.teacherName || 'Staff';
            const units = (o.items || []).reduce((s, i) => s + (parseInt(i.requestQuantity) || 0), 0);
            stats[name] = (stats[name] || 0) + units;
        });
        container.innerHTML = `
            <div class="analytics-card"><h4>Total Orders</h4><div class="total-items">${total}</div><p>Lifetime</p></div>
            <div class="analytics-card"><h4>Pipeline</h4><div class="total-items" style="font-size:16px; margin-top:8px;">
                <span style="color:#f1c40f;">${pending}P</span> | <span style="color:#3498db;">${approved}A</span> | <span style="color:#27ae60;">${done}D</span>
            </div><p>P/A/D Status</p></div>
        `;
        Object.entries(stats).sort((a,b) => b[1]-a[1]).slice(0, 2).forEach(([name, count]) => {
            const card = document.createElement('div'); card.className = 'analytics-card';
            card.innerHTML = `<h4>${escapeHtml(name)}</h4><div class="total-items">${count}</div><p>Units Issued</p>`;
            container.appendChild(card);
        });
    });
}

// ==================== CART / REQUISITION ====================
function addToCart(id, data, customQty = 1) {
    const stock = parseInt(data.quantity) || 0;
    if (cart[id]) {
        if (cart[id].requestQuantity + customQty <= stock) {
            cart[id].requestQuantity += customQty;
            showToast(`${data.itemName} updated`);
        } else showToast("Insufficient stock", 'error');
    } else {
        cart[id] = { ...data, requestQuantity: customQty };
        showToast("Added to cart");
    }
    updateCartBadge();
}

function updateCartBadge() {
    const count = Object.values(cart).reduce((sum, item) => sum + item.requestQuantity, 0);
    if ($('cart-count')) $('cart-count').textContent = count;
}

function renderCart() {
    const container = $('cart-items'); if (!container) return;
    container.innerHTML = '';
    const items = Object.entries(cart);
    if (items.length === 0) { container.innerHTML = '<p style="text-align:center;color:#64748b;padding:20px;">Empty Cart</p>'; return; }
    items.forEach(([id, item]) => {
        const div = document.createElement('div'); div.className = 'cart-item';
        div.innerHTML = `<div class="cart-item-info"><strong>${escapeHtml(item.itemName)}</strong><small>SN: ${item.serialNumber}</small></div>
            <div class="cart-item-controls">
                <input type="number" class="qty-input" data-id="${id}" value="${item.requestQuantity}" min="1" max="${item.quantity}">
                <button class="remove-item-btn" data-id="${id}">🗑️</button>
            </div>`;
        container.appendChild(div);
    });
    container.querySelectorAll('.qty-input').forEach(inp => inp.onchange = (e) => {
        const it = cart[inp.dataset.id]; if (!it) return;
        let v = parseInt(e.target.value) || 1;
        if (v > it.quantity) v = it.quantity;
        it.requestQuantity = v; updateCartBadge();
    });
    container.querySelectorAll('.remove-item-btn').forEach(btn => btn.onclick = () => {
        delete cart[btn.dataset.id]; renderCart(); updateCartBadge();
    });
}

async function submitRequisitionRequest() {
    if (Object.keys(cart).length === 0) return showToast("Cart is empty", 'error');
    // JYS-XXXXX format
    const orderId = 'JYS-' + Math.floor(10000 + Math.random() * 90000);
    try {
        const items = Object.entries(cart).map(([id, item]) => ({
            itemId: id, itemName: item.itemName, serial: item.serialNumber,
            requestQuantity: item.requestQuantity, imageUrl: item.imageUrl
        }));
        await set(ref(db, 'orders/' + orderId), {
            orderId, teacherUid: currentUser.adecPassNumber || currentUser.uid, teacherName: currentUser.name,
            timestamp: new Date().toISOString(), items, status: 'Pending Approval'
        });
        await logActivity("Order Placed", `ID: ${orderId}, ${items.length} items`);
        cart = {}; updateCartBadge();
        $('cart-modal').classList.remove('active');
        showToast(`Order ${orderId} Submitted!`);
    } catch (e) { showToast(e.message, 'error'); }
}

// ==================== LIVE ORDERS (ADMIN) ====================
function fetchAdminOrders() {
    addListener(ref(db, 'orders'), (snapshot) => {
        const list = $('admin-requests-list');
        const historyList = $('admin-history-list');
        if (!list || !historyList) return;
        list.innerHTML = ''; historyList.innerHTML = '';
        const orders = Object.entries(snapshot.val() || {}).reverse();
        orders.forEach(([id, order]) => {
            if (order.status === 'Handover Complete / Done') {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${id}</td><td>${escapeHtml(order.teacherName)}</td><td>${new Date(order.timestamp).toLocaleDateString()}</td>
                    <td><div style="display:flex;gap:4px;"></div></td><td><span class="badge bg-success">Done</span></td>
                    <td><button class="view-details-btn">View</button></td>`;
                const wrap = tr.querySelector('div');
                (order.items || []).slice(0, 3).forEach(it => {
                    const img = document.createElement('img'); img.className = 'inventory-thumb'; img.width=30; img.height=30;
                    wrap.appendChild(img); attachSmartImage(img, it.imageUrl);
                });
                tr.querySelector('button').onclick = () => viewOrderDetails(id);
                historyList.appendChild(tr);
            } else {
                const card = document.createElement('div');
                card.className = `request-card ${order.status === 'Pending Approval' ? 'pending' : 'approved'}`;
                card.innerHTML = `
                    <div class="request-header"><h4>${escapeHtml(order.teacherName)}</h4><span class="badge ${order.status === 'Pending Approval' ? 'bg-warning' : 'bg-info'}">${order.status}</span></div>
                    <div class="request-items" style="display:flex;gap:10px;padding:10px 0;"></div>
                    <div class="request-actions">
                        ${order.status === 'Pending Approval' ? `<button class="action-btn prepare-btn" style="flex:1;">Approve</button>` : ''}
                        <button class="action-btn handover-btn" style="flex:1;">${order.status === 'Approved' ? 'Complete Handover & Sign' : 'Force Handover'}</button>
                    </div>`;
                const wrap = card.querySelector('.request-items');
                (order.items || []).forEach(it => {
                    const d = document.createElement('div'); d.className = 'req-item-mini';
                    d.innerHTML = `<img class="inventory-thumb" width="40" height="40"><br><small>x${it.requestQuantity}</small>`;
                    wrap.appendChild(d); attachSmartImage(d.querySelector('img'), it.imageUrl);
                });
                card.querySelector('.prepare-btn')?.addEventListener('click', () => updateOrderStatus(id, 'Approved'));
                card.querySelector('.handover-btn').onclick = () => {
                    activeHandoverRequestId = id; adminPad?.clear(); teacherPad?.clear();
                    $('handover-modal').classList.add('active');
                };
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
        const list = $('teacher-history-list'); if (!list) return;
        list.innerHTML = '';
        const orders = Object.entries(snap.val() || {}).reverse().filter(([id, o]) => o.teacherUid === adec);
        if (orders.length === 0) { list.innerHTML = '<tr><td colspan="5" style="text-align:center;">No history</td></tr>'; return; }
        orders.forEach(([id, order]) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${id}</td><td>${new Date(order.timestamp).toLocaleDateString()}</td><td><div style="display:flex;gap:4px;"></div></td>
                <td><span class="badge ${order.status === 'Pending Approval' ? 'bg-warning' : order.status === 'Approved' ? 'bg-info' : 'bg-success'}">${order.status}</span></td>
                <td><button class="view-details-btn">View</button></td>`;
            const wrap = tr.querySelector('div');
            (order.items || []).slice(0, 3).forEach(it => {
                const img = document.createElement('img'); img.className='inventory-thumb'; img.width=30; img.height=30;
                wrap.appendChild(img); attachSmartImage(img, it.imageUrl);
            });
            tr.querySelector('button').onclick = () => viewOrderDetails(id);
            list.appendChild(tr);
        });
    });
}

async function completeHandoverAction() {
    if (adminPad.isEmpty() || teacherPad.isEmpty()) return showToast("Signatures required", 'error');
    const btn = $('complete-order-btn'); btn.disabled = true;
    try {
        const snap = await get(ref(db, `orders/${activeHandoverRequestId}`));
        const orderData = snap.val();
        for (const item of orderData.items) {
            const qtyRef = ref(db, `inventory/${item.itemId}/quantity`);
            const curr = (await get(qtyRef)).val() || 0;
            await set(qtyRef, Math.max(0, curr - item.requestQuantity));
        }
        const sigs = { admin: adminPad.getDataUrl(), teacher: teacherPad.getDataUrl(), completedAt: new Date().toISOString() };
        await update(ref(db, `orders/${activeHandoverRequestId}`), { status: 'Handover Complete / Done', signatures: sigs });
        $('handover-modal').classList.remove('active');
        showToast("Handover Complete!");
    } catch (e) { showToast(e.message, 'error'); } finally { btn.disabled = false; }
}

async function viewOrderDetails(id) {
    const snap = await get(ref(db, `orders/${id}`));
    const order = snap.val();
    const content = $('order-detail-content');
    content.innerHTML = `
        <div style="text-align:center;margin-bottom:15px;"><h3>Requisition Receipt</h3><p>ID: ${id}</p></div>
        <p><strong>Staff:</strong> ${escapeHtml(order.teacherName)} (${order.teacherUid})</p>
        <table class="history-table" style="margin:15px 0;">
            <thead><tr><th>Item</th><th>Qty</th></tr></thead>
            <tbody>${order.items.map(i => `<tr><td>${escapeHtml(i.itemName)}</td><td>${i.requestQuantity}</td></tr>`).join('')}</tbody>
        </table>
        ${order.signatures ? `<div class="order-detail-signatures">
            <div class="signature-display-box"><small>Admin</small><br><img src="${order.signatures.admin}"></div>
            <div class="signature-display-box"><small>Staff</small><br><img src="${order.signatures.teacher}"></div>
        </div>` : ''}
    `;
    $('order-detail-modal').classList.add('active');
}

// ==================== STAFF / DRIVE / SYSTEM ====================
function fetchStaffList() {
    addListener(ref(db, 'users'), (snapshot) => {
        const list = $('admin-staff-list'); if (!list) return;
        list.innerHTML = '';
        Object.entries(snapshot.val() || {}).forEach(([id, user]) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td><strong>${escapeHtml(user.adecPassNumber || id)}</strong></td><td>${escapeHtml(user.name || 'N/A')}</td>
                <td><span class="badge bg-info">${user.role}</span></td><td><code>••••</code></td>
                <td><button class="remove-item-btn">Delete</button></td>`;
            tr.querySelector('button').onclick = async () => { if(confirm("Delete user?")) await remove(ref(db, `users/${id}`)); };
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
        const data = snap.val() || {};
        const select = $('inv-category');
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
    const reader = new FileReader();
    const base = await new Promise((res) => { reader.onload = () => res(reader.result); reader.readAsDataURL(file); });
    await set(ref(db, 'settings/logo'), base);
    showToast("Logo Updated!");
}
async function addCategory(name) { await push(ref(db, 'settings/categories'), name); $('new-category-name').value = ''; showToast("Added!"); }

function setupSignaturePad(canvasId) {
    const canvas = $(canvasId); if (!canvas) return null;
    const ctx = canvas.getContext('2d'); ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = '#1e293b';
    let drawing = false;
    const getPos = (e) => {
        const rect = canvas.getBoundingClientRect();
        const cx = e.touches ? e.touches[0].clientX : e.clientX;
        const cy = e.touches ? e.touches[0].clientY : e.clientY;
        return { x: (cx - rect.left) * (canvas.width / rect.width), y: (cy - rect.top) * (canvas.height / rect.height) };
    };
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
    const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "History"); XLSX.writeFile(wb, `History_${Date.now()}.xlsx`);
}

// ==================== INVENTORY SAVE ====================
async function saveInventoryItem(e) {
    if (e) e.preventDefault();

    const btn = $('save-inventory-btn');
    const msg = $('form-message');
    const appsScriptUrl = localStorage.getItem('google_apps_script_url');

    if (!btn) return;

    // UI Feedback
    btn.disabled = true;
    const originalText = btn.textContent;
    btn.textContent = "Saving...";
    if (msg) {
        msg.textContent = "Processing item data...";
        msg.className = "message";
    }

    try {
        const cat = $('inv-category').value;
        const itemName = $('inv-item-name').value.trim();
        const itemDescription = $('inv-description').value.trim();
        const serialNumber = $('inv-serial-number').value.trim();
        const currentQty = parseInt($('inv-quantity').value) || 0;
        const openingQty = parseInt($('inv-opening-quantity').value) || 0;
        const file = $('inv-image').files[0];

        const itemCategory = cat === 'Other' ? $('inv-custom-category').value.trim() : cat;

        if (!itemName || !serialNumber) throw new Error("Name and Serial Number are required.");
        if (!file) throw new Error("Product image is required.");

        // 1. Process Image
        const reader = new FileReader();
        const base64 = await new Promise((res, rej) => {
            reader.onload = () => res(reader.result);
            reader.onerror = rej;
            reader.readAsDataURL(file);
        });

        let finalDirectImageUrl = base64; // Default to Base64

        // 2. Optional: Cloud Upload via Google Drive
        if (appsScriptUrl) {
            try {
                if (msg) msg.textContent = "Uploading image to Google Drive...";
                const res = await fetch(appsScriptUrl, {
                    method: 'POST',
                    body: JSON.stringify({
                        fileData: base64,
                        fileName: `${serialNumber}_${Date.now()}.jpg`,
                        mimeType: file.type
                    })
                });
                const result = await res.json();
                if (result.status === 'success' && result.url) {
                    finalDirectImageUrl = getDirectDriveUrl(result.url);
                }
            } catch (cloudErr) {
                console.warn("Cloud upload failed, using local storage fallback.");
            }
        }

        // 3. Save to Firebase
        const itemId = serialNumber.replace(/[.#$[\]]/g, "_"); // Ensure valid FB key
        const newItem = {
            serialNumber,
            itemName,
            category: itemCategory,
            description: itemDescription,
            quantity: currentQty,
            openingQuantity: openingQty,
            imageUrl: finalDirectImageUrl,
            createdAt: new Date().toISOString()
        };

        await set(ref(db, 'inventory/' + itemId), newItem);
        await logActivity("Inventory Added", `Item: ${itemName} (${serialNumber})`);

        // 4. Success Lifecycle
        showToast(`Item ${itemName} Saved Successfully!`);
        if (msg) {
            msg.textContent = "Saved Successfully!";
            msg.className = "message success";
        }

        // Reset UI
        $('add-inventory-form').reset();
        const barcodeEl = $('barcode');
        if (barcodeEl) barcodeEl.innerHTML = '';

        // Refresh Table
        fetchMasterInventory();

        // Return to Inventory Tab automatically
        setTimeout(() => {
            const invTabBtn = document.querySelector('button[data-target="tab-inventory"]');
            if (invTabBtn) invTabBtn.click();
        }, 1200);

    } catch (err) {
        console.error("Inventory Save Error:", err);
        showToast(err.message, "error");
        if (msg) {
            msg.textContent = "Error: " + err.message;
            msg.className = "message error";
        }
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}
