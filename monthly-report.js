/* ==========================================================================
   Monthly Report (ADMIN) - v1.0.0   monthly-report.js
   Stationery issued per month: by Teacher, by Department/Designation, by Item  ->  Excel export.
   Fully separate from app.js: it only READS the "orders" node (and each teacher's "designation"),
   writes nothing, and adds one drawer button next to "Purchase Orders (Excel)".
   Counts only COMPLETED handovers (status Done). Month = handover date (completedAt).
   ========================================================================== */
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

const CFG = {
  apiKey: "AIzaSyC34JvIlqAC0Rqb9wBIed3kNdvrEpy16P8",
  authDomain: "stationery-control-system.firebaseapp.com",
  databaseURL: "https://stationery-control-system-default-rtdb.firebaseio.com",
  projectId: "stationery-control-system",
  storageBucket: "stationery-control-system.firebasestorage.app",
  messagingSenderId: "342613102896",
  appId: "1:342613102896:web:5ddd185f3d2085661278f5"
};

let db = null;
const S = { month: '', rows: [], teachers: {}, view: 'teacher', loading: false, err: '', sel: { teacher: '__all', dept: '__all', item: '__all' } };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (id) => document.getElementById(id);
const pad2 = (n) => String(n).padStart(2, '0');
const thisMonth = () => { const d = new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1); };
const monthName = (m) => { const [y, mo] = m.split('-').map(Number); return new Date(y, mo - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }); };

function start() {
  if (db) return;
  const apps = getApps();
  db = getDatabase(apps.length ? apps[0] : initializeApp(CFG, 'monthly-report'));
}

