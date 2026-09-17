// Firebase SDK imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getDatabase, ref, get, child, set, push, onValue, update, remove } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-analytics.js";

// Define Current App Version
const APP_VERSION = "1.0.4";

// Auto Cache Purge Logic
(function checkAppVersion() {
    const savedVersion = localStorage.getItem('app_installed_version');
    if (savedVersion !== APP_VERSION) {
        console.log(`Version change detected: ${savedVersion} -> ${APP_VERSION}. Clearing old caches...`);

        if ('caches' in window) {
            caches.keys().then(names => {
                for (let name of names) caches.delete(name);
            });
        }

        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(registrations => {
                for (let registration of registrations) registration.unregister();
            });
        }

        localStorage.setItem('app_installed_version', APP_VERSION);
        window.location.reload(true);
    }
})();

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
let currentOcrTarget = null;
let notificationsList = [];

const catalogState = { allItems: [], filtered: [], currentPage: 1, searchTerm: '' };
const adminInventoryState = { allItems: [], filtered: [], currentPage: 1, searchTerm: '' };
const auditLedgerState = { allItems: [], filtered: [], currentPage: 1 };
const teacherOrdersState = { allItems: [], filtered: [], currentPage: 1 };

const alertedRequests = new Set();

// ==================== IMAGE & UI UTILITIES ====================
function getStatusBadge(qty) {
  const numericQty = Number(qty) || 0;
  if (numericQty <= 0) return `<span class="badge bg-danger">Out of Stock</span>`;
  if (numericQty <= 5) return `<span class="badge bg-warning text-dark">Low Stock (${numericQty})</span>`;
  return `<span class="badge bg-success">In Stock</span>`;
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

window.handleImageError = function(imgElement, originalUrl) {
    let retries = parseInt(imgElement.getAttribute('data-retries') || '0');
    if (retries < 3) {
        retries++;
        imgElement.setAttribute('data-retries', retries);
        const newUrl = getDirectDriveUrl(originalUrl, retries) + '?t=' + Date.now();
        setTimeout(() => { imgElement.src = newUrl; }, 800 * retries);
    } else {
        imgElement.src = FALLBACK_IMG;
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
            navigator.serviceWorker.register(`./sw.js?v=${APP_VERSION}`)
                .then(reg => {
                    console.log('SW Registered successfully:', reg.scope);
                    reg.update();
                })
                .catch(err => console.warn('ServiceWorker registration failed:', err));
        });
    }

    const loginForm = $('login-form');
    const loginBtn = $('login-submit-btn');
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
        $('cart-modal').classList.add('active');
        renderCart();
    });

    $('drawer-history-btn')?.addEventListener('click', () => {
        toggleDrawer(false);
        window.scrollTo({ top: $('teacher-history-area').offsetTop - 100, behavior: 'smooth' });
    });

    [$('logout-btn-admin'), $('logout-btn-teacher'), ...logoutBtns].forEach(btn => {
        btn?.addEventListener('click', () => {
            toggleDrawer(false);
            cleanupListeners();
            localStorage.removeItem('stationery_user_adec');
            currentUser = null;
            cart = {};
            updateCartBadge();
            catalogState.allItems = []; catalogState.filtered = []; catalogState.currentPage = 1; catalogState.searchTerm = '';
            showView('login-view');
        });
    });

    // --- Authentication ---
    async function executeLogin(e) {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        console.log("--> Login attempt triggered!");

        const passInput = $('login-pass-number');
        const passwordInput = $('login-password');
        const loginError = $('login-error');

        if (!passInput || !passwordInput) {
            alert("Critical Error: Login Input Elements not found. Check HTML IDs.");
            return false;
        }

        const adecNumber = passInput.value.trim().toUpperCase();
        const password = passwordInput.value.trim();

        if (!adecNumber || !password) {
            alert("Please enter both ADEK Pass Number and Password.");
            return false;
        }

        if (loginBtn) { loginBtn.disabled = true; loginBtn.textContent = "Authenticating..."; }

        try {
            const snapshot = await get(ref(db, 'users'));
            if (snapshot.exists()) {
                const users = snapshot.val();
                const matchedKey = Object.keys(users).find(key => key.toUpperCase() === adecNumber);
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
                if (loginError) loginError.textContent = "No registered users found.";
            }
        } catch (err) {
            console.error("Login Error:", err);
            try {
                const directSnap = await get(child(ref(db), `users/${adecNumber}`));
                if (directSnap.exists()) {
                    const userData = directSnap.val();
                    if (userData.password === password) {
                        localStorage.setItem('stationery_user_adec', adecNumber);
                        handleUserRole(adecNumber);
                        return;
                    }
                }
            } catch(e) {}
            alert("Login Failed: " + err.message);
        } finally {
            if (loginBtn) { loginBtn.disabled = false; loginBtn.textContent = "Login"; }
        }
        return false;
    }

    if (loginForm) loginForm.onsubmit = executeLogin;
    if (loginBtn) loginBtn.onclick = executeLogin;

    if (bypassAdminBtn) {
        bypassAdminBtn.addEventListener('click', () => {
            currentUser = { uid: "bypass_admin", name: "System Developer", role: "DEVELOPER" };
            showView('developer-dashboard');
            fetchAuditLogs(); fetchSystemBranding(); fetchCategories();
        });
    }

    const savedAdec = localStorage.getItem('stationery_user_adec');
    if (savedAdec) handleUserRole(savedAdec);
    else showView('login-view');

    // --- UI Listeners ---
    if (inventoryForm) inventoryForm.addEventListener('submit', saveInventoryItem);
    if (categorySelect) categorySelect.onchange = () => {
        const customGroup = $('custom-category-group');
        if (customGroup) customGroup.style.display = categorySelect.value === 'Other' ? 'block' : 'none';
    };
    if (serialNumberInput) serialNumberInput.oninput = () => {
        const serial = serialNumberInput.value.trim();
        if (serial) { try { JsBarcode("#barcode", serial, { format: "CODE128", displayValue: true, fontSize: 16 }); } catch (e) { } }
        else $('barcode').innerHTML = '';
    };

    if (cartBtn) cartBtn.onclick = () => { $('cart-modal').classList.add('active'); renderCart(); };
    if (closeCartBtn) closeCartBtn.onclick = () => $('cart-modal').classList.remove('active');
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

    if (closeNotificationBtn) closeNotificationBtn.onclick = () => $('notification-modal').classList.remove('active');
    if (closeHandoverModalBtn) closeHandoverModalBtn.onclick = () => $('handover-modal').classList.remove('active');
    if (completeOrderBtn) completeOrderBtn.onclick = completeHandoverAction;
    if (closeOrderDetailBtn) closeOrderDetailBtn.onclick = () => $('order-detail-modal').classList.remove('active');
    if (closeItemDetailBtn) closeItemDetailBtn.onclick = () => $('item-detail-modal').classList.remove('active');

    if (startScanBtn) startScanBtn.onclick = () => { $('qr-scanner-modal').classList.add('active'); initScanner(); };
    if (closeScannerBtn) closeScannerBtn.onclick = stopScanner;

    // OCR TRIGGER BUTTONS
    ocrTriggerBtns.forEach(btn => {
        btn.onclick = () => {
            currentOcrTarget = btn.dataset.target;
            startOcrCamera();
        };
    });

    // OCR SNAP BUTTON
    if (ocrSnapBtn) ocrSnapBtn.onclick = () => {
        const video = $('ocr-video');
        const canvas = $('ocr-canvas');
        if (!video || !video.srcObject) return;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);

        runOcrScan(canvas);
    };

    if (closeOcrBtn) closeOcrBtn.onclick = stopOcrCamera;

    if (exportInventoryBtn) exportInventoryBtn.onclick = exportInventory;
    if (exportHistoryBtn) exportHistoryBtn.onclick = exportHistory;
    if (exportAuditBtn) exportAuditBtn.onclick = exportAuditLedger;

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

    // OCR FILE FALLBACK
    $('ocr-file-fallback')?.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                canvas.getContext('2d').drawImage(img, 0, 0);
                runOcrScan(canvas);
            };
        };
        reader.readAsDataURL(file);
    });
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
    if (html5QrCode && html5QrCode.isScanning) {
        try {
            await html5QrCode.stop();
            console.log("Scanner stopped.");
        } catch (e) {
            console.warn("Scanner stop error:", e);
        }
    }
}

