// Firebase SDK imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getDatabase, ref, get, child, set, push, onValue, update, remove } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-analytics.js";

// Firebase configuration
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

// ==================== STATE ====================
let currentUser = null;
let cart = {};
let inventoryData = {};
let adminPad = null;
let teacherPad = null;
let activeHandoverRequestId = null;
let systemCategories = [];
const alertedRequests = new Set();
let unsubscribeListeners = [];

// ==================== UTILITIES ====================

// Fix: Universal Google Drive Direct Link Converter Helper
function getDirectDriveUrl(url) {
    if (!url) return 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNTAiIGhlaWdodD0iMTUwIiB2aWV3Qm94PSIwIDAgMTUwIDE1MCI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iI2YxZjUfOSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjE0IiBmaWxsPSIjOTRhM2I4IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg==';
    if (url.startsWith('data:image')) return url; // Already Base64

    let fileId = '';
    if (url.includes('/file/d/')) {
        fileId = url.split('/file/d/')[1].split('/')[0];
    } else if (url.includes('id=')) {
        fileId = url.split('id=')[1].split('&')[0];
    }

    if (fileId) {
        // lh3.googleusercontent.com works universally for direct image rendering
        return `https://lh3.googleusercontent.com/d/${fileId}`;
    }
    return url;
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
    setTimeout(() => toast.classList.add('show'), 10);
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
    unsubscribeListeners.forEach(unsub => {
        try { unsub(); } catch (e) { }
    });
    unsubscribeListeners = [];
}