const isDone = (o) => /done|completed/i.test(String(o.status || '')) && !/cancel|reject/i.test(String(o.status || ''));
const qtyOf = (it) => {
  const n = parseInt(it.issuedQty ?? it.requestQuantity ?? it.quantity ?? 0, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/* ----------------------------- load + aggregate ----------------------------- */
async function load() {
  S.loading = true; S.err = ''; render();
  try {
    start();
    const snap = await get(ref(db, 'orders'));
    const all = snap.val() || {};
    const [y, mo] = S.month.split('-').map(Number);
    const from = new Date(y, mo - 1, 1).getTime(), to = new Date(y, mo, 1).getTime();
    const rows = [];
    const uids = new Set();
    Object.entries(all).forEach(([id, o]) => {
      if (!o || !isDone(o)) return;
      const when = new Date(o.completedAt || o.stockDeductedAt || o.timestamp || 0).getTime();
      if (!(when >= from && when < to)) return;
      const items = Array.isArray(o.items) ? o.items : Object.values(o.items || {});
      uids.add(String(o.teacherUid || ''));
      items.forEach((it) => {
        const q = qtyOf(it);
        if (!q) return;
        rows.push({
          orderId: id, date: new Date(when), uid: String(o.teacherUid || ''), teacher: o.teacherName || o.teacherUid || 'Unknown',
          dept: o.department || o.section || '', item: it.itemName || it.name || 'Item',
          serial: String(it.serialNumber || it.serial || it.itemId || ''), unit: it.unit || '', qty: q, issuedBy: o.issuedBy || o.handedOverBy || '', raw: it
        });
      });
    });
    // designation per teacher (reads only users/<id>/designation, never passwords)
    S.teachers = {};
    await Promise.all([...uids].filter(Boolean).map(async (u) => {
      try { const s = await get(ref(db, `users/${u.replace(/[.#$\[\]\/]/g, '_')}/designation`)); S.teachers[u] = s.exists() ? String(s.val()) : ''; }
      catch (e) { S.teachers[u] = ''; }
    }));
    rows.forEach((r) => { r.dept = r.dept || S.teachers[r.uid] || 'Teacher'; });
    S.rows = rows;
  } catch (e) {
    S.err = e && e.message ? e.message : 'Could not read orders';
    S.rows = [];
  }
  S.loading = false; render();
}

function group(keyFn, extra) {
  const m = new Map();
  S.rows.forEach((r) => {
    const k = keyFn(r);
    if (!m.has(k)) m.set(k, { key: k, qty: 0, orders: new Set(), items: new Map(), teachers: new Set(), meta: extra ? extra(r) : {} });
    const g = m.get(k);
    g.qty += r.qty; g.orders.add(r.orderId); g.teachers.add(r.uid || r.teacher);
    g.items.set(r.item, (g.items.get(r.item) || 0) + r.qty);
  });
  return [...m.values()].sort((a, b) => b.qty - a.qty);
}
const itemsText = (g, max) => {
  const arr = [...g.items.entries()].sort((a, b) => b[1] - a[1]);
  const shown = (max ? arr.slice(0, max) : arr).map(([n, q]) => `${n} ×${q}`).join(', ');
  return max && arr.length > max ? shown + ` +${arr.length - max} more` : shown;
};
const totals = () => ({ qty: S.rows.reduce((s, r) => s + r.qty, 0), orders: new Set(S.rows.map((r) => r.orderId)).size, teachers: new Set(S.rows.map((r) => r.uid || r.teacher)).size });

/* --------------------------------- UI --------------------------------------- */
const css = `
#mr-ov{position:fixed;inset:0;z-index:100000;background:#f1f5f9;overflow:auto;font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:#1e293b;padding:0 0 30px}
#mr-ov *{box-sizing:border-box}
.mr-head{position:sticky;top:0;z-index:2;background:#0f1a3a;color:#fff;display:flex;align-items:center;gap:10px;padding:12px 14px;padding-top:max(12px,env(safe-area-inset-top))}
.mr-head h2{font-size:1.05rem;font-weight:800;margin:0;flex:1}
.mr-x{background:rgba(255,255,255,.14);color:#fff;border:0;border-radius:10px;min-height:40px;padding:0 14px;font-weight:700;cursor:pointer}
.mr-wrap{max-width:980px;margin:0 auto;padding:12px 12px 0}
.mr-bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:6px 0 10px}
.mr-bar input[type=month]{min-height:44px;border:1px solid #cbd5e1;border-radius:10px;padding:0 12px;font-size:16px;background:#fff;color:#1e293b}
.mr-btn{border:1px solid #cbd5e1;background:#fff;color:#334155;border-radius:10px;min-height:44px;padding:0 16px;font-weight:700;font-size:14px;cursor:pointer}
.mr-btn.green{background:#16a34a;border-color:#16a34a;color:#fff}
.mr-btn[disabled]{opacity:.5;pointer-events:none}
.mr-tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}
.mr-tabs button{border:1px solid #cbd5e1;background:#fff;border-radius:999px;padding:7px 16px;font-weight:700;font-size:.82rem;cursor:pointer;color:#334155}
.mr-tabs button.on{background:#0f1a3a;border-color:#0f1a3a;color:#fff}
.mr-stats{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}
.mr-stat{flex:1;min-width:100px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px}
.mr-stat b{display:block;font-size:1.4rem}.mr-stat span{font-size:.75rem;color:#64748b}
.mr-tw{overflow-x:auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px}
.mr-tw table{width:100%;border-collapse:collapse;font-size:.85rem}
.mr-tw th,.mr-tw td{padding:9px 10px;text-align:left;border-bottom:1px solid #e2e8f0;vertical-align:top}
.mr-tw th{background:#f8fafc;color:#475569;font-weight:700;white-space:nowrap}
.mr-tw td.n{text-align:right;font-weight:700;white-space:nowrap}
.mr-sel{min-height:44px;border:1px solid #cbd5e1;border-radius:10px;padding:0 10px;font-size:15px;background:#fff;color:#1e293b;max-width:100%}
.mr-rowv{border:1px solid #93c5fd;background:#eff6ff;color:#1d4ed8;border-radius:8px;min-height:32px;padding:0 10px;font-size:.85rem;cursor:pointer}
.mr-empty{text-align:center;padding:34px 14px;color:#64748b;background:#fff;border:2px dashed #e2e8f0;border-radius:12px}
.mr-err{background:#fee2e2;color:#991b1b;border-radius:10px;padding:10px 12px;margin:8px 0;font-weight:600}
`;

function ensureCss() {
  if ($('mr-style')) return;
  const st = document.createElement('style'); st.id = 'mr-style'; st.textContent = css; document.head.appendChild(st);
}


/* ------------- voucher (printable form, no signatures) - follows the ACTIVE tab ------------- */
const VKEY = { teacher: (r) => r.uid || r.teacher, dept: (r) => r.dept, item: (r) => r.item };
const VWORD = { teacher: 'teacher', dept: 'department', item: 'item' };
function vGroups(view) {
  const m = new Map();
  S.rows.forEach((r) => { const k = VKEY[view](r); if (!m.has(k)) m.set(k, []); m.get(k).push(r); });
  return m;
}
function vLabel(view, k, rows) { return view === 'teacher' ? `${rows[0].teacher} (${k})` : k; }
function vSection(view, k, rows) {
  const r0 = rows[0];
  const data = rows.map((r) => ({ date: r.date.getTime(), item: r.item, serial: r.serial, unit: r.unit, qty: r.qty, orderId: r.orderId, uid: r.uid, teacher: r.teacher, dept: r.dept, raw: r.raw }));
  if (view === 'teacher') return { mode: 'teacher', id: k, info: { name: r0.teacher, uid: r0.uid || k, dept: r0.dept }, rows: data };
  if (view === 'dept') return { mode: 'dept', id: k, info: { dept: k }, rows: data };
  return { mode: 'item', id: k, info: { item: k, serial: r0.serial, unit: r0.unit }, rows: data };
}
function voucherBar() {
  if (S.loading || !S.rows.length) return '';
  const view = S.view, g = vGroups(view);
  const opts = [...g.entries()].map(([k, rows]) => [k, vLabel(view, k, rows)]).sort((a, b) => String(a[1]).localeCompare(String(b[1])));
  const cur = S.sel[view] || '__all';
  return `<div class="mr-bar" style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:10px">` +
    `<b style="font-size:.85rem">🧾 Voucher (${VWORD[view]}-wise)</b>` +
    `<select id="mr-sel" class="mr-sel"><option value="__all"${cur === '__all' ? ' selected' : ''}>All ${VWORD[view]}s (one page each)</option>` +
    opts.map(([k, l]) => `<option value="${esc(k)}"${cur === k ? ' selected' : ''}>${esc(l)}</option>`).join('') + '</select>' +
    `<button class="mr-btn green" id="mr-vch" style="background:#2563eb;border-color:#2563eb">🧾 Generate Voucher</button></div>`;
}
async function genVoucher(view, key) {
  if (typeof window.openMonthlyVoucherSections !== 'function') { alert('Please upload the latest app.js (v2.12.0) to use the voucher.'); return; }
  const g = vGroups(view);
  const keys = key === '__all' ? [...g.keys()] : [key];
  keys.sort((a, b) => String(vLabel(view, a, g.get(a) || [{}])).localeCompare(String(vLabel(view, b, g.get(b) || [{}]))));
  const sections = keys.filter((k) => g.get(k)).map((k) => vSection(view, k, g.get(k)));
  if (!sections.length) { alert('No items for this selection.'); return; }
  const meta = { month: S.month, monthLabel: monthName(S.month), mode: view };
  const ov = $('mr-ov'), modal = document.getElementById('receiptModal');
  const restore = () => { if (ov) ov.style.display = ''; };
  if (modal) modal.addEventListener('hidden.bs.modal', restore, { once: true });
  if (ov) ov.style.display = 'none';                       // the voucher viewer is a normal popup and must be on top
  try { await window.openMonthlyVoucherSections(sections, meta); } catch (e) { restore(); alert('Could not open voucher: ' + (e && e.message ? e.message : e)); return; }
  setTimeout(() => { if (modal && !modal.classList.contains('show')) restore(); }, 1500);   // viewer failed to open -> bring the report back
}

function render() {
  const ov = $('mr-ov'); if (!ov) return;
  const t = totals();
  let table = '';
  if (S.loading) table = '<div class="mr-empty">Loading...</div>';
  else if (!S.rows.length) table = `<div class="mr-empty">No completed handovers in ${esc(monthName(S.month))}.</div>`;
  else if (S.view === 'teacher') {
    const g = group((r) => r.uid || r.teacher, (r) => ({ teacher: r.teacher, uid: r.uid, dept: r.dept }));
    table = '<table><thead><tr><th>Teacher / Staff</th><th>Department</th><th>Orders</th><th>Total Qty</th><th>Items</th><th>Voucher</th></tr></thead><tbody>' +
      g.map((x) => `<tr><td><b>${esc(x.meta.teacher)}</b><br><small style="color:#64748b">${esc(x.meta.uid)}</small></td><td>${esc(x.meta.dept)}</td><td class="n">${x.orders.size}</td><td class="n">${x.qty}</td><td>${esc(itemsText(x, 3))}</td><td><button class="mr-rowv" data-k="${esc(x.key)}">🧾</button></td></tr>`).join('') + '</tbody></table>';
  } else if (S.view === 'dept') {
    const g = group((r) => r.dept);
    table = '<table><thead><tr><th>Department / Designation</th><th>Staff</th><th>Orders</th><th>Total Qty</th><th>Top items</th><th>Voucher</th></tr></thead><tbody>' +
      g.map((x) => `<tr><td><b>${esc(x.key)}</b></td><td class="n">${x.teachers.size}</td><td class="n">${x.orders.size}</td><td class="n">${x.qty}</td><td>${esc(itemsText(x, 3))}</td><td><button class="mr-rowv" data-k="${esc(x.key)}">🧾</button></td></tr>`).join('') + '</tbody></table>';
  } else {
    const g = group((r) => r.item, (r) => ({ serial: r.serial, unit: r.unit }));
    table = '<table><thead><tr><th>Item</th><th>Serial</th><th>Orders</th><th>Staff</th><th>Total Qty</th><th>Voucher</th></tr></thead><tbody>' +
      g.map((x) => `<tr><td><b>${esc(x.key)}</b></td><td>${esc(x.meta.serial)}</td><td class="n">${x.orders.size}</td><td class="n">${x.teachers.size}</td><td class="n">${x.qty} ${esc(x.meta.unit)}</td><td><button class="mr-rowv" data-k="${esc(x.key)}">🧾</button></td></tr>`).join('') + '</tbody></table>';
  }
  ov.querySelector('.mr-body').innerHTML =
    `<div class="mr-bar"><input type="month" id="mr-month" value="${esc(S.month)}"><button class="mr-btn" id="mr-go">Show</button>` +
    `<button class="mr-btn green" id="mr-xl" ${S.rows.length && !S.loading ? '' : 'disabled'}>⬇ Download Excel</button></div>` +
    voucherBar() +
    (S.err ? `<div class="mr-err">${esc(S.err)}</div>` : '') +
    `<div class="mr-stats"><div class="mr-stat"><b>${t.qty}</b><span>Items issued</span></div><div class="mr-stat"><b>${t.orders}</b><span>Orders completed</span></div><div class="mr-stat"><b>${t.teachers}</b><span>Staff</span></div></div>` +
    `<div class="mr-tabs"><button data-v="teacher" class="${S.view === 'teacher' ? 'on' : ''}">By Teacher</button><button data-v="dept" class="${S.view === 'dept' ? 'on' : ''}">By Department</button><button data-v="item" class="${S.view === 'item' ? 'on' : ''}">By Item</button></div>` +
    `<div class="mr-tw">${table}</div>`;
}

function open() {
  ensureCss();
  if ($('mr-ov')) $('mr-ov').remove();
  const ov = document.createElement('div');
  ov.id = 'mr-ov';
  ov.innerHTML = '<div class="mr-head"><h2>📊 Monthly Report - items issued</h2><button class="mr-x" data-a="close">Close</button></div><div class="mr-wrap"><div class="mr-body"></div></div>';
  document.body.appendChild(ov);
  document.documentElement.style.overflow = 'hidden';
  ov.addEventListener('click', (e) => {
    const t = e.target.closest && e.target.closest('button'); if (!t) return;
    if (t.dataset.a === 'close') { ov.remove(); document.documentElement.style.overflow = ''; }
    else if (t.dataset.v) { S.view = t.dataset.v; render(); }
    else if (t.id === 'mr-go') { const v = $('mr-month').value; if (v) { S.month = v; load(); } }
    else if (t.id === 'mr-xl') exportExcel();
    else if (t.id === 'mr-vch') { const sel = $('mr-sel'); genVoucher(S.view, sel ? sel.value : '__all'); }
    else if (t.classList.contains('mr-rowv')) genVoucher(S.view, t.getAttribute('data-k'));
  });
  ov.addEventListener('change', (e) => { if (e.target && e.target.id === 'mr-sel') S.sel[S.view] = e.target.value; });
  S.month = S.month || thisMonth();
  load();
}

/* -------------------------------- Excel ------------------------------------- */
function exportExcel() {
  if (typeof XLSX === 'undefined') { alert('Excel library is not loaded. Please check the internet connection and try again.'); return; }
  const t = totals();
  const wb = XLSX.utils.book_new();
  const sheet = (name, aoa, widths) => {
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = widths.map((w) => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, name);
  };
  sheet('Summary', [
    ['Stationery Usage Report'], ['Month', monthName(S.month)], ['Items issued', t.qty], ['Orders completed', t.orders], ['Staff', t.teachers],
    [], ['Generated', new Date().toLocaleString('en-GB')]
  ], [22, 30]);
  const gt = group((r) => r.uid || r.teacher, (r) => ({ teacher: r.teacher, uid: r.uid, dept: r.dept }));
  sheet('By Teacher', [['Teacher / Staff', 'ID', 'Department', 'Orders', 'Total Qty', 'Items']]
    .concat(gt.map((x) => [x.meta.teacher, x.meta.uid, x.meta.dept, x.orders.size, x.qty, itemsText(x)])), [28, 16, 20, 9, 11, 70]);
  const gd = group((r) => r.dept);
  sheet('By Department', [['Department / Designation', 'Staff', 'Orders', 'Total Qty', 'Items']]
    .concat(gd.map((x) => [x.key, x.teachers.size, x.orders.size, x.qty, itemsText(x)])), [28, 9, 9, 11, 70]);
  const gi = group((r) => r.item, (r) => ({ serial: r.serial, unit: r.unit }));
  sheet('By Item', [['Item', 'Serial', 'Unit', 'Orders', 'Staff', 'Total Qty']]
    .concat(gi.map((x) => [x.key, x.meta.serial, x.meta.unit, x.orders.size, x.teachers.size, x.qty])), [36, 18, 9, 9, 9, 11]);
  sheet('Details', [['Date', 'Order ID', 'Teacher / Staff', 'ID', 'Department', 'Item', 'Serial', 'Unit', 'Qty', 'Issued By']]
    .concat(S.rows.slice().sort((a, b) => a.date - b.date).map((r) => [r.date.toLocaleDateString('en-GB'), r.orderId, r.teacher, r.uid, r.dept, r.item, r.serial, r.unit, r.qty, r.issuedBy])),
    [12, 18, 26, 14, 18, 34, 16, 8, 8, 18]);
  XLSX.writeFile(wb, `Stationery_Report_${S.month}.xlsx`);
}

/* ------------------------- drawer button (admin menu) ------------------------ */
function addButtons() {
  document.querySelectorAll('[data-target="tab-purchase-orders"]').forEach((po) => {
    if (po.parentElement && po.parentElement.querySelector('.mr-drawer-btn')) return;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'drawer-item mr-drawer-btn';
    b.textContent = '📊 Monthly Report (Excel)';
    b.addEventListener('click', open);
    po.insertAdjacentElement('afterend', b);
  });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addButtons); else addButtons();
window.openMonthlyReport = open;