async function startOcrCamera() {
    stopOcrCamera();
    const videoEl = $('ocr-video');
    const fallbackInput = $('ocr-file-fallback');
    const constraintsList = [
        { video: { facingMode: "environment" } },
        { video: { facingMode: "user" } },
        { video: true }
    ];
    let activeStream = null;
    for (const constraints of constraintsList) {
        try {
            activeStream = await navigator.mediaDevices.getUserMedia(constraints);
            if (activeStream) break;
        } catch (e) { }
    }
    if (activeStream && videoEl) {
        ocrStream = activeStream;
        videoEl.srcObject = activeStream;
        await videoEl.play();
        $('ocr-scanner-modal').classList.add('active');
    } else {
        console.log("Live stream failed. Opening native camera...");
        if (fallbackInput) {
            alert("Live camera failed. Opening device camera app...");
            fallbackInput.click();
        } else {
            showToast("Camera error", "error");
        }
    }
}

function stopOcrCamera() {
    if (ocrStream) {
        ocrStream.getTracks().forEach(track => track.stop());
        ocrStream = null;
    }
    const videoElement = $('ocr-video');
    if (videoElement) {
        videoElement.srcObject = null;
    }
    if ($('ocr-loader')) $('ocr-loader').style.display = 'none';
    if ($('ocr-scanner-modal')) $('ocr-scanner-modal').classList.remove('active');
}