// ==================== MAIN LIFECYCLE ====================
document.addEventListener('DOMContentLoaded', () => {
    console.log("App Initialized. Setting up event listeners...");

    // DOM Element Queries
    const loginForm = document.getElementById('login-form');
    const bypassAdminBtn = document.getElementById('bypass-admin-btn');
    const logoutBtns = document.querySelectorAll('.logout-btn');

    const inventoryForm = document.getElementById('add-inventory-form');
    const categorySelect = document.getElementById('inv-category');
    const serialNumberInput = document.getElementById('inv-serial-number');

    const cartBtn = document.getElementById('cart-btn');
    const closeCartBtn = document.getElementById('close-cart-btn');
    const submitRequisitionBtn = document.getElementById('submit-requisition-btn');
    const stationerySearch = document.getElementById('stationery-search');
    const adminInventorySearch = document.getElementById('admin-inventory-search');

    const exportInventoryBtn = document.getElementById('export-inventory-btn');
    const exportHistoryBtn = document.getElementById('export-history-btn');

    const closeNotificationBtn = document.getElementById('close-notification-btn');
    const closeHandoverModalBtn = document.getElementById('close-handover-modal-btn');
    const completeOrderBtn = document.getElementById('complete-order-btn');
    const closeOrderDetailBtn = document.getElementById('close-order-detail-btn');

    // --- Tab Navigation Logic ---
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

    // --- Google Drive Connector Logic ---
    const appsScriptInput = document.getElementById('apps-script-url');
    const saveAppsScriptBtn = document.getElementById('save-apps-script-url');
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
            const adecNumber = document.getElementById('adec-number').value.trim();
            const password = document.getElementById('password').value;
            const loginError = document.getElementById('login-error');
            const loginBtn = document.getElementById('login-btn');

            if (!adecNumber || !password) return;
            loginBtn.disabled = true;

            try {
                const snapshot = await get(child(ref(db), `users/${adecNumber}`));
                if (snapshot.exists()) {
                    const userData = snapshot.val();
                    if (userData.password === password) {
                        localStorage.setItem('stationery_user_adec', adecNumber);
                        handleUserRole(adecNumber);
                        if (loginError) loginError.textContent = "";
                    } else {
                        if (loginError) loginError.textContent = "Invalid password.";
                    }
                } else {
                    if (loginError) loginError.textContent = "ADEC Pass Number not found.";
                }
            } catch (err) {
                console.error("Login Error:", err);
                if (loginError) loginError.textContent = "Connection error.";
            } finally {
                loginBtn.disabled = false;
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
            showView('login-view');
        });
    });

    const savedAdec = localStorage.getItem('stationery_user_adec');
    if (savedAdec) handleUserRole(savedAdec);
    else showView('login-view');

    // --- Forms ---
    if (inventoryForm) inventoryForm.addEventListener('submit', (e) => { e.preventDefault(); saveInventoryItem(); });
    if (categorySelect) {
        categorySelect.addEventListener('change', () => {
            const customGroup = document.getElementById('custom-category-group');
            if (customGroup) customGroup.style.display = categorySelect.value === 'Other' ? 'block' : 'none';
        });
    }
    if (serialNumberInput) {
        serialNumberInput.addEventListener('input', () => {
            const serial = serialNumberInput.value.trim();
            if (serial) {
                try { JsBarcode("#barcode", serial, { format: "CODE128", displayValue: true, fontSize: 16 }); } catch (e) { }
            } else { document.getElementById('barcode').innerHTML = ''; }
        });
    }

    // --- Teacher Catalog & Cart ---
    if (cartBtn) {
        cartBtn.addEventListener('click', () => {
            document.getElementById('cart-modal').classList.add('active');
            renderCart();
        });
    }
    if (closeCartBtn) closeCartBtn.addEventListener('click', () => document.getElementById('cart-modal').classList.remove('active'));
    if (submitRequisitionBtn) submitRequisitionBtn.addEventListener('click', submitRequisitionRequest);
    if (stationerySearch) stationerySearch.addEventListener('input', renderInventory);
    if (adminInventorySearch) adminInventorySearch.addEventListener('input', renderMasterInventory);

    // --- Modals ---
    if (closeNotificationBtn) closeNotificationBtn.addEventListener('click', () => document.getElementById('notification-modal').classList.remove('active'));
    if (closeHandoverModalBtn) closeHandoverModalBtn.addEventListener('click', () => document.getElementById('handover-modal').classList.remove('active'));
    if (completeOrderBtn) completeOrderBtn.addEventListener('click', completeHandoverAction);
    if (closeOrderDetailBtn) closeOrderDetailBtn.addEventListener('click', () => document.getElementById('order-detail-modal').classList.remove('active'));

    // --- Export & Branding ---
    if (exportInventoryBtn) exportInventoryBtn.addEventListener('click', exportInventory);
    if (exportHistoryBtn) exportHistoryBtn.addEventListener('click', exportHistory);
    document.getElementById('upload-branding-btn')?.addEventListener('click', () => {
        const file = document.getElementById('branding-logo-upload').files[0];
        if (file) uploadLogo(file);
    });
    document.getElementById('add-category-btn')?.addEventListener('click', () => {
        const name = document.getElementById('new-category-name').value.trim();
        if (name) addCategory(name);
    });

    // Signature Pads
    adminPad = setupSignaturePad('admin-canvas');
    teacherPad = setupSignaturePad('teacher-canvas');
    document.getElementById('clear-admin-sig-btn')?.addEventListener('click', () => adminPad?.clear());
    document.getElementById('clear-teacher-sig-btn')?.addEventListener('click', () => teacherPad?.clear());

    // --- Manage Staff Sub-Tab Toggling ---
    const btnShowProvision = document.getElementById('btn-show-provision');
    const btnShowDirectory = document.getElementById('btn-show-directory');
    const provisionView = document.getElementById('staff-provision-view');
    const directoryView = document.getElementById('staff-list-view');

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

// ==================== CORE LOGIC ====================

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
                listenToMyOrders(adecNumber);
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
}

async function logActivity(action, details) {
    const user = currentUser ? (currentUser.name || currentUser.adecPassNumber) : "System";
    try { await push(ref(db, 'audit_logs'), { timestamp: new Date().toISOString(), user, action, details }); } catch (e) { }
}

function initAdminDashboards() {
    fetchAdminOrders();
    fetchMasterInventory();
    fetchOrderHistoryForAnalytics();
    fetchStaffList();
    updateDriveStatus();
}

// ==================== INVENTORY ====================

