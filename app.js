// Firebase SDK imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getDatabase, ref, get, child, set, push, onValue, update, remove } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-analytics.js";

// Define Current App Version
const APP_VERSION = "1.4.3";

// Safe Version Check (Preserves Auth Keys)
(function safeVersionCheck() {
  const CURRENT_VER = APP_VERSION;
  const savedVer = localStorage.getItem('app_version');

  if (savedVer !== CURRENT_VER) {
    console.warn(`Upgrading app version to ${CURRENT_VER}`);
    if ('caches' in window) {
      caches.keys().then(names => names.forEach(name => caches.delete(name)));
    }
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
            for (let registration of registrations) registration.unregister();
        });
    }
    localStorage.setItem('app_version', CURRENT_VER);
    window.location.reload();
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

const catalogState = { allItems: [], filtered: [], currentPage: 1, searchTerm: '' };
const adminInventoryState = { allItems: [], filtered: [], currentPage: 1, searchTerm: '' };
const auditLedgerState = { allItems: [], filtered: [], currentPage: 1 };
const teacherOrdersState = { allItems: [], filtered: [], currentPage: 1 };

const alertedRequests = new Set();

const ADMIN_CREDENTIALS = {
    username: "Asif",
    password: "Asif8013@#$"
};

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

window.handleFinalHandover = async function(event, orderId) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    console.log("Initiating Batch-Aware Handover for Order:", orderId);
    window.activeHandoverRequestId = orderId;

    const summaryEl = $('handover-order-summary');
    const selectionEl = $('handover-batch-selection');

    if (selectionEl) selectionEl.innerHTML = '<div class="text-center p-3"><div class="spinner-border spinner-border-sm text-primary"></div> Loading batches...</div>';

    try {
        const snap = await get(ref(db, `orders/${orderId}`));
        if (snap.exists()) {
            const order = snap.val();
            if (summaryEl) {
                summaryEl.innerHTML = `
                    <div class="d-flex justify-content-between">
                        <span><strong>Staff:</strong> ${escapeHtml(order.teacherName)}</span>
                        <span class="badge bg-white text-primary border">${order.items?.length || 0} Items</span>
                    </div>
                `;
            }

            if (selectionEl) {
                let html = '<h6 class="fw-bold mb-3 small text-muted">SELECT DISPATCH BATCH FOR EACH ITEM:</h6>';

                for (const [index, item] of (order.items || []).entries()) {
                    const catSnap = await get(ref(db, `inventory/${item.itemName}`));
                    const batches = (catSnap.exists() && catSnap.val().batches) ? Object.entries(catSnap.val().batches) : [];

                    html += `
                        <div class="item-batch-row mb-3 p-2 border rounded bg-light">
                            <div class="d-flex justify-content-between mb-2">
                                <span class="fw-bold small">${index + 1}. ${escapeHtml(item.itemName)}</span>
                                <span class="badge bg-secondary">Req: ${item.requestQuantity}</span>
                            </div>
                            <select class="form-select form-select-sm handover-batch-dropdown" data-item-name="${escapeHtml(item.itemName)}" data-item-qty="${item.requestQuantity}" required>
                                <option value="" disabled selected>-- Choose Batch / SN --</option>
                                ${batches.map(([bid, b]) => {
                                    const available = parseInt(b.currentStock) || 0;
                                    const isDisabled = available < item.requestQuantity;
                                    return `<option value="${bid}" ${isDisabled ? 'disabled' : ''}>
                                        ${escapeHtml(b.brandName || 'Generic')} (SN: ${b.serialNumber}) - [Available: ${available}]
                                    </option>`;
                                }).join('')}
                            </select>
                            ${batches.length === 0 ? '<small class="text-danger mt-1 d-block">Error: No stock batches found for this item!</small>' : ''}
                        </div>
                    `;
                }
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
                const canvas = document.getElementById('handover-signature-pad');
                if (canvas) {
                    canvas.width = canvas.offsetWidth;
                    canvas.height = 200;
                    window.initSignaturePad(canvas);
                }
            });
            modalEl.setAttribute('data-listener-attached', 'true');
        }
    }
};