// ==================== OCR CORE LOGIC (SHARPEN + TTS) ====================

/**
 * Applies a 3x3 convolution sharpening kernel to enhance blurry edges.
 */
function sharpenCanvas(sourceCanvas) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = sourceCanvas.width;
  canvas.height = sourceCanvas.height;

  ctx.drawImage(sourceCanvas, 0, 0);
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;
  const width = imgData.width;
  const height = imgData.height;

  // 3x3 Sharpening Kernel Filter
  const kernel = [
     0, -1,  0,
    -1,  5, -1,
     0, -1,  0
  ];

  const buff = new Uint8ClampedArray(data);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      for (let c = 0; c < 3; c++) { // Red, Green, Blue
        let i = (y * width + x) * 4 + c;
        let val =
          buff[((y - 1) * width + (x - 1)) * 4 + c] * kernel[0] +
          buff[((y - 1) * width + x) * 4 + c]       * kernel[1] +
          buff[((y - 1) * width + (x + 1)) * 4 + c] * kernel[2] +
          buff[(y * width + (x - 1)) * 4 + c]       * kernel[3] +
          buff[(y * width + x) * 4 + c]             * kernel[4] +
          buff[(y * width + (x + 1)) * 4 + c]       * kernel[5] +
          buff[((y + 1) * width + (x - 1)) * 4 + c] * kernel[6] +
          buff[((y + 1) * width + x) * 4 + c]       * kernel[7] +
          buff[((y + 1) * width + (x + 1)) * 4 + c] * kernel[8];

        data[i] = val;
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

/**
 * Preprocesses an image canvas for OCR using adaptive thresholding.
 * This is much better for complex backgrounds and glare.
 */
function preprocessImageForOcr(sourceCanvas) {
    const processedCanvas = document.createElement('canvas');
    const ctx = processedCanvas.getContext('2d');

    processedCanvas.width = sourceCanvas.width;
    processedCanvas.height = sourceCanvas.height;

    ctx.drawImage(sourceCanvas, 0, 0);

    const imgData = ctx.getImageData(0, 0, processedCanvas.width, processedCanvas.height);
    const data = imgData.data;
    const width = processedCanvas.width;
    const height = processedCanvas.height;

    // 1. Convert to Grayscale
    const grayData = new Uint8ClampedArray(width * height);
    for (let i = 0; i < data.length; i += 4) {
        grayData[i / 4] = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    }

    // 2. Adaptive Thresholding (Mean of local neighborhood)
    const blockSize = 15;
    const C = 2;
    const outputData = ctx.createImageData(width, height);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = y * width + x;

            let sum = 0;
            let count = 0;
            for (let dy = -blockSize; dy <= blockSize; dy++) {
                for (let dx = -blockSize; dx <= blockSize; dx++) {
                    const nx = x + dx;
                    const ny = y + dy;
                    if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                        sum += grayData[ny * width + nx];
                        count++;
                    }
                }
            }
            const mean = sum / count;
            const pixelValue = grayData[i] > mean - C ? 255 : 0;

            const idx = i * 4;
            outputData.data[idx] = pixelValue;
            outputData.data[idx + 1] = pixelValue;
            outputData.data[idx + 2] = pixelValue;
            outputData.data[idx + 3] = 255;
        }
    }

    ctx.putImageData(outputData, 0, 0);
    return processedCanvas;
}

/**
 * Speaks the extracted text aloud using SpeechSynthesis API.
 */
function speakExtractedText(text) {
  if (!('speechSynthesis' in window)) return;

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  if (!text || text.trim().length === 0) return;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US'; // Or 'hi-IN' based on preference
  utterance.rate = 0.95;    // Slightly slower for clear pronounciation
  utterance.pitch = 1.0;

  window.speechSynthesis.speak(utterance);
}