async function saveInventoryItem() {
    const btn = document.getElementById('save-inventory-btn');
    const msg = document.getElementById('form-message');
    const appsScriptUrl = localStorage.getItem('google_apps_script_url');
    if (!appsScriptUrl) return showToast("Set Apps Script URL in Google Drive tab", 'error');

    btn.disabled = true;
    msg.textContent = "Uploading to Google Drive...";

    try {
        const cat = document.getElementById('inv-category').value;
        const category = cat === 'Other' ? document.getElementById('inv-custom-category').value : cat;
        const name = document.getElementById('inv-item-name').value.trim();
        const desc = document.getElementById('inv-description').value.trim();
        const sn = document.getElementById('inv-serial-number').value.trim();
        const qty = parseInt(document.getElementById('inv-quantity').value);
        const openQty = parseInt(document.getElementById('inv-opening-quantity').value);
        const file = document.getElementById('inv-image').files[0];
        if (!file) throw new Error("Image required");

        const reader = new FileReader();
        const base64 = await new Promise((res, rej) => {
            reader.onload = () => res(reader.result);
            reader.onerror = rej;
            reader.readAsDataURL(file);
        });

        let imageUrl = base64;
        try {
            const corsResponse = await fetch(appsScriptUrl, { method: 'POST', body: JSON.stringify({ fileData: base64, fileName: `${sn}.jpg`, mimeType: file.type }) });
            const result = await corsResponse.json();
            if (result.status === 'success') imageUrl = result.url;
        } catch (e) { console.warn("Using Base64 fallback"); }

        const id = push(ref(db, 'inventory')).key;
        await set(ref(db, `inventory/${id}`), { category, itemName: name, description: desc, serialNumber: sn, quantity: qty, openingQuantity: openQty, imageUrl: imageUrl, createdAt: new Date().toISOString(), barcodeString: sn });
        await logActivity("Inventory Added", `Item: ${name}, Qty: ${qty}`);
        msg.textContent = "Saved Successfully!";
        msg.className = "message success";
        document.getElementById('add-inventory-form').reset();
        document.getElementById('barcode').innerHTML = '';
        showToast("Inventory item saved!");
    } catch (e) {
        msg.textContent = "Error: " + e.message;
        msg.className = "message error";
    } finally { btn.disabled = false; }
}

function fetchInventory() { addListener(ref(db, 'inventory'), (snapshot) => { inventoryData = snapshot.val() || {}; renderInventory(); }); }

function fetchMasterInventory() {
    addListener(ref(db, 'inventory'), (snapshot) => {
        inventoryData = snapshot.val() || {};
        renderMasterInventory();
    });
}

function renderInventory() {
    const list = document.getElementById('stationery-list');
    if (!list) return;
    const search = (document.getElementById('stationery-search')?.value || '').toLowerCase().trim();
    list.innerHTML = '';

    Object.entries(inventoryData).forEach(([id, data]) => {
        if (search && !data.itemName.toLowerCase().includes(search) && !data.serialNumber.toLowerCase().includes(search)) return;
        const card = document.createElement('div');
        card.className = 'inventory-card product-card';
        const qty = parseInt(data.quantity) || 0;

        card.innerHTML = `
            <div class="card product-card">
               <img src="${getDirectDriveUrl(data.imageUrl)}" alt="${escapeHtml(data.itemName)}" style="height: 150px; object-fit: contain; width: 100%; background: #f9f9f9; padding: 10px;" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNTAiIGhlaWdodD0iMTUwIiB2aWV3Qm94PSIwIDAgMTUwIDE1MCI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iI2YxZjUfOSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjE0IiBmaWxsPSIjOTRhM2I4IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg=='" />
               <div class="card-body" style="padding: 15px;">
                 <h5 class="card-title" style="margin: 0; font-size: 18px;">${escapeHtml(data.itemName)}</h5>
                 <p class="card-text text-muted small" style="margin: 5px 0;">SN: ${escapeHtml(data.serialNumber || 'N/A')}</p>
                 <p class="card-text" style="margin: 10px 0; font-size: 14px; color: #34495e;">${escapeHtml(data.description || '')}</p>
                 <p class="card-text font-weight-bold text-success" style="font-weight: bold; margin-bottom: 10px;">Stock: ${data.quantity}</p>
                 <button class="add-to-cart-btn primary-btn" ${qty <= 0 ? 'disabled' : ''} style="width: 100%;">Add to Cart</button>
               </div>
             </div>
        `;
        card.querySelector('.add-to-cart-btn').addEventListener('click', () => addToCart(id, data));
        list.appendChild(card);
    });
}