window.submitHandoverWithSignature = async function(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    const dropdowns = document.querySelectorAll('.handover-batch-dropdown');
    let allSelected = true;
    dropdowns.forEach(d => { if (!d.value) allSelected = false; });

    if (!allSelected) {
        alert("Please select a valid stock batch for every item in this order.");
        return;
    }

    if (!window.isSignatureProvided) {
        alert("Receiver signature is required to complete handover.");
        return;
    }

    const orderId = window.activeHandoverRequestId;
    const canvas = document.getElementById('handover-signature-pad');
    const base64Signature = canvas.toDataURL('image/png');
    const adminName = sessionStorage.getItem('userName') || (currentUser && currentUser.name) || 'Admin';

    try {
        showToast("Processing handover and updating stock...", "info");

        let driveSignatureUrl = base64Signature;
        try {
            const signaturePayload = {
                image: base64Signature,
                filename: `Handover_${orderId}.png`,
                folderType: 'signatures',
                orderId: orderId,
                issuedBy: adminName
            };
            const url = window.GOOGLE_SCRIPT_URL || localStorage.getItem('driveScriptUrl');
            if (url) {
                const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(signaturePayload) });
                const result = await response.json();
                if (result.status === 'success') driveSignatureUrl = result.fileUrl;
            }
        } catch (e) { console.warn("Signature upload fallback"); }

        const updatedItems = [];
        for (const drop of dropdowns) {
            const catName = drop.dataset.itemName;
            const batchId = drop.value;
            const qtyToDeduct = parseInt(drop.dataset.itemQty);

            const batchRef = ref(db, `inventory/${catName}/batches/${batchId}`);
            const batchSnap = await get(batchRef);

            if (batchSnap.exists()) {
                const bData = batchSnap.val();
                const newStock = Math.max(0, (parseInt(bData.currentStock) || 0) - qtyToDeduct);

                await update(batchRef, { currentStock: newStock });

                const allBatchesSnap = await get(ref(db, `inventory/${catName}/batches`));
                const totalCatStock = Object.values(allBatchesSnap.val() || {}).reduce((s, b) => s + (parseInt(b.currentStock) || 0), 0);

                updatedItems.push({
                    itemName: catName,
                    batchSerialNumber: bData.serialNumber,
                    brandName: bData.brandName,
                    requestQuantity: qtyToDeduct,
                    stockBalance: newStock,
                    totalCategoryStock: totalCatStock
                });
            }
        }

        await update(ref(db, `orders/${orderId}`), {
            status: 'Completed',
            handoverSignatureUrl: driveSignatureUrl,
            handedOverBy: adminName,
            issuedBy: adminName,
            completedAt: new Date().toISOString(),
            items: updatedItems
        });

        const modalEl = document.getElementById('handoverModal');
        if (modalEl) bootstrap.Modal.getInstance(modalEl).hide();

        showToast("Handover Complete!", "success");
        await logActivity("Handover Complete", `Order ${orderId} finalized by ${adminName}`);

    } catch (err) {
        console.error("Handover Crash:", err);
        alert("Transaction failed: " + err.message);
    }
};

// ==================== BIOMETRIC AUTHENTICATION ====================

const strToBuffer = (str) => new TextEncoder().encode(str);
const bufferToStr = (buf) => new TextDecoder().decode(buf);

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
                allowCredentials: [{
                    id: credId,
                    type: 'public-key',
                }],
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

        const list = $('receipt-items-list');
        list.innerHTML = (order.items || []).map(item => `
            <tr>
                <td class="text-center">
                    <img src="${getDirectDriveUrl(item.imageUrl)}" style="width: 50px; height: 40px; object-fit: contain; border-radius: 4px;">
                </td>
                <td>
                    <div class="fw-bold">${escapeHtml(item.itemName)}</div>
                    <small class="text-muted">${escapeHtml(item.brandName || '')}</small>
                </td>
                <td class="text-center"><code>${item.batchSerialNumber || item.itemSn || '-'}</code></td>
                <td class="text-center fw-bold">${item.requestQuantity}</td>
            </tr>
        `).join('');

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

// ==================== IMAGE & UI UTILITIES ====================

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
    if (imgElement.getAttribute('data-failed') === 'true') {
        return;
    }

    console.warn("Image Load Failed:", originalUrl);

    imgElement.setAttribute('data-failed', 'true');
    imgElement.onerror = null;

    imgElement.src = FALLBACK_IMG;

    imgElement.removeAttribute('data-retries');
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