/**
 * Main OCR execution function with Cropping, Sharpening, Thresholding, and TTS.
 */
async function runOcrScan(canvasElement) {
    const loader = $('ocr-loader');
    const statusText = $('ocr-status-text');
    if (loader) loader.style.display = 'flex';
    if (statusText) statusText.textContent = "Sharpening & Reading...";

    try {
        // --- STEP 1: CROP THE IMAGE (Central Area) ---
        const cropCanvas = document.createElement('canvas');
        const cropCtx = cropCanvas.getContext('2d');

        const cropWidth = canvasElement.width * 0.7;
        const cropHeight = canvasElement.height * 0.4;
        const cropX = (canvasElement.width - cropWidth) / 2;
        const cropY = (canvasElement.height - cropHeight) / 2;

        cropCanvas.width = cropWidth;
        cropCanvas.height = cropHeight;
        cropCtx.drawImage(canvasElement, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

        // --- STEP 2: SHARPEN THE IMAGE ---
        const sharpenedCanvas = sharpenCanvas(cropCanvas);

        // --- STEP 3: ADAPTIVE THRESHOLDING ---
        const cleanCanvas = preprocessImageForOcr(sharpenedCanvas);

        // --- STEP 4: RUN TESSERACT ---
        const worker = await Tesseract.createWorker('eng');
        await worker.setParameters({
            tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
            tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 -',
        });

        const { data: { text } } = await worker.recognize(cleanCanvas);
        await worker.terminate();

        // --- STEP 5: CLEAN TEXT ---
        const sanitizedText = text
            .replace(/[^a-zA-Z0-9\s-]/g, '')
            .replace(/\s+/g, ' ')
            .trim();

        console.log("Cleaned OCR Result:", sanitizedText);

        // --- STEP 6: AUTO-FILL INPUT & SPEAK ---
        const inputEl = $(currentOcrTarget);
        if (inputEl && sanitizedText) {
            inputEl.value = sanitizedText;
            inputEl.dispatchEvent(new Event('input'));

            // Speak the text aloud
            speakExtractedText(sanitizedText);

            // Show visual confirmation
            alert(`Text Captured:\n"${sanitizedText}"`);
        } else {
            alert("No text could be confidently extracted. Please try again with better lighting and focus.");
        }

        stopOcrCamera();

    } catch (error) {
        console.error("OCR Processing Error:", error);
        showToast("OCR Failed to process label.", "error");
        if (loader) loader.style.display = 'none';
    }
}

// ==================== ROLE / DASHBOARD ====================
async function handleUserRole(adecNumber) {
    try {
        const snapshot = await get(child(ref(db), `users/${adecNumber}`));
        if (snapshot.exists()) {
            const userData = snapshot.val();
            currentUser = { uid: adecNumber, ...userData };
            fetchSystemBranding(); fetchCategories();
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
    const container = $('inventory-container');
    if (!container) return;
    try {
        const term = adminInventoryState.searchTerm;
        adminInventoryState.filtered = term ? adminInventoryState.allItems.filter(i => (i.itemName || '').toLowerCase().includes(term) || (i.serialNumber || '').toLowerCase().includes(term)) : adminInventoryState.allItems.slice();
        const start = (adminInventoryState.currentPage - 1) * PAGE_SIZE;
        const end = start + PAGE_SIZE;
        const pageItems = adminInventoryState.filtered.slice(start, end);

        if (pageItems.length === 0) { container.innerHTML = '<div class="text-center text-muted p-4">No records found.</div>'; return; }

        const desktopTable = `<div class="table-responsive d-none d-md-block"><table class="table table-hover align-middle history-table"><thead class="table-light"><tr><th>Image</th><th>Serial No</th><th>Item Name</th><th>Category</th><th>Description</th><th>Open Qty</th><th>Qty Available</th><th>Status</th><th>Actions</th></tr></thead><tbody>${pageItems.map(item => {
            const qty = parseInt(item.quantity) || 0;
            return `<tr class="${qty < 5 ? 'row-low-stock' : ''}"><td><img src="${getDirectDriveUrl(item.imageUrl)}" class="rounded inventory-thumb" onerror="handleImageError(this, '${item.imageUrl}')"></td><td><code>${item.serialNumber || 'N/A'}</code></td><td><strong>${escapeHtml(item.itemName)}</strong></td><td><span class="badge bg-light text-dark">${escapeHtml(item.category || 'General')}</span></td><td><small class="text-muted">${escapeHtml(item.description || '-')}</small></td><td>${item.openingQuantity || '-'}</td><td><span class="fw-bold ${qty <= 5 ? 'text-danger' : 'text-success'}">${qty}</span></td><td>${getStatusBadge(qty)}</td><td><button class="btn btn-sm btn-outline-primary" onclick="showItemDetail('${item.serialNumber}', ${JSON.stringify(item).replace(/"/g, '&quot;')})">View</button></td></tr>`;
        }).join('')}</tbody></table></div>`;

        const mobileCards = `<div class="d-block d-md-none inventory-cards-wrapper">${pageItems.map(item => {
            const qty = parseInt(item.quantity) || 0;
            return `<div class="inventory-card-mobile"><div class="inventory-card-header"><img src="${getDirectDriveUrl(item.imageUrl)}" class="inventory-card-img" onerror="handleImageError(this, '${item.imageUrl}')"><div style="flex:1;"><h6 class="mb-0">${escapeHtml(item.itemName)}</h6><small class="text-muted d-block">Serial: <code>${item.serialNumber || 'N/A'}</code></small>${getStatusBadge(qty)}</div></div><div class="mb-2"><span class="badge bg-light text-secondary border me-1">${escapeHtml(item.category || 'General')}</span></div><p class="small text-secondary mb-3">${escapeHtml(item.description || 'No description.')}</p><div class="d-flex justify-content-between align-items-center bg-light p-2 rounded mb-3"><span class="small text-muted">Current Quantity:</span><span class="fw-bold ${qty <= 5 ? 'text-danger' : 'text-success'}">${qty} Units</span></div><button class="primary-btn blue w-100" style="height:36px; min-height:36px; font-size:12px;" onclick="showItemDetail('${item.serialNumber}', ${JSON.stringify(item).replace(/"/g, '&quot;')})">View Details</button></div>`;
        }).join('')}</div>`;

        container.innerHTML = desktopTable + mobileCards;
        renderPaginationControls('admin-inventory-pagination', adminInventoryState, renderMasterInventory);
    } catch (err) {
        container.innerHTML = `<div class="alert alert-danger text-center">Failed to load data: ${err.message}</div>`;
    }
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
        auditLedgerState.allItems = auditLedgerState.filtered = ledgerData;
        renderAuditLedger();
    });
}

function renderAuditLedger() {
    const list = $('admin-audit-ledger-list'); if (!list) return;
    list.innerHTML = '';
    const start = (auditLedgerState.currentPage - 1) * PAGE_SIZE; const end = start + PAGE_SIZE;
    const pageItems = auditLedgerState.filtered ? auditLedgerState.filtered.slice(start, end) : [];
    if (pageItems.length === 0) { list.innerHTML = '<tr><td colspan="6" style="text-align:center;">No movements.</td></tr>'; return; }
    pageItems.forEach(row => {
        const tr = document.createElement('tr');
        const serial = row.item ? row.item.match(/\((.*?)\)/)?.[1] : null;
        let stockBalance = (row.stockBalance !== undefined && row.stockBalance !== null && row.stockBalance !== 'N/A')
            ? row.stockBalance : (row.remainingQty !== undefined ? row.remainingQty : (row.currentQty !== undefined ? row.currentQty : 'N/A'));

        if (stockBalance === 'N/A' && serial) {
            const it = Object.values(inventoryData).find(i => i.serialNumber === serial);
            if (it) stockBalance = it.quantity;
        }

        const statusBadge = row.status === 'Pending Approval' ? 'bg-warning' : row.status === 'Approved' ? 'bg-info' : 'bg-success';
        tr.innerHTML = `<td>${new Date(row.timestamp).toLocaleString()}</td><td>${escapeHtml(row.teacher)}</td><td>${escapeHtml(row.item)}</td><td><strong>${row.qty}</strong></td><td><span class="badge bg-secondary fs-6">${stockBalance}</span></td><td><span class="badge ${statusBadge}">${row.status}</span></td>`;
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
        teacherOrdersState.allItems = teacherOrdersState.filtered = entries.filter(([id, o]) => o.teacherUid === adec);
        renderTeacherOrderHistory();
    });
}

function renderTeacherOrderHistory() {
    const list = $('teacher-history-list'); const cards = $('teacher-history-cards'); if (!list || !cards) return;
    list.innerHTML = ''; cards.innerHTML = '';
    const start = (teacherOrdersState.currentPage - 1) * PAGE_SIZE; const end = start + PAGE_SIZE;
    const pageItems = teacherOrdersState.filtered.slice(start, end);
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