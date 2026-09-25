// Firebase SDK imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getDatabase, ref, get, child, set, push, onValue, update, remove } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-analytics.js";

// Define Current App Version
const APP_VERSION = "1.8.42";

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
try { getAnalytics(app); } catch (e) { console.warn("Analytics blocked"); }

// ==================== IMAGE UTILITIES ====================
function isValidImageUrl(url) {
    if (!url) return false;
    const cleanUrl = String(url).trim().toLowerCase();
    return cleanUrl !== '' && cleanUrl !== 'undefined' && cleanUrl !== 'null' && cleanUrl !== '[object object]';
}

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
            const txnResult = await new Promise((resolve) => {
                let resolved = false;
                const txn = onValueOnce(invRef, (snapshot) => {}, () => {});
            });

            // Use the Firebase v9 modular transaction via runTransaction-equivalent
            const { runTransaction } = await import("https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js");

            const txnResult2 = await runTransaction(invRef, (currentData) => {
                if (currentData === null) {
                    console.warn(`Inventory node not found for SN: ${serialNo}`);
                    return currentData; // abort
                }

                const currentQty = parseInt(
                    currentData.quantity ??
                    currentData.availableStock ??
                    currentData.currentStock ??
                    currentData.stock ??
                    0,
                    10
                );

                const newQty = Math.max(0, currentQty - qtyIssued);

                currentData.quantity = newQty;
                currentData.availableStock = newQty;
                currentData.currentStock = newQty;
                currentData.stock = newQty;

                // Deduct from sub-batches FIFO if present
                if (currentData.batches && typeof currentData.batches === 'object') {
                    let remainingToDeduct = qtyIssued;
                    const batchKeys = Object.keys(currentData.batches);
                    for (const bKey of batchKeys) {
                        if (remainingToDeduct <= 0) break;
                        const batch = currentData.batches[bKey];
                        if (!batch || typeof batch !== 'object') continue;

                        const batchQty = parseInt(
                            batch.currentStock ?? batch.quantity ?? batch.initialQty ?? 0,
                            10
                        );
                        if (batchQty <= 0) continue;

                        const deductFromBatch = Math.min(batchQty, remainingToDeduct);
                        const newBatchQty = batchQty - deductFromBatch;
                        batch.currentStock = newBatchQty;
                        batch.quantity = newBatchQty;
                        remainingToDeduct -= deductFromBatch;
                    }
                }

                return currentData;
            });

            if (txnResult2.committed) {
                deductionResults.push({ serialNo, qtyIssued, status: 'deducted' });
                console.log(`✅ Deducted ${qtyIssued} from SN: ${serialNo}`);
            } else {
                deductionResults.push({ serialNo, qtyIssued, status: 'not_found' });
                console.warn(`⚠️ Transaction aborted for SN: ${serialNo}`);
            }
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
    if (numericQty <= 0) return `<span class="badge bg-danger">Out of Stock</span>`;
    if (numericQty <= 5) return `<span class="badge bg-warning text-dark">Low Stock (${numericQty})</span>`;
    return `<span class="badge bg-success">In Stock</span>`;
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
                let html = '<h6 class="fw-bold mb-3 small text-muted">SELECT DISPATCH BATCH FOR EACH ITEM:</h6>';

                const items = Array.isArray(order.items) ? order.items : Object.values(order.items || {});

                items.forEach((item, index) => {
                    const optionsHTML = buildHandoverBatchOptions(item, fullInventory);
                    const reqQty = item.requestQuantity || item.quantity || item.reqQty || 1;

                    const itemSN = String(item.serialNumber || item.sn || item.barcode || item.itemId || item.id || '').trim();
                    const itemNameLower = String(item.itemName || item.name || '').trim().toLowerCase();
                    const matchedItem = (itemSN && fullInventory[itemSN]) ? fullInventory[itemSN] : Object.values(fullInventory).find(v => v && String(v.itemName || v.name || '').trim().toLowerCase() === itemNameLower);
                    const isTrulyOutOfStock = matchedItem ? (parseInt(matchedItem.quantity ?? matchedItem.availableStock ?? matchedItem.currentStock ?? 0, 10) <= 0) : false;

                    html += `
                        <div class="item-batch-row mb-3 p-2 border rounded bg-light">
                            <div class="d-flex justify-content-between mb-2">
                                <span class="fw-bold small">${index + 1}. ${escapeHtml(item.itemName || item.name)}</span>
                                <span class="badge bg-secondary">Req: ${reqQty}</span>
                            </div>
                            <select class="form-select form-select-sm handover-batch-dropdown batch-select" data-item-name="${escapeHtml(item.itemName || item.name)}" data-item-qty="${reqQty}" data-item-index="${index}" required>
                                ${optionsHTML}
                            </select>
                            ${isTrulyOutOfStock ? '<small class="text-danger mt-1 d-block">Error: Item is Out of Stock! (0 Pcs Available)</small>' : ''}
                        </div>
                    `;
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
        const dropdowns = document.querySelectorAll('.handover-batch-dropdown');
        let allSelected = true;
        dropdowns.forEach(d => { if (!d.value) allSelected = false; });

        if (!allSelected) {
            alert("Please select a valid stock batch for every item in this order.");
            return;
        }

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
                const signaturePayload = {
                    image: compressedSig,
                    filename: `Handover_${orderId}.jpg`,
                    folderType: 'signatures',
                    orderId: orderId,
                    issuedBy: adminName
                };
                const url = window.GOOGLE_SCRIPT_URL || localStorage.getItem('driveScriptUrl');
                if (url) {
                    const response = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                        body: JSON.stringify(signaturePayload)
                    });
                    const result = await response.json();
                    if (result.status === 'success') driveSignatureUrl = result.fileUrl;
                }
            } catch (e) {
                console.warn("Signature upload fallback:", e);
            }
        }

        // Build enriched items from dropdown selections
        const updatedItems = [];
        for (const drop of dropdowns) {
            const catName = drop.dataset.itemName;
            const batchId = drop.value;
            const qtyToDeduct = parseInt(drop.dataset.itemQty, 10) || 1;

            const selectedOption = drop.options[drop.selectedIndex];
            const selectedSn = selectedOption?.dataset?.sn || catName;

            updatedItems.push({
                itemName: catName,
                serialNumber: selectedSn,
                batchSerialNumber: batchId.startsWith('MAIN') ? selectedSn : batchId,
                requestQuantity: qtyToDeduct,
                selectedBatch: batchId
            });
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

        // Finalize order metadata
        await update(ref(db, `orders/${orderId}`), {
            handoverSignatureUrl: driveSignatureUrl,
            handedOverBy: adminName,
            issuedBy: adminName,
            status: 'Done'
        });

        const modalEl = document.getElementById('handoverModal');
        if (modalEl) {
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();
        }

        showToast("Handover Complete! Stock deducted once.", "success");
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
    console.log("--> Login attempt triggered!");

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
        console.log("Attempting user lookup for:", passNumber);
        const snapshot = await get(ref(db, 'users'));

        if (snapshot.exists()) {
            const users = snapshot.val();
            const matchedKey = Object.keys(users).find(key => key.toUpperCase() === passNumber);

            if (matchedKey) {
                const userData = users[matchedKey];
                const savedPassword = String(userData.password || "").trim();
                const inputPassword = String(password).trim();

                if (savedPassword === inputPassword) {
                    console.log("Login Successful for:", matchedKey);
                    localStorage.setItem('stationery_user_adec', matchedKey);
                    handleUserRole(matchedKey);
                    if (loginError) loginError.textContent = "";

                    const isEnrolled = window.isBiometricEnrolled();
                    const isSupported = await window.checkBiometricSupport();
                    if (!isEnrolled && isSupported) {
                        const enrollModal = new bootstrap.Modal($('biometricEnrollModal'));
                        enrollModal.show();
                        $('enable-biometric-btn').onclick = () => window.enrollBiometrics(matchedKey);
                    }
                } else {
                    alert("Incorrect Password.");
                }
            } else {
                alert("ADEK Pass Number not found.");
            }
        } else {
            alert("No registered users found.");
        }
    } catch (error) {
        console.error("Login Error:", error);
        try {
            const directSnap = await get(child(ref(db), `users/${passNumber}`));
            if (directSnap.exists()) {
                const userData = directSnap.val();
                if (userData.password === password) {
                    localStorage.setItem('stationery_user_adec', passNumber);
                    handleUserRole(passNumber);
                    return;
                }
            }
        } catch(e) {}
        alert("Login failed due to error: " + error.message);
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

window.uploadPhotoToGoogleDrive = async function(base64Image, fileName, folderType = 'product') {
    const url = window.GOOGLE_SCRIPT_URL || localStorage.getItem('driveScriptUrl');
    if (!url) {
        alert("Google Drive Connector URL missing! Please save valid URL in Admin Settings.");
        return null;
    }

    try {
        console.log("Compressing and uploading photo to Google Drive...");
        const compressed = await window.compressBase64Image(base64Image);

        const payload = {
            image: compressed,
            filename: fileName || `Item_${Date.now()}.jpg`,
            folderType: folderType
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
};

// ==================== SEED / CART ====================
async function seedDefaultCategoriesIfEmpty() {
    const categoriesRef = ref(db, 'settings/categories');
    const snapshot = await get(categoriesRef);
    if (!snapshot.exists()) {
        console.log("No categories found. Seeding default stationery categories...");
        const defaultCategories = [
            "Writing & Marking",
            "Paper & Registers",
            "Desk Tools & Adhesives",
            "Filing & Envelopes",
            "Classroom & Board Supplies",
            "Art & Craft"
        ];
        for (const cat of defaultCategories) {
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
        html += `<li class="list-group-item d-flex justify-content-between align-items-center py-3">
            <div class="d-flex align-items-center gap-3">
                <img src="${item.imageUrl || item.image || FALLBACK_IMG}" style="width: 50px; height: 50px; object-fit: contain;" class="rounded border">
                <div>
                    <h6 class="mb-0 fw-bold">${item.itemName || 'Stationery Item'}</h6>
                    <small class="text-muted">SN: ${item.serialNumber || 'N/A'}</small>
                </div>
            </div>
            <div class="d-flex align-items-center gap-3">
                <div class="input-group input-group-sm" style="width: 110px;">
                    <button class="btn btn-outline-secondary" onclick="window.updateCartQty(${index}, -1)">-</button>
                    <input type="text" class="form-control text-center bg-white" value="${item.requestQuantity || 1}" readonly>
                    <button class="btn btn-outline-secondary" onclick="window.updateCartQty(${index}, 1)">+</button>
                </div>
                <button class="btn btn-outline-danger btn-sm" onclick="window.removeFromCart(${index})">🗑️</button>
            </div>
        </li>`;
    });
    html += '</ul>';

    container.innerHTML = html;
};

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

    if (item.quantity && newQty > parseInt(item.quantity)) {
        showToast("Maximum stock reached", "error");
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
    window.loadCartFromStorage();
    seedDefaultCategoriesIfEmpty();
    initDriveConnector();
    listenAndPopulateCategories();

    window.addEventListener('resize', window.forceGlobalScrollUnlock);

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
    const exportInventoryBtn = $('export-inventory-btn');
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
        const customGroup = $('custom-category-group');
        if (customGroup) customGroup.style.display = categorySelect.value === 'Other' ? 'block' : 'none';
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

    if (exportInventoryBtn) exportInventoryBtn.onclick = exportInventory;
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
function fetchInventory() {
    addListener(ref(db, 'inventory'), (snapshot) => {
        const data = snapshot.val() || {};
        inventoryData = data;

        const categoriesForCatalog = Object.entries(data).map(([catId, catData]) => {
            if (!catData) return null;

            const batches = Object.values(catData.batches || {});
            let totalStock = batches.reduce((sum, b) => sum + (parseInt(b.currentStock ?? b.quantity) || 0), 0);
            if (batches.length === 0) {
                totalStock = parseInt(catData.quantity ?? catData.availableStock ?? catData.currentStock ?? 0, 10);
            }

            const firstImg = batches.find(b => b.imageUrl && b.imageUrl !== FALLBACK_IMG)?.imageUrl || catData.imageUrl || FALLBACK_IMG;
            const topSerial = batches[0]?.serialNumber || catData.serialNumber || 'N/A';
            const actualName = catData.itemName || catData.name || catId;

            let desc = catData.description || "";
            if (!desc && batches.length > 0 && batches[0]?.brandName) {
                desc = `Brand: ${batches[0].brandName}.`;
            } else if (!desc) {
                desc = "Stationery supplies.";
            }

            return {
                id: catId,
                data: {
                    itemName: actualName,
                    quantity: totalStock,
                    imageUrl: firstImg,
                    serialNumber: topSerial,
                    description: desc
                }
            };
        }).filter(Boolean);

        catalogState.allItems = categoriesForCatalog;
        window.allCatalogItems = categoriesForCatalog;
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

        const titleToDisplay = data.itemName && data.itemName !== 'Unnamed Item' ? data.itemName : (data.name || 'Stationery Item');
        const snToDisplay = data.serialNumber && data.serialNumber !== 'N/A' ? data.serialNumber : (data.sn || 'N/A');
        const productDesc = data.description || data.desc || '';

        card.innerHTML = `
            <div class="catalog-card" style="width: 100%; height: 100%; display: flex; flex-direction: column; background: #fff; padding: 12px;">
                <div class="card-img-wrapper" style="width: 100%; height: 130px; background: #f8f9fa; display: flex; align-items: center; justify-content: center; border-radius: 8px; overflow: hidden;">
                    <img src="${data.imageUrl || data.image || FALLBACK_IMG}"
                         alt="${escapeHtml(titleToDisplay)}"
                         style="max-width: 100%; max-height: 100%; object-fit: contain;"
                         onerror="this.onerror=null; this.src='${FALLBACK_IMG}';"
                         loading="lazy" />
                </div>
                <h4 class="card-item-name" style="font-weight: 700; color: #111; margin-top: 10px; margin-bottom: 2px; font-size: 1.1rem;">
                    ${escapeHtml(titleToDisplay)}
                </h4>
                <p class="card-item-sn" style="font-size: 0.85rem; color: #6c757d; margin-bottom: 6px;">
                    SN: ${escapeHtml(snToDisplay)}
                </p>
                <p class="card-item-desc" style="font-size: 0.85rem; color: #444; margin-bottom: 12px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; min-height: 2.4em;">
                    ${escapeHtml(productDesc)}
                </p>
                <button class="add-to-cart-btn w-100" style="margin-top: auto;" onclick="window.viewItemDetails('${id}')">View Details</button>
            </div>`;
        list.appendChild(card);
    });
    renderPaginationControls('stationery-list', catalogState, renderCatalogPage);
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

    if (productName === productSN && data.itemName !== productName) {
        productName = data.itemName || productName;
    }

    $('detail-item-title').innerText = productName;
    $('detail-item-name').innerText = productName;
    $('detail-item-sn').innerText = productSN;
    $('detail-item-description').innerText = "Description: " + productDesc;
    $('detail-item-stock').innerText = data.quantity || '0';

    const imgUrl = data.imageUrl || data.image || data.photoUrl;
    $('detail-item-image').src = getDirectDriveUrl(imgUrl) || FALLBACK_IMG;

    const addBtn = $('modal-add-to-cart-btn');
    if (addBtn) {
        addBtn.onclick = () => {
            const qty = parseInt($('modal-item-qty').value) || 1;
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

// ==================== ✅ FIXED: handleAddStockBatch (syncs parent totals) ====================
window.handleAddStockBatch = async function(e) {
    if (e) e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    if (btn) btn.disabled = true;

    try {
        const category = $('stock-category-name').value;
        const brand = $('stock-brand-name').value.trim();
        const sn = $('stock-serial-number').value.trim();
        const qty = parseInt($('stock-quantity').value) || 0;
        const date = $('stock-date').value;
        const supplier = $('stock-supplier').value.trim();
        const file = $('stock-image').files[0];

        if (!category || !sn || qty <= 0) throw new Error("Category, SN and Qty required");

        let imageUrl = FALLBACK_IMG;
        if (file) {
            showToast("Processing image...");
            const compressed = await window.compressAndScaleImage(file);
            const studio = await window.generateStudioProductPhoto(compressed);
            const driveUrl = await uploadPhotoToGoogleDrive(studio, `Stock_${sn}_${Date.now()}.jpg`);
            imageUrl = driveUrl || studio;
        }

        const batchId = sn.replace(/[.#$[\]]/g, "_");
        const batchData = {
            brandName: brand,
            serialNumber: sn,
            initialQty: qty,
            currentStock: qty,
            quantity: qty,
            receivedDate: date,
            supplier: supplier,
            imageUrl: imageUrl,
            createdAt: new Date().toISOString()
        };

        await set(ref(db, `inventory/${category}/batches/${batchId}`), batchData);

        // ✅ Recalculate and sync parent inventory totals
        const parentRef = ref(db, `inventory/${category}`);
        const parentSnap = await get(parentRef);
        if (parentSnap.exists()) {
            const parentData = parentSnap.val();
            const allBatches = parentData.batches || {};
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

        showToast(`Stock batch ${sn} added to ${category}!`);
        bootstrap.Modal.getInstance($('addStockModal'))?.hide();
        $('add-stock-form').reset();

    } catch (err) {
        alert("Error: " + err.message);
    } finally {
        if (btn) btn.disabled = false;
    }
};

window.startStockScanner = function() {
    currentOcrTarget = 'stock-serial-number';
    startOcrCamera();
};

// ==================== MASTER INVENTORY ====================
function fetchMasterInventory() {
    addListener(ref(db, 'inventory'), (snapshot) => {
        const data = snapshot.val() || {};
        inventoryData = data;
        renderMasterInventory();
    });
}

function renderMasterInventory() {
    const container = $('inventory-container');
    if (!container) return;

    try {
        const term = adminInventoryState.searchTerm;
        const catFilter = $('inventory-filter-category')?.value;

        let html = '';

        Object.entries(inventoryData).forEach(([catId, catData]) => {
            if (catFilter && catId !== catFilter) return;

            const batches = catData.batches || {};
            const batchEntries = Object.entries(batches);

            let totalStock = batchEntries.reduce((sum, [id, b]) => sum + (parseInt(b.currentStock) || 0), 0);
            if (batchEntries.length === 0 && (catData.quantity || catData.currentStock)) {
                totalStock = parseInt(catData.quantity || catData.currentStock || 0);
            }

            const itemNameDisplay = catData.itemName || catData.name || catId;

            const matchesTerm = !term ||
                                itemNameDisplay.toLowerCase().includes(term) ||
                                catId.toLowerCase().includes(term) ||
                                batchEntries.some(([id, b]) => (b.brandName || '').toLowerCase().includes(term) || (b.serialNumber || '').toLowerCase().includes(term));

            if (!matchesTerm) return;

            html += `
                <div class="card mb-4 border-0 shadow-sm overflow-hidden" style="border-radius: 12px;">
                    <div class="card-header bg-white py-3 inventory-item-header border-bottom">
                        <h5 class="mb-0 fw-bold text-primary inventory-item-title"><i class="bi bi-tag-fill me-2"></i>${escapeHtml(itemNameDisplay)}</h5>
                        <div class="inventory-item-actions d-flex align-items-center gap-3">
                            <span class="badge ${totalStock < 20 ? 'bg-danger' : 'bg-success'} total-stock-badge p-2 px-3 fs-6">
                                Total Stock: ${totalStock}
                            </span>
                            <button class="btn btn-sm btn-outline-primary fw-bold add-stock-btn" onclick="window.openAddStockModal('${escapeHtml(catId)}')">
                                + Add Stock
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
                                    <th class="text-center">Current Stock</th>
                                    <th class="text-center">Initial Qty</th>
                                    <th>Status</th>
                                    <th class="text-end">Actions</th>
                                </tr>
                            </thead>
                            <tbody>`;

            if (batchEntries.length === 0) {
                if (totalStock > 0) {
                    html += `
                        <tr>
                            <td data-label="Image"><img src="${FALLBACK_IMG}" class="rounded inventory-batch-thumb" data-url="${catData.imageUrl}" style="width: 40px; height: 40px; object-fit: contain; background: #f8f9fa;" loading="lazy"></td>
                            <td data-label="Brand / Manufacturer"><span class="fw-bold">Initial / Legacy Stock</span></td>
                            <td data-label="Serial / Batch No."><code>${escapeHtml(catData.serialNumber || 'N/A')}</code></td>
                            <td data-label="Received Date">${catData.createdAt ? catData.createdAt.split('T')[0] : 'N/A'}</td>
                            <td data-label="Current Stock" class="text-center"><span class="badge bg-light text-dark border">${totalStock}</span></td>
                            <td data-label="Initial Qty" class="text-center text-muted">${catData.openingQuantity || totalStock}</td>
                            <td data-label="Status">${getStatusBadge(totalStock)}</td>
                            <td data-label="Actions" class="text-end">
                                <span class="text-muted small">Legacy Record</span>
                            </td>
                        </tr>`;
                } else {
                    html += `<tr><td colspan="8" class="text-center py-4 text-muted italic empty-batch-cell">No active batches for this category.</td></tr>`;
                }
            } else {
                batchEntries.forEach(([batchId, batch]) => {
                    const cStock = parseInt(batch.currentStock) || 0;
                    html += `
                        <tr>
                            <td data-label="Image"><img src="${FALLBACK_IMG}" class="rounded inventory-batch-thumb" data-url="${batch.imageUrl}" style="width: 40px; height: 40px; object-fit: contain; background: #f8f9fa;" loading="lazy"></td>
                            <td data-label="Brand / Manufacturer"><span class="fw-bold">${escapeHtml(batch.brandName || '-')}</span></td>
                            <td data-label="Serial / Batch No."><code>${escapeHtml(batch.serialNumber)}</code></td>
                            <td data-label="Received Date">${batch.receivedDate || '-'}</td>
                            <td data-label="Current Stock" class="text-center"><span class="badge ${cStock < 10 ? 'bg-warning text-dark' : 'bg-light text-dark border'}">${cStock}</span></td>
                            <td data-label="Initial Qty" class="text-center text-muted">${batch.initialQty || '-'}</td>
                            <td data-label="Status">${getStatusBadge(cStock)}</td>
                            <td data-label="Actions" class="text-end">
                                <button class="btn btn-link btn-sm text-danger p-0 ms-2" onclick="window.deleteBatch('${escapeHtml(catId)}', '${batchId}')">Delete</button>
                            </td>
                        </tr>`;
                });
            }

            html += `</tbody></table></div></div>`;
        });

        if (!html) html = '<div class="text-center text-muted p-5 bg-light rounded">No inventory categories found matching filters.</div>';

        container.innerHTML = html;

        document.querySelectorAll('.inventory-batch-thumb').forEach(img => {
            if (img.dataset.url) window.loadCachedImage(img, img.dataset.url);
        });

    } catch (err) {
        console.error("Render Error:", err);
        container.innerHTML = `<div class="alert alert-danger">Error rendering inventory: ${err.message}</div>`;
    }
}

window.openAddStockModal = function(catName) {
    const modalEl = $('addStockModal');
    if (modalEl) {
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        if (catName) $('stock-category-name').value = catName;
        modal.show();
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
    const stock = parseInt(data.quantity) || 0;
    const existingItem = window.stationeryCart.find(i => i.id === id);

    if (existingItem) {
        if (existingItem.requestQuantity + customQty <= stock) {
            existingItem.requestQuantity += customQty;
            showToast(`Updated ${data.itemName} quantity`);
        } else {
            showToast("Insufficient stock available", 'error');
            return;
        }
    } else {
        window.stationeryCart.push({
            id,
            itemName: data.itemName,
            serialNumber: data.serialNumber,
            quantity: data.quantity,
            imageUrl: data.imageUrl,
            requestQuantity: customQty
        });
        showToast(`${data.itemName} added to cart!`);
    }
    window.saveCartToStorage();
}

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
            const uploadedUrl = await uploadPhotoToGoogleDrive(compressedSig, `TeacherSign_${orderId}.jpg`, 'signatures');
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
        const isApproved = order.status.includes("Approved") || order.status.includes("Ready") || order.status.includes("Completed") || order.status === "Done";
        const statusBadge = isApproved ? 'bg-success' : 'bg-warning text-dark';

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
            <td><button class="view-details-btn">View Voucher</button></td>`;

        tr.querySelector('button').onclick = () => window.viewOrderReceipt(id);
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
            <button class="primary-btn blue omc-view-btn">View Receipt</button>`;
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

async function viewOrderDetails(id) {
    const snap = await get(ref(db, `orders/${id}`)); const order = snap.val();
    const content = $('order-detail-content');
    content.innerHTML = `<div style="text-align:center;margin-bottom:15px;"><h3>Requisition Receipt</h3><p>ID: ${id}</p></div><p><strong>Staff:</strong> ${escapeHtml(order.teacherName)} (${order.teacherUid})</p><table class="history-table" style="margin:15px 0;"><thead><tr><th>Item</th><th>Qty</th></tr></thead><tbody>${order.items.map(i => `<tr><td>${escapeHtml(i.itemName)}</td><td>${i.requestQuantity}</td></tr>`).join('')}</tbody></table>${order.signatures ? `<div class="order-detail-signatures"><div class="signature-display-box"><small>Admin</small><br><img src="${order.signatures.admin}"></div><div class="signature-display-box"><small>Staff</small><br><img src="${order.signatures.teacher}"></div></div>` : ''}`;
    $('order-detail-modal').classList.add('active');
}

// ==================== RECEIPT ====================
window.viewOrderReceipt = async function(orderId) {
    try {
        showToast("Generating Receipt...", "info");
        const snap = await get(ref(db, `orders/${orderId}`));
        if (!snap.exists()) throw new Error("Order not found");
        const order = snap.val();

        $('receipt-order-id').innerText = orderId;
        $('receipt-date').innerText = new Date(order.timestamp).toLocaleString();

        $('receipt-teacher-name').innerText = order.teacherName || "N/A";
        $('receipt-teacher-id').innerText = order.teacherUid || "N/A";

        $('receipt-issuer-name').innerText = order.issuedBy || order.handedOverBy || "Authorized Admin";
        $('receipt-pickup-location').innerText = order.pickupLocation || "Main Store";

        $('receipt-items-list').innerHTML = (order.items || []).map(item => {
            const itemImg = isValidImageUrl(item.imageUrl) ? item.imageUrl : (inventoryData[item.itemName]?.imageUrl || FALLBACK_IMG);
            return `
            <tr>
                <td class="text-center">
                    <img src="${FALLBACK_IMG}" class="receipt-thumb" data-url="${itemImg}" style="width: 60px; height: 50px; object-fit: contain; border-radius: 4px;" loading="lazy">
                </td>
                <td>
                    <div class="fw-bold">${escapeHtml(item.itemName)}</div>
                </td>
                <td class="text-center"><code>${item.batchSerialNumber || item.serial || item.serialNumber || '-'}</code></td>
                <td class="text-center fw-bold">${item.requestQuantity}</td>
            </tr>
        `}).join('');

        document.querySelectorAll('.receipt-thumb').forEach(img => {
            window.loadCachedImage(img, img.dataset.url);
        });

        $('receipt-teacher-sig').src = order.teacherRequestSignature || order.handoverSignature || "";
        $('receipt-admin-sig').src = order.handoverSignatureUrl || order.handoverSignature || "";

        bootstrap.Modal.getOrCreateInstance($('receiptModal')).show();
    } catch (e) {
        showToast(e.message, "error");
    }
};

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

        let optionsHtml = '<option value="" disabled selected>Select Category</option>';
        let filterOptionsHtml = '<option value="">All Categories</option>';
        if (list) list.innerHTML = '';

        if (snapshot.exists()) {
            const data = snapshot.val();
            Object.entries(data).forEach(([key, name]) => {
                optionsHtml += `<option value="${name}">${name}</option>`;
                filterOptionsHtml += `<option value="${name}">${name}</option>`;

                if (list) {
                    const li = document.createElement('li');
                    li.className = 'category-item';
                    li.innerHTML = `<span>${escapeHtml(name)}</span><button class="delete-cat-btn">Delete</button>`;
                    li.querySelector('button').onclick = async () => {
                        if(confirm(`Delete category "${name}"?`)) await set(ref(db, `settings/categories/${key}`), null);
                    };
                    list.appendChild(li);
                }
            });
        }

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

async function exportInventory() {
    const data = Object.values((await get(ref(db, 'inventory'))).val() || {}).map(i => ({
        'Serial': i.serialNumber,
        'Name': i.itemName,
        'Qty': i.quantity
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventory");
    XLSX.writeFile(wb, `Inv_${Date.now()}.xlsx`);
}

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
        if (!file) throw new Error("Image required");

        if (msg) msg.textContent = "Step 1: Compressing Image...";
        const compressedBase64 = await window.compressAndScaleImage(file);

        if (msg) msg.textContent = "Step 2: AI Enhancing Studio Background...";
        const studioPhotoBase64 = await window.generateStudioProductPhoto(compressedBase64);

        if (msg) msg.textContent = "Step 3: Uploading Studio Photo to Google Drive...";
        const driveUrl = await uploadPhotoToGoogleDrive(studioPhotoBase64, `${serialNumber}_${Date.now()}.jpg`, 'product');
        const finalImageUrl = driveUrl || studioPhotoBase64;

        const itemId = serialNumber.replace(/[.#$[\]]/g, "_");

        const initialBatchId = 'BATCH-' + Date.now().toString().slice(-6);
        const initialBatch = {
            batchNo: initialBatchId,
            brandName: 'Standard',
            serialNumber: serialNumber,
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