function renderMasterInventory() {
    const list = document.getElementById('master-inventory-list');
    if (!list) return;
    const search = (document.getElementById('admin-inventory-search')?.value || '').toLowerCase().trim();
    list.innerHTML = '';
    Object.values(inventoryData).forEach(item => {
        if (search && !item.itemName.toLowerCase().includes(search) && !(item.serialNumber || '').toLowerCase().includes(search)) return;
        const tr = document.createElement('tr');
        const qty = parseInt(item.quantity) || 0;
        if (qty < 5) tr.className = 'row-low-stock';
        tr.innerHTML = `<td>${escapeHtml(item.serialNumber)}</td><td>${escapeHtml(item.itemName)}</td><td>${escapeHtml(item.description)}</td><td>${item.openingQuantity || 0}</td><td>${qty} ${qty < 5 ? '<span class="badge-low-stock">Low</span>' : ''}</td><td><img src="${getDirectDriveUrl(item.imageUrl)}" class="inventory-thumb" loading="lazy"></td><td>${qty > 0 ? 'In Stock' : 'Out'}</td>`;
        list.appendChild(tr);
    });
}

// ==================== CART ====================

function addToCart(id, data) {
    const stock = parseInt(data.quantity) || 0;
    if (cart[id]) {
        if (cart[id].requestQuantity < stock) { cart[id].requestQuantity++; showToast(`${data.itemName} added`); }
        else showToast("Max stock reached", 'error');
    } else { cart[id] = { ...data, requestQuantity: 1 }; showToast("Added to cart"); }
    updateCartBadge();
}

function updateCartBadge() {
    const count = Object.values(cart).reduce((sum, item) => sum + item.requestQuantity, 0);
    if (document.getElementById('cart-count')) document.getElementById('cart-count').textContent = count;
}

function renderCart() {
    const container = document.getElementById('cart-items');
    if (!container) return;
    container.innerHTML = '';
    const items = Object.entries(cart);
    if (items.length === 0) { container.innerHTML = '<p style="text-align:center;color:#64748b;padding:20px;">Cart is empty.</p>'; return; }
    items.forEach(([id, item]) => {
        const div = document.createElement('div');
        div.className = 'cart-item';
        div.innerHTML = `<div class="cart-item-info"><strong>${escapeHtml(item.itemName)}</strong><small>SN: ${item.serialNumber}</small></div><div class="cart-item-controls"><button class="qty-btn minus" data-id="${id}">−</button><input type="number" class="qty-input" data-id="${id}" value="${item.requestQuantity}" min="1" max="${item.quantity}"><button class="qty-btn plus" data-id="${id}">+</button><button class="remove-item-btn" data-id="${id}">🗑️</button></div>`;
        container.appendChild(div);
    });
    container.querySelectorAll('.qty-btn.minus').forEach(b => b.addEventListener('click', () => { if (cart[b.dataset.id].requestQuantity > 1) { cart[b.dataset.id].requestQuantity--; renderCart(); updateCartBadge(); } }));
    container.querySelectorAll('.qty-btn.plus').forEach(b => b.addEventListener('click', () => { if (cart[b.dataset.id].requestQuantity < parseInt(cart[b.dataset.id].quantity)) { cart[b.dataset.id].requestQuantity++; renderCart(); updateCartBadge(); } else showToast("Max stock", 'error'); }));
    container.querySelectorAll('.remove-item-btn').forEach(b => b.addEventListener('click', () => { delete cart[b.dataset.id]; renderCart(); updateCartBadge(); }));
}

async function submitRequisitionRequest() {
    if (Object.keys(cart).length === 0) return showToast("Cart is empty", 'error');
    try {
        const items = Object.entries(cart).map(([id, item]) => ({ itemId: id, itemName: item.itemName, serial: item.serialNumber, requestQuantity: item.requestQuantity, imageUrl: item.imageUrl }));
        await push(ref(db, 'orders'), { teacherUid: currentUser.adecPassNumber, teacherName: currentUser.name, timestamp: new Date().toISOString(), items, status: 'Pending Approval' });
        await logActivity("Order Placed", `${items.length} items requested`);
        cart = {}; updateCartBadge();
        document.getElementById('cart-modal').classList.remove('active');
        showToast("Order Placed Successfully!");
    } catch (e) { showToast("Error: " + e.message, 'error'); }
}

// ==================== LIVE ORDERS & LIFECYCLE ====================