// ==================== IMAGE PROCESSING UTILITIES ====================

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

// Direct Fail-Safe Login Function EXPOSED TO WINDOW
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

const originalOpenAdminPanelDirectly = window.openAdminPanelDirectly;
window.openAdminPanelDirectly = function() {
    if (typeof originalOpenAdminPanelDirectly === 'function') {
        try { originalOpenAdminPanelDirectly(); } catch (e) { console.error(e); }
    }
    setTimeout(window.wipeScrollLocks, 100);
    setTimeout(window.wipeScrollLocks, 500);
};

setInterval(() => {
    if (!document.querySelector('.modal.show') && document.body.classList.contains('modal-open')) {
        window.wipeScrollLocks();
    }
}, 1000);

// ==================== GOOGLE DRIVE CONNECTOR LOGIC ====================

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
        const response = await fetch(scriptUrl, {
            method: 'GET',
            mode: 'no-cors'
        });

        if (response.type === 'opaque' || response.ok) {
            updateDriveUIStatus(true, "Active (24/7)");
        } else {
            console.warn("Apps Script check returned status:", response.status);
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
    console.log("Uploading photo to Google Drive...");
    const payload = {
      image: base64Image,
      filename: fileName || `Item_${Date.now()}.jpg`,
      folderType: folderType
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
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

// ==================== MAIN LIFECYCLE ====================
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

document.addEventListener('DOMContentLoaded', () => {
    console.log("App Initialized");
    window.loadCartFromStorage();
    seedDefaultCategoriesIfEmpty();
    initDriveConnector();
    listenAndPopulateCategories();

    window.addEventListener('resize', window.forceGlobalScrollUnlock);
    document.addEventListener('DOMContentLoaded', window.forceGlobalScrollUnlock);

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
    const completeOrderBtn = $('complete-order-btn');
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
        window.scrollTo({ top: $('teacher-history-area').offsetTop - 100, behavior: 'smooth' });
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
                console.warn("Initial biometric unlock failed/canceled. Keeping user in view for manual override.");
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

    if (closeNotificationBtn) closeNotificationBtn.onclick = () => $('notification-modal').classList.remove('active');
    if (closeHandoverModalBtn) closeHandoverModalBtn.onclick = () => $('handover-modal').classList.remove('active');
    if (completeOrderBtn) completeOrderBtn.onclick = window.submitHandoverWithSignature;
    if (closeOrderDetailBtn) closeOrderDetailBtn.onclick = () => $('order-detail-modal').classList.remove('active');
    if (closeItemDetailBtn) closeItemDetailBtn.onclick = () => $('item-detail-modal').classList.remove('active');

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

// ==================== SCANNER / OCR (FIXED) ====================
async function initScanner() {
    if (!html5QrCode) html5QrCode = new Html5Qrcode("reader");
    const config = { fps: 10, qrbox: { width: 250, height: 150 }, aspectRatio: 1.0 };

    // FIX: Set container visibility with all necessary properties
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
    const scannerModal = $('ocr-scanner-modal');

    const constraintsList = [
        {
            video: {
                facingMode: "environment",
                width: { ideal: 1920, min: 1280 },
                height: { ideal: 1080, min: 720 }
            }
        },
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

        // FIX: Set container visibility FIRST with all necessary properties
        if (scannerModal) {
            scannerModal.classList.add('active');
            scannerModal.style.display = 'flex';
            scannerModal.style.visibility = 'visible';
            scannerModal.style.opacity = '1';
            scannerModal.style.zIndex = '1070';
            scannerModal.style.pointerEvents = 'auto';
        }

        // FIX: Attach stream and explicitly play
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
            console.log("Stopped camera track:", track.label);
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

// ==================== OCR CORE LOGIC ====================

function rotateCanvas(sourceCanvas, degrees) {
    if (degrees === 0) return sourceCanvas;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (degrees === 90 || degrees === 270) {
        canvas.width = sourceCanvas.height;
        canvas.height = sourceCanvas.width;
    } else {
        canvas.width = sourceCanvas.width;
        canvas.height = sourceCanvas.height;
    }
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(degrees * Math.PI / 180);
    ctx.drawImage(sourceCanvas, -sourceCanvas.width / 2, -sourceCanvas.height / 2);
    return canvas;
}

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
    const kernel = [ 0, -1, 0, -1, 5, -1, 0, -1, 0 ];
    const buff = new Uint8ClampedArray(data);
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            for (let c = 0; c < 3; c++) {
                let i = (y * width + x) * 4 + c;
                let val = buff[((y - 1) * width + (x - 1)) * 4 + c] * kernel[0] + buff[((y - 1) * width + x) * 4 + c] * kernel[1] + buff[((y - 1) * width + (x + 1)) * 4 + c] * kernel[2] + buff[(y * width + (x - 1)) * 4 + c] * kernel[3] + buff[(y * width + x) * 4 + c] * kernel[4] + buff[(y * width + (x + 1)) * 4 + c] * kernel[5] + buff[((y + 1) * width + (x - 1)) * 4 + c] * kernel[6] + buff[((y + 1) * width + x) * 4 + c] * kernel[7] + buff[((y + 1) * width + (x + 1)) * 4 + c] * kernel[8];
                data[i] = val;
            }
        }
    }
    ctx.putImageData(imgData, 0, 0);
    return canvas;
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

// ==================== ROLE / DASHBOARD ====================
window.renderDashboardForRole = function(userRole, adecNumber) {
    // Hide all main containers first
    document.querySelectorAll('.view, .dashboard-view').forEach(container => {
        container.classList.remove('active');
        container.classList.add('d-none');
        container.style.display = 'none';
    });

    // FORCE Side Menu Visibility on Dashboard Load (v1.4.2)
    const sidebar = $('side-drawer');
    if (sidebar) {
        sidebar.classList.remove('d-none');
        sidebar.style.display = 'flex';
        // Ensure overlay is cleaned up
        const overlay = $('drawer-overlay');
        if (overlay) overlay.classList.remove('active');
        sidebar.classList.remove('open');
    }

    // Role-specific Sidebar Menu Visibility
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

function initAdminDashboards() {
    try { fetchAdminOrders(); } catch (e) { }
    try { fetchMasterInventory(); } catch (e) { }
    try { fetchOrderHistoryForAnalytics(); } catch (e) { }
    try { fetchStaffList(); } catch (e) { }
    try { updateDriveStatus(); } catch (e) { }
    try { fetchAuditLedger(); } catch (e) { }
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

        const categoriesForCatalog = Object.entries(data).map(([catName, catData]) => {
            const batches = Object.values(catData.batches || {});
            const totalStock = batches.reduce((sum, b) => sum + (parseInt(b.currentStock) || 0), 0);

            const firstImg = batches.find(b => b.imageUrl && b.imageUrl !== FALLBACK_IMG)?.imageUrl || FALLBACK_IMG;

            return {
                id: catName,
                data: {
                    itemName: catName,
                    quantity: totalStock,
                    imageUrl: firstImg,
                    description: batches[0]?.brandName ? `Multiple brands available including ${batches[0].brandName}.` : "Stationery supplies."
                }
            };
        });

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
        card.innerHTML = `<div class="card-img-wrap skeleton"><img alt="" loading="lazy"></div><div class="card-body"><h3 class="card-title">${escapeHtml(data.itemName)}</h3><p class="serial">SN: ${escapeHtml(data.serialNumber || 'N/A')}</p><p class="description">${escapeHtml(data.description || '')}</p><button class="add-to-cart-btn" onclick="window.viewItemDetails('${id}')">View Details</button></div>`;
        attachSmartImage(card.querySelector('img'), data.imageUrl);
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
    const item = itemObj.data;

    $('detail-item-title').innerText = item.itemName || 'Item Details';
    $('detail-item-name').innerText = item.itemName || 'N/A';
    $('detail-item-sn').innerText = item.serialNumber || 'N/A';
    $('detail-item-description').innerText = item.description || 'No description available.';
    $('detail-item-stock').innerText = item.quantity || '0';
    $('detail-item-image').src = getDirectDriveUrl(item.imageUrl) || FALLBACK_IMG;

    const addBtn = $('modal-add-to-cart-btn');
    if (addBtn) {
        addBtn.onclick = () => {
            const qty = parseInt($('modal-item-qty').value) || 1;
            addToCart(itemId, item, qty);
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

window.showJanamKundaliModal = function(itemId, data, isAdmin = true) {
    console.log("Opening details for item ID:", itemId);
    const content = $('item-detail-content');
    if (!content) {
        alert("Item detail element not found in HTML.");
        return;
    }

    const itemData = data || inventoryData[itemId];
    if (!itemData) {
        console.warn("Item not found for ID:", itemId);
        return;
    }

    const isOut = (parseInt(itemData.quantity) || 0) <= 0;

    content.innerHTML = `
        <img class="item-detail-img" src="${FALLBACK_IMG}">
        <div class="item-detail-info">
            <span class="badge bg-info">${escapeHtml(itemData.category || 'General')}</span>
            <h3 id="detail-item-name">${escapeHtml(itemData.itemName)}</h3>
            <p><strong>SN:</strong> ${escapeHtml(itemData.serialNumber)}</p>
            <p><strong>Available Qty:</strong> <span id="detail-item-qty">${itemData.quantity}</span></p>
            <div class="item-detail-desc">${escapeHtml(itemData.description)}</div>

            <div id="modal-add-to-cart-container" class="item-detail-footer" style="${isAdmin ? 'display:none;' : 'display:flex;'}">
                <input type="number" id="detail-qty" value="1" min="1" max="${itemData.quantity}" style="width:70px; padding:8px; border-radius:6px; border:1px solid #ddd;">
                <button id="detail-add-btn" class="primary-btn green" style="flex:1;" ${isOut ? 'disabled' : ''}>
                    ${isOut ? 'Out of Stock' : 'Add to Cart'}
                </button>
            </div>
        </div>`;

    attachSmartImage(content.querySelector('img'), itemData.imageUrl);

    if (!isAdmin) {
        const addBtn = $('detail-add-btn');
        if (addBtn) {
            addBtn.onclick = () => {
                addToCart(itemId, itemData, parseInt($('detail-qty').value) || 1);
                $('item-detail-modal').classList.remove('active');
            };
        }
    }

    $('item-detail-modal').classList.add('active');
};

// ==================== BATCH INVENTORY LOGIC ====================

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
            receivedDate: date,
            supplier: supplier,
            imageUrl: imageUrl,
            createdAt: new Date().toISOString()
        };

        await set(ref(db, `inventory/${category}/batches/${batchId}`), batchData);

        showToast(`Stock batch ${sn} added to ${category}!`);
        bootstrap.Modal.getInstance($('addStockModal')).hide();
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

// ==================== MASTER INVENTORY (BATCH-AWARE) ====================
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

        Object.entries(inventoryData).forEach(([catName, catData]) => {
            if (catFilter && catName !== catFilter) return;

            const batches = catData.batches || {};
            const batchEntries = Object.entries(batches);

            // Calculate category total with fallback for v1.3.9
            let totalStock = batchEntries.reduce((sum, [id, b]) => sum + (parseInt(b.currentStock) || 0), 0);
            if (batchEntries.length === 0 && (catData.quantity || catData.currentStock)) {
                totalStock = parseInt(catData.quantity || catData.currentStock || 0);
            }

            const matchesTerm = !term ||
                                catName.toLowerCase().includes(term) ||
                                batchEntries.some(([id, b]) => (b.brandName || '').toLowerCase().includes(term) || (b.serialNumber || '').toLowerCase().includes(term));

            if (!matchesTerm) return;

            html += `
                <div class="card mb-4 border-0 shadow-sm overflow-hidden" style="border-radius: 12px;">
                    <div class="card-header bg-white py-3 inventory-item-header border-bottom">
                        <h5 class="mb-0 fw-bold text-primary inventory-item-title"><i class="bi bi-tag-fill me-2"></i>${escapeHtml(catName)}</h5>
                        <div class="inventory-item-actions d-flex align-items-center gap-3">
                            <span class="badge ${totalStock < 20 ? 'bg-danger' : 'bg-success'} total-stock-badge p-2 px-3 fs-6">
                                Total Stock: ${totalStock}
                            </span>
                            <button class="btn btn-sm btn-outline-primary fw-bold add-stock-btn" onclick="window.openAddStockModal('${escapeHtml(catName)}')">
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
                    // Render synthetic fallback batch row for legacy items
                    html += `
                        <tr>
                            <td data-label="Image"><img src="${getDirectDriveUrl(catData.imageUrl)}" class="rounded" style="width: 40px; height: 40px; object-fit: contain; background: #f8f9fa;"></td>
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
                            <td data-label="Image"><img src="${getDirectDriveUrl(batch.imageUrl)}" class="rounded" style="width: 40px; height: 40px; object-fit: contain; background: #f8f9fa;"></td>
                            <td data-label="Brand / Manufacturer"><span class="fw-bold">${escapeHtml(batch.brandName || '-')}</span></td>
                            <td data-label="Serial / Batch No."><code>${escapeHtml(batch.serialNumber)}</code></td>
                            <td data-label="Received Date">${batch.receivedDate || '-'}</td>
                            <td data-label="Current Stock" class="text-center"><span class="badge ${cStock < 10 ? 'bg-warning text-dark' : 'bg-light text-dark border'}">${cStock}</span></td>
                            <td data-label="Initial Qty" class="text-center text-muted">${batch.initialQty || '-'}</td>
                            <td data-label="Status">${getStatusBadge(cStock)}</td>
                            <td data-label="Actions" class="text-end">
                                <button class="btn btn-link btn-sm text-danger p-0 ms-2" onclick="window.deleteBatch('${escapeHtml(catName)}', '${batchId}')">Delete</button>
                            </td>
                        </tr>`;
                });
            }

            html += `</tbody></table></div></div>`;
        });

        if (!html) html = '<div class="text-center text-muted p-5 bg-light rounded">No inventory categories found matching filters.</div>';

        container.innerHTML = html;

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

window.deleteBatch = async function(catName, batchId) {
    if (confirm(`Are you sure you want to delete this specific batch from ${catName}?`)) {
        try {
            await remove(ref(db, `inventory/${catName}/batches/${batchId}`));
            showToast("Batch deleted successfully");
        } catch (e) {
            showToast("Delete failed", "error");
        }
    }
};

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
                const ts = new Date(order.timestamp);

                ledgerData.push({
                    orderId: id,
                    timestamp: order.timestamp,
                    date: ts.toLocaleDateString(),
                    time: ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                    teacherName: order.teacherName || "N/A",
                    teacherId: order.teacherUid || "N/A",
                    itemImageUrl: item.imageUrl || FALLBACK_IMG,
                    itemName: item.itemName || "N/A",
                    itemSn: item.batchSerialNumber || item.itemSn || 'N/A',
                    brandName: item.brandName || '-',
                    qtyIssued: item.requestQuantity || 0,
                    teacherSignatureUrl: order.teacherRequestSignature || (order.signatures ? order.signatures.teacher : null),
                    issuerName: order.issuedBy || order.handedOverBy || (order.status.includes('Done') ? "Admin" : "Pending"),
                    issuerSignatureUrl: order.handoverSignatureUrl || order.handoverSignature || (order.signatures ? order.signatures.admin : null),
                    stockBalance: item.stockBalance !== undefined ? item.stockBalance : (item.totalCategoryStock || 'N/A'),
                    status: order.status
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
            <td><img src="${getDirectDriveUrl(row.itemImageUrl)}" class="inventory-thumb" onerror="this.src='${FALLBACK_IMG}'"></td>
            <td>${escapeHtml(row.itemName)}</td>
            <td><code>${row.itemSn}</code></td>
            <td class="text-center"><strong>${row.qtyIssued}</strong></td>
            <td>${row.teacherSignatureUrl ? `<img src="${row.teacherSignatureUrl}" style="height:30px; background:#fff; border:1px solid #eee;">` : '-'}</td>
            <td>${escapeHtml(row.issuerName)}</td>
            <td>${row.issuerSignatureUrl ? `<img src="${row.issuerSignatureUrl}" style="height:30px; background:#fff; border:1px solid #eee;">` : '-'}</td>
            <td class="text-center"><span class="badge bg-secondary">${row.stockBalance}</span></td>
            <td><span class="badge ${statusBadge}">${row.status}</span></td>
        `;
        list.appendChild(tr);
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

            const imageId = workbook.addImage({
                buffer: arrayBuffer,
                extension: 'png',
            });
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
            const uploadedUrl = await uploadPhotoToGoogleDrive(signatureDataUrl, `TeacherSign_${orderId}.png`, 'signatures');
            if (uploadedUrl) driveSignatureUrl = uploadedUrl;
        } catch (uploadErr) {
            console.warn("Teacher signature upload failed, using local data:", uploadErr);
        }

        const items = window.stationeryCart.map(item => ({
            itemId: item.id,
            itemName: item.itemName,
            serial: item.serialNumber,
            requestQuantity: item.requestQuantity,
            imageUrl: item.imageUrl
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
            requestedAt: new Date().toISOString()
        };

        await set(ref(db, 'orders/' + orderId), orderData);
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
            if (order.status === 'Handover Complete / Done' || order.status === 'Completed') {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${id}</td><td>${escapeHtml(order.teacherName)}</td><td>${new Date(order.timestamp).toLocaleDateString()}</td><td><div class="it-wrap" style="display:flex;gap:4px;"></div></td><td><span class="badge bg-success">Done</span></td><td><button class="view-details-btn">View Voucher</button></td>`;
                const wrap = tr.querySelector('.it-wrap'); (order.items || []).slice(0, 3).forEach(it => { const img = document.createElement('img'); img.className = 'inventory-thumb'; wrap.appendChild(img); attachSmartImage(img, it.imageUrl); });
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
                        <img class="inventory-thumb" width="45" height="45" style="object-fit: contain;">
                        <div style="flex: 1; overflow: hidden;">
                            <h6 class="mb-0 small fw-bold text-truncate">${escapeHtml(it.itemName)}</h6>
                            <small class="text-muted d-block" style="font-size: 9px;">SN: ${it.serial}</small>
                        </div>
                        <span class="badge bg-primary" style="font-size: 9px;">x${it.requestQuantity}</span>
                    `;
                    wrap.appendChild(d); attachSmartImage(d.querySelector('img'), it.imageUrl);
                });

                list.appendChild(card);
            }
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
        showToast("Order approved successfully! User view maintained.", "success");
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
        const isApproved = order.status.includes("Approved") || order.status.includes("Ready") || order.status.includes("Completed");
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
        const cardItemsWrap = card.querySelector('.omc-items'); (order.items || []).slice(0, 3).forEach(it => { const img = document.createElement('img'); img.className='inventory-thumb'; cardItemsWrap.appendChild(img); attachSmartImage(img, it.imageUrl); });
        card.querySelector('.omc-view-btn').onclick = () => window.viewOrderReceipt(id);
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

function fetchSystemBranding() { addListener(ref(db, 'settings/logo'), (snap) => { if (snap.val()) document.querySelectorAll('#school-logo, .centered-school-logo, .sidebar-logo-img, .header-brand-logo').forEach(img => img.src = snap.val()); }); }

window.handleAddCategory = async function(event) {
    if (event) event.preventDefault();

    const categoryInput = $('category-name-input');
    if (!categoryInput) {
        console.error("Input element 'category-name-input' not found!");
        return;
    }

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
    const reader = new FileReader(); const base = await new Promise((res) => { reader.onload = () => res(reader.result); reader.readAsDataURL(file); });
    await set(ref(db, 'settings/logo'), base); showToast("Logo Updated!");
}

async function addCategory(name) { await push(ref(db, 'settings/categories'), name); $('category-name-input').value = ''; showToast("Added!"); }

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

window.uploadPhotoToGoogleDrive = async function(base64Image, fileName) {
  const url = window.GOOGLE_SCRIPT_URL || localStorage.getItem('driveScriptUrl');
  if (!url) {
      console.warn("Google Drive Script URL not configured.");
      return null;
  }

  try {
    console.log("Uploading photo to Google Drive...");
    const payload = {
      image: base64Image,
      filename: fileName || `Item_${Date.now()}.jpg`
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
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

        // --- BATCH INITIALIZATION (v1.3.9) ---
        const initialBatchId = 'BATCH-' + Date.now().toString().slice(-6);
        const initialBatch = {
            batchNo: initialBatchId,
            brandName: 'Standard',
            serialNumber: serialNumber,
            initialQty: currentQty,
            currentStock: currentQty,
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