function fetchAdminOrders() {
    addListener(ref(db, 'orders'), (snapshot) => {
        const list = document.getElementById('admin-requests-list');
        const historyList = document.getElementById('admin-history-list');
        if (!list || !historyList) return;
        list.innerHTML = ''; historyList.innerHTML = '';
        const orders = Object.entries(snapshot.val() || {}).reverse();
        orders.forEach(([id, order]) => {
            if (order.status === 'Handover Complete / Done') {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${id.substring(0,8)}</td><td>${escapeHtml(order.teacherName)}</td><td>${new Date(order.timestamp).toLocaleDateString()}</td><td>${order.items.length} items</td><td><span class="badge bg-success">Done</span></td><td><button class="view-details-btn" data-id="${id}">View</button></td>`;
                tr.querySelector('button').addEventListener('click', () => viewOrderDetails(id));
                historyList.appendChild(tr);
            } else {
                const card = document.createElement('div');
                const statusClass = order.status === 'Pending Approval' ? 'bg-warning' : 'bg-info';
                card.className = 'request-card';
                card.innerHTML = `
                    <div class="request-header"><h4>${escapeHtml(order.teacherName)}</h4><span class="badge ${statusClass}">${order.status}</span></div>
                    <div class="request-items" style="display:flex; gap:10px; overflow-x:auto; padding:10px 0;">
                        ${order.items.map(i => `<div style="text-align:center;"><img src="${getDirectDriveUrl(i.imageUrl)}" width="40" height="40" class="inventory-thumb"><br><small>x${i.requestQuantity}</small></div>`).join('')}
                    </div>
                    <div class="request-actions" style="margin-top:10px">
                        ${order.status === 'Pending Approval' ? `<button class="action-btn prepare-btn">Approve</button>` : ''}
                        ${order.status === 'Approved' ? `<button class="action-btn handover-btn">Complete Handover & Sign</button>` : ''}
                    </div>
                `;
                card.querySelector('.prepare-btn')?.addEventListener('click', () => updateOrderStatus(id, 'Approved'));
                card.querySelector('.handover-btn')?.addEventListener('click', () => { activeHandoverRequestId = id; adminPad.clear(); teacherPad.clear(); document.getElementById('handover-modal').classList.add('active'); });
                list.appendChild(card);
            }
        });
    });
}

async function updateOrderStatus(id, status) {
    await update(ref(db, `orders/${id}`), { status });
    await logActivity("Status Updated", `Order ${id.substring(0,8)} to ${status}`);
    showToast(`Order ${status}`);
}

function listenToMyOrders(adec) {
    addListener(ref(db, 'orders'), (snap) => {
        const list = document.getElementById('teacher-history-list');
        if (list) list.innerHTML = '';
        const data = snap.val() || {};
        Object.entries(data).reverse().forEach(([id, order]) => {
            if (order.teacherUid === adec) {
                if (order.status === 'Approved' && !alertedRequests.has(id)) {
                    alertedRequests.add(id);
                    document.getElementById('notification-modal').classList.add('active');
                }
                const tr = document.createElement('tr');
                const statusBadge = order.status === 'Pending Approval' ? 'bg-warning' : (order.status === 'Approved' ? 'bg-info' : 'bg-success');
                tr.innerHTML = `
                    <td>${id.substring(0,8)}</td>
                    <td>${new Date(order.timestamp).toLocaleDateString()}</td>
                    <td>
                        <div style="display:flex; gap:5px;">
                            ${order.items.map(i => `<img src="${getDirectDriveUrl(i.imageUrl)}" width="30" height="30" class="inventory-thumb" title="${i.itemName}">`).join('')}
                        </div>
                    </td>
                    <td><span class="badge ${statusBadge}">${order.status}</span></td>
                    <td><button class="view-details-btn">View</button></td>
                `;
                tr.querySelector('button').addEventListener('click', () => viewOrderDetails(id));
                list.appendChild(tr);
            }
        });
    });
}

async function completeHandoverAction() {
    if (adminPad.isEmpty() || teacherPad.isEmpty()) return showToast("Both signatures required", 'error');
    const btn = document.getElementById('complete-order-btn');
    btn.disabled = true;
    try {
        const snap = await get(ref(db, `orders/${activeHandoverRequestId}`));
        const orderData = snap.val();
        for (const item of orderData.items) {
            const qtyRef = ref(db, `inventory/${item.itemId}/quantity`);
            const current = (await get(qtyRef)).val() || 0;
            await set(qtyRef, Math.max(0, current - item.requestQuantity));
        }

        // Upload signatures to Google Drive (Simulated via Base64 for now, can be routed to Apps Script)
        const signatures = { admin: adminPad.getDataUrl(), teacher: teacherPad.getDataUrl(), completedAt: new Date().toISOString() };

        await update(ref(db, `orders/${activeHandoverRequestId}`), { status: 'Handover Complete / Done', signatures });
        await logActivity("Order Finalized", `Order ID: ${activeHandoverRequestId.substring(0,8)}`);
        document.getElementById('handover-modal').classList.remove('active');
        showToast("Handover Complete!");
    } catch (e) { showToast(e.message, 'error'); }
    finally { btn.disabled = false; }
}

async function viewOrderDetails(id) {
    const snap = await get(ref(db, `orders/${id}`));
    const order = snap.val();
    const content = document.getElementById('order-detail-content');
    content.innerHTML = `
        <div style="text-align:center;margin-bottom:20px;"><h3>Requisition Receipt</h3><p>ID: ${id}</p></div>
        <p><strong>Teacher:</strong> ${escapeHtml(order.teacherName)}</p>
        <p><strong>Status:</strong> <span class="badge ${order.status === 'Handover Complete / Done' ? 'bg-success' : 'bg-info'}">${order.status}</span></p>
        <hr style="margin:15px 0; border:0; border-top:1px dashed #ddd;">
        <table class="history-table">
            <thead><tr><th>Image</th><th>Item</th><th>Qty</th></tr></thead>
            <tbody>${order.items.map(i => `<tr><td><img src="${getDirectDriveUrl(i.imageUrl)}" width="40" height="40" style="object-fit:contain;"></td><td>${escapeHtml(i.itemName)}</td><td>${i.requestQuantity}</td></tr>`).join('')}</tbody>
        </table>
        ${order.signatures ? `<div style="display:flex;gap:15px;margin-top:20px;"><div style="flex:1;text-align:center;border:1px solid #eee;padding:5px;"><small>Admin</small><br><img src="${order.signatures.admin}" style="width:100px;"></div><div style="flex:1;text-align:center;border:1px solid #eee;padding:5px;"><small>Teacher</small><br><img src="${order.signatures.teacher}" style="width:100px;"></div></div>` : ''}
    `;
    document.getElementById('order-detail-modal').classList.add('active');
}

// ==================== OTHER FEATURES ====================

function fetchAuditLogs() {
    addListener(ref(db, 'audit_logs'), (snap) => {
        const list = document.getElementById('audit-logs-list');
        if (!list) return; list.innerHTML = '';
        Object.values(snap.val() || {}).reverse().forEach(log => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${new Date(log.timestamp).toLocaleString()}</td><td>${escapeHtml(log.user)}</td><td>${escapeHtml(log.action)}</td><td>${escapeHtml(log.details)}</td>`;
            list.appendChild(tr);
        });
    });
}

function fetchStaffList() {
    addListener(ref(db, 'users'), (snapshot) => {
        const list = document.getElementById('admin-staff-list');
        if (!list) return; list.innerHTML = '';
        Object.entries(snapshot.val() || {}).forEach(([id, user]) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td><strong>${escapeHtml(user.adecPassNumber || id)}</strong></td><td>${escapeHtml(user.name)}</td><td><span class="badge bg-info">${user.role}</span></td><td><code>••••</code></td><td><button class="remove-item-btn" data-id="${id}">Delete</button></td>`;
            tr.querySelector('button').addEventListener('click', async () => { if(confirm("Delete user?")) { await remove(ref(db, `users/${id}`)); logActivity("Staff Removed", id); } });
            list.appendChild(tr);
        });
    });
}

async function updateDriveStatus() {
    const url = localStorage.getItem('google_apps_script_url');
    if (!url) return;
    try {
        const response = await fetch(url, { method: 'POST', body: JSON.stringify({ action: 'status' }) });
        const result = await response.json();
        const indicator = document.getElementById('drive-connection-indicator');
        const storageText = document.getElementById('drive-storage-text');
        const storageBar = document.getElementById('drive-storage-bar');
        if (result.status === 'success') {
            if (indicator) indicator.innerHTML = '<span style="color:#10b981;">🟢 Connected (Active)</span>';
            if (storageText) storageText.textContent = `${result.storageUsed || result.used || '0 MB'} / ${result.total || '15 GB'} Used`;
            if (storageBar) storageBar.style.width = result.percent || '0%';
        }
    } catch (e) { console.warn("Status check failed"); }
}

function fetchSystemBranding() { addListener(ref(db, 'settings/logo'), (snap) => { if (snap.val()) document.querySelectorAll('#school-logo').forEach(img => img.src = snap.val()); }); }
function fetchCategories() {
    addListener(ref(db, 'settings/categories'), (snap) => {
        const data = snap.val() || {};
        const select = document.getElementById('inv-category');
        if (select) {
            select.innerHTML = '<option value="" disabled selected>Select Category</option>';
            Object.values(data).forEach(name => { const opt = document.createElement('option'); opt.value = name; opt.textContent = name; select.appendChild(opt); });
            const otherOpt = document.createElement('option'); otherOpt.value = 'Other'; otherOpt.textContent = 'Other (Custom)'; select.appendChild(otherOpt);
        }
        const list = document.getElementById('system-categories-list');
        if (list) {
            list.innerHTML = '';
            Object.entries(data).forEach(([key, name]) => { const li = document.createElement('li'); li.className = 'category-item'; li.innerHTML = `<span>${escapeHtml(name)}</span><button class="delete-cat-btn" data-key="${key}">Delete</button>`; li.querySelector('button').addEventListener('click', () => deleteCategory(key)); list.appendChild(li); });
        }
    });
}

async function uploadLogo(file) {
    const reader = new FileReader();
    const base64 = await new Promise((res) => { reader.onload = () => res(reader.result); reader.readAsDataURL(file); });
    await set(ref(db, 'settings/logo'), base64);
    showToast("Logo Updated!");
}
async function addCategory(name) { await push(ref(db, 'settings/categories'), name); document.getElementById('new-category-name').value = ''; showToast("Category Added!"); }
async function deleteCategory(key) { if(confirm("Delete category?")) await set(ref(db, `settings/categories/${key}`), null); }

function setupSignaturePad(canvasId) {
    const canvas = document.getElementById(canvasId); if (!canvas) return null;
    const ctx = canvas.getContext('2d'); ctx.lineWidth = 2; ctx.lineCap = 'round';
    let drawing = false;
    const getPos = (e) => { const rect = canvas.getBoundingClientRect(); const clientX = e.touches ? e.touches[0].clientX : e.clientX; const clientY = e.touches ? e.touches[0].clientY : e.clientY; return { x: (clientX - rect.left) * (canvas.width/rect.width), y: (clientY - rect.top) * (canvas.height/rect.height) }; };
    const start = (e) => { drawing = true; const p = getPos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); e.preventDefault(); };
    const move = (e) => { if(!drawing) return; const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); e.preventDefault(); };
    const stop = () => { drawing = false; };
    canvas.addEventListener('mousedown', start); canvas.addEventListener('mousemove', move); canvas.addEventListener('mouseup', stop);
    canvas.addEventListener('touchstart', start, {passive:false}); canvas.addEventListener('touchmove', move, {passive:false}); canvas.addEventListener('touchend', stop);
    return { clear: () => ctx.clearRect(0,0, canvas.width, canvas.height), isEmpty: () => { const data = ctx.getImageData(0,0, canvas.width, canvas.height).data; return !data.some(c => c !== 0); }, getDataUrl: () => canvas.toDataURL() };
}

async function exportInventory() {
    const data = Object.values((await get(ref(db, 'inventory'))).val() || {}).map(i => ({ 'Serial': i.serialNumber, 'Name': i.itemName, 'Current Qty': i.quantity, 'Open Qty': i.openingQuantity }));
    const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Inventory"); XLSX.writeFile(wb, `Inventory_${Date.now()}.xlsx`);
}

async function exportHistory() {
    const data = []; Object.values((await get(ref(db, 'orders'))).val() || {}).forEach(o => { o.items.forEach(i => { data.push({ 'Teacher': o.teacherName, 'Item': i.itemName, 'Qty': i.requestQuantity, 'Date': o.timestamp }); }); });
    const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Order_History"); XLSX.writeFile(wb, `History_${Date.now()}.xlsx`);
}
