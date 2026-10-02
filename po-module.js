/* ==========================================================================
   Purchase Orders module (ADMIN ONLY)  -  v1.4.1  (free unlimited pictures: Wikimedia + Pixabay, no keys, no Firebase picture store; Excel download everywhere + real Google Images pictures)
   Fully separate from app.js: it calls / overrides / edits NO existing function.
   It only hooks into the new drawer button + the new #tab-purchase-orders container.

   NEW Firebase Realtime Database nodes (nothing existing is touched):
     po_orders/{orderId}   order + items + delivery log   (removed when the order is completed)
     po_files/{orderId}    original Excel (base64) so it can be filled & re-downloaded (removed on completion)
   ========================================================================== */
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getDatabase, ref, get, set, update, remove, push, onValue } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

const CFG = {
  apiKey: "AIzaSyC34JvIlqAC0Rqb9wBIed3kNdvrEpy16P8",
  authDomain: "stationery-control-system.firebaseapp.com",
  databaseURL: "https://stationery-control-system-default-rtdb.firebaseio.com",
  projectId: "stationery-control-system",
  storageBucket: "stationery-control-system.firebasestorage.app",
  messagingSenderId: "342613102896",
  appId: "1:342613102896:web:5ddd185f3d2085661278f5"
};
const TAB_ID = 'tab-purchase-orders';
const MAX_FILE_BYTES = 3.5 * 1024 * 1024;   // bigger originals are not stored (a clean Excel is generated instead)

let db = null, started = false;
const S = { orders: {}, loaded: false, err: '', view: 'list', id: null, idx: 0, wiz: null, filter: 'all', q: '', rq: '', rf: 'all' };

/* ------------------------------ tiny helpers ------------------------------ */
const $ = (id) => document.getElementById(id);
const root = () => $('po-root');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = (t) => t ? new Date(t).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
const safeName = (s) => String(s || 'order').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_').slice(0, 60) || 'order';
const colLetter = (n) => { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
const me = () => { try { const u = JSON.parse(localStorage.getItem('currentUser') || '{}'); return u.name || u.adecPassNumber || 'Admin'; } catch (e) { return 'Admin'; } };
const busy = (on, msg) => { try { on ? window.showGlobalLoader?.(msg || 'Please wait...') : window.hideGlobalLoader?.(); } catch (e) { /* ignore */ } };

function toast(msg, type) {
  document.querySelectorAll('.po-toast').forEach((n) => n.remove());
  const t = document.createElement('div');
  t.className = 'po-toast' + (type === 'err' ? ' err' : '');
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

/* modal: returns a promise that resolves with the clicked button's value */
function modal(html, buttons) {
  return new Promise((resolve) => {
    const host = document.createElement('div');
    host.className = 'po-modal';
    host.innerHTML = `<div class="po-modal-box">${html}<div class="po-modal-actions">${buttons.map((b, i) =>
      `<button type="button" class="po-btn ${b.cls || ''}" data-i="${i}">${b.label}</button>`).join('')}</div></div>`;
    document.body.appendChild(host);
    const done = (v) => { host.remove(); resolve(v); };
    host.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-i]');
      if (b) {
        const checks = {}; host.querySelectorAll('input[type=checkbox]').forEach((c) => { checks[c.id] = c.checked; });
        modal.checks = checks;
        const def = buttons[+b.dataset.i]; done(def.value !== undefined ? def.value : def.label);
      } else if (e.target === host) done(null);
    });
    modal.last = host;
  });
}
const ask = (title, body, ok, danger) => modal(`<h4>${esc(title)}</h4><div>${body}</div>`,
  [{ label: 'Cancel', value: false }, { label: ok || 'OK', cls: danger ? 'danger' : 'primary', value: true }]);

/* ------------------------------ Excel helpers ----------------------------- */
const cellText = (v) => {
  if (v == null) return '';
  if (typeof v === 'object') {
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    if (v.richText) return v.richText.map((t) => t.text).join('').trim();
    if (v.result !== undefined) return cellText(v.result);
    if (v.text !== undefined) return cellText(v.text);
    return '';
  }
  return String(v).trim();
};

function toB64(buf) { const b = new Uint8Array(buf); let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); }
function fromB64(s) { const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; }

async function fileToBuffer(file) {
  let buf = await file.arrayBuffer();
  if (/\.xls$/i.test(file.name) && window.XLSX) {            // old .xls -> convert to .xlsx first
    const w = window.XLSX.read(buf, { type: 'array' });
    buf = window.XLSX.write(w, { bookType: 'xlsx', type: 'array' });
  }
  return buf;
}
async function loadWb(buf) { const wb = new window.ExcelJS.Workbook(); await wb.xlsx.load(buf); return wb; }

/*T-START*/
const KW = {
  brand: /brand|supplier|vendor|company|make|manufactur/i,
  item: /item|description|product|particular|article|material|stationery|name/i,
  qty: /qty|quantity|required|order|need|no\.? of/i,
  unit: /unit|pack|size|uom|measure/i
};
/* find the header row + best column guesses (admin can still change them on screen) */
function detect(ws) {
  let best = { row: 1, score: 0, map: {} };
  const max = Math.min(ws.rowCount, 40);
  for (let r = 1; r <= max; r++) {
    const map = {}; let score = 0;
    ws.getRow(r).eachCell({ includeEmpty: false }, (c, col) => {
      const t = cellText(c.value); if (!t) return;
      for (const k of ['brand', 'item', 'qty', 'unit']) { if (map[k] == null && KW[k].test(t)) { map[k] = col; score++; break; } }
    });
    if (score > best.score) best = { row: r, score, map };
  }
  return best.score >= 2 ? best : { row: 1, score: 0, map: {} };
}
/* read item rows below the header. Brand is "filled down" when only written once per group. */
function parseItems(ws, m) {
  const items = {}; let curBrand = '';
  const headItem = cellText(ws.getRow(m.row).getCell(m.item).value).toLowerCase();
  for (let r = m.row + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const b = m.brand ? cellText(row.getCell(m.brand).value) : '';
    const n = cellText(row.getCell(m.item).value);
    if (b) curBrand = b;
    if (!n || n.toLowerCase() === headItem) continue;
    const it = { row: r, brand: b || curBrand || '-', name: n };
    if (m.unit) { const u = cellText(row.getCell(m.unit).value); if (u) it.unit = u; }
    items['r' + r] = it;
  }
  return items;
}
/*T-END*/

const sortedKeys = (o) => Object.keys(o.items || {}).sort((a, b) => o.items[a].row - o.items[b].row);
const recv = (it) => Object.values(it.log || {}).reduce((s, l) => s + (Number(l.qty) || 0), 0);
const ordered = (it) => (it.skip ? 0 : Number(it.ordered) || 0);

function stats(o) {
  const s = { total: 0, ord: 0, done: 0, part: 0, none: 0, unans: 0, skip: 0, qOrd: 0, qGot: 0 };
  sortedKeys(o).forEach((k) => {
    const it = o.items[k]; s.total++;
    if (it.skip) { s.skip++; return; }
    const q = ordered(it); if (!(q > 0)) { s.unans++; return; }
    s.ord++; const r = recv(it); s.qOrd += q; s.qGot += Math.min(r, q);
    if (r >= q) s.done++; else if (r > 0) s.part++; else s.none++;
  });
  s.pct = s.qOrd ? Math.round((s.qGot / s.qOrd) * 100) : 0;
  return s;
}

/* ---------------- build / download the filled Excel (original format kept) ---------------- */
async function buildFilled(id, o) {
  let wb, ws;
  const fs = o.hasFile ? await get(ref(db, 'po_files/' + id)) : null;
  if (fs && fs.exists()) {
    wb = await loadWb(fromB64(fs.val().data));
    ws = wb.getWorksheet(o.sheetName) || wb.worksheets[0];
    if (o.cols.qtyNew) ws.getRow(o.cols.header).getCell(o.cols.qty).value = 'Quantity';
    sortedKeys(o).forEach((k) => {
      const it = o.items[k]; const q = ordered(it);
      if (q > 0) ws.getRow(it.row).getCell(o.cols.qty).value = q;
    });
  } else {                                                      // original not stored -> clean sheet
    wb = new window.ExcelJS.Workbook(); ws = wb.addWorksheet('Order');
    ws.columns = [{ header: 'Brand', width: 24 }, { header: 'Item', width: 44 }, { header: 'Unit', width: 14 }, { header: 'Quantity', width: 12 }];
    ws.getRow(1).font = { bold: true };
    sortedKeys(o).forEach((k) => { const it = o.items[k]; const q = ordered(it); if (q > 0) ws.addRow([it.brand, it.name, it.unit || '', q]); });
  }
  return wb.xlsx.writeBuffer();
}

async function buildReport(o) {
  const wb = new window.ExcelJS.Workbook();
  const ws = wb.addWorksheet('Summary');
  ws.columns = [{ header: 'Brand', width: 24 }, { header: 'Item', width: 44 }, { header: 'Unit', width: 14 }, { header: 'Ordered', width: 11 },
    { header: 'Received', width: 11 }, { header: 'Pending', width: 11 }, { header: 'Last delivery', width: 15 }];
  const lg = wb.addWorksheet('Deliveries');
  lg.columns = [{ header: 'Date', width: 14 }, { header: 'Brand', width: 24 }, { header: 'Item', width: 44 }, { header: 'Quantity', width: 11 }, { header: 'Entered by', width: 18 }];
  [ws, lg].forEach((w) => { w.getRow(1).font = { bold: true }; w.views = [{ state: 'frozen', ySplit: 1 }]; });
  sortedKeys(o).forEach((k) => {
    const it = o.items[k]; const q = ordered(it); if (!(q > 0)) return;
    const logs = Object.values(it.log || {}).sort((a, b) => a.at - b.at);
    const r = recv(it);
    ws.addRow([it.brand, it.name, it.unit || '', q, r, Math.max(q - r, 0), logs.length ? fmtDate(logs[logs.length - 1].at) : '']);
    logs.forEach((l) => lg.addRow([fmtDate(l.at), it.brand, it.name, l.qty, l.by || '']));
  });
  return wb.xlsx.writeBuffer();
}

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
function download(buf, name) {
  const blob = new Blob([buf], { type: XLSX_MIME });
  if (typeof window.saveAs === 'function') { window.saveAs(blob, name); return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}
async function share(buf, name) {                               // WhatsApp / Email through the phone's share sheet
  const f = new File([buf], name, { type: XLSX_MIME });
  if (navigator.canShare && navigator.canShare({ files: [f] })) {
    try { await navigator.share({ files: [f], title: name }); return true; } catch (e) { if (e && e.name === 'AbortError') return true; }
  }
  return false;
}

/* ------------------------------ Firebase start ---------------------------- */
function start() {
  if (started) return; started = true;
  const apps = getApps();
  db = getDatabase(apps.length ? apps[0] : initializeApp(CFG, 'po-module'));
  onValue(ref(db, 'po_orders'), (snap) => { S.orders = snap.val() || {}; S.loaded = true; S.err = ''; refresh(); },
    (err) => { S.err = err && err.message ? err.message : 'Permission denied'; refresh(); });
}

function refresh() {
  if (!root()) return;
  const o = S.orders[S.id];
  if (['fill', 'review', 'track'].includes(S.view)) {
    if (!o) { S.view = 'list'; S.id = null; }
    else if (o.status !== 'draft' && S.view !== 'track') S.view = 'track';
  }
  const ae = document.activeElement;
  if (S.view === 'fill' && ae && root().contains(ae) && ae.tagName === 'INPUT') return;   // do not wipe what is being typed
  render();
}

/* --------------------------------- views ---------------------------------- */
function render() {
  const r = root(); if (!r) return;
  if (!started) { r.innerHTML = '<p>Loading...</p>'; return; }
  if (S.err) { r.innerHTML = `<div class="po-card"><b>Cannot read Purchase Orders</b><p class="po-meta">${esc(S.err)}<br>Firebase Rules: allow read/write on <code>po_orders</code> and <code>po_files</code> (same as <code>orders</code>). See README-PO-SETUP.md.</p></div>`; return; }
  if (!S.loaded) { r.innerHTML = '<p>Loading...</p>'; return; }
  const o = S.orders[S.id];
  if (S.view === 'wizard') r.innerHTML = viewWizard();
  else if (S.view === 'fill' && o) r.innerHTML = viewFill(o);
  else if (S.view === 'review' && o) r.innerHTML = viewReview(o);
  else if (S.view === 'track' && o) r.innerHTML = viewTrack(o);
  else r.innerHTML = viewList();
  if (S.view === 'fill') { setTimeout(() => { const q = $('po-qty'); if (q) { q.focus(); q.select(); } }, 60); fillImages(); }
}

function statusChip(o) {
  const st = stats(o);
  if (o.status === 'draft') return '<span class="po-chip amber">✏️ Filling form</span>';
  if (st.ord && st.done === st.ord) return '<span class="po-chip green">✅ All received</span>';
  return '<span class="po-chip">🚚 Awaiting delivery</span>';
}

function viewList() {
  const ids = Object.keys(S.orders).sort((a, b) => (S.orders[b].createdAt || 0) - (S.orders[a].createdAt || 0));
  const cards = ids.map((id) => {
    const o = S.orders[id]; const st = stats(o);
    const line = o.status === 'draft' ? `${st.total - st.unans} of ${st.total} items answered` : `${st.done}/${st.ord} items complete · ${st.pct}% quantity received`;
    const pct = o.status === 'draft' ? Math.round(((st.total - st.unans) / (st.total || 1)) * 100) : st.pct;
    return `<div class="po-card click" data-act="open" data-id="${esc(id)}">
      <div class="po-card-top"><div><b>${esc(o.title)}</b><div class="po-meta">${fmtDate(o.createdAt)} · ${esc(o.createdBy || '')} · ${esc(o.fileName || '')}</div></div>${statusChip(o)}</div>
      <div class="po-meta" style="margin-top:8px">${line}</div><div class="po-bar"><i style="width:${pct}%"></i></div>
      <div style="margin-top:10px;display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap"><button class="po-btn sm" data-act="xl" data-id="${esc(id)}">⬇ Download Excel</button><button class="po-btn sm ghost" data-act="del" data-id="${esc(id)}">🗑 Delete</button></div></div>`;
  }).join('');
  return `<div class="po-head"><h3 class="po-grow">🧾 Purchase Orders</h3><button class="po-btn primary" data-act="new">⬆ Upload Excel · New Order</button></div>
    ${cards || '<div class="po-empty"><b>No active orders</b><br>Upload the Excel list from the Operations Manager to start a new order.</div>'}`;
}

/* ---- wizard: choose file -> confirm columns -> create ---- */
function colOpts(ws, hr, sel, extra) {
  let h = extra || '';
  const n = Math.max(ws.columnCount, 1);
  for (let c = 1; c <= n; c++) {
    const t = cellText(ws.getRow(hr).getCell(c).value);
    h += `<option value="${c}" ${String(sel) === String(c) ? 'selected' : ''}>${colLetter(c)} — ${esc(t || '(blank)')}</option>`;
  }
  return h;
}
function viewWizard() {
  const W = S.wiz;
  const head = `<div class="po-head"><button class="po-back" data-act="home">← Orders</button><h3 class="po-grow">New Order from Excel</h3></div>`;
  if (!W || !W.ws) {
    return head + `<label class="po-drop"><input type="file" id="po-file" accept=".xlsx,.xls">📄 Tap to choose the Excel file<br><small>.xlsx or .xls given by the Operations Manager</small></label>`;
  }
  const m = W.map;
  const items = m.item ? parseItems(W.ws, { row: W.header, brand: +m.brand || 0, item: +m.item, unit: +m.unit || 0 }) : {};
  const keys = Object.keys(items);
  const okMap = m.item && m.qty;
  const sample = okMap ? keys.slice(0, 6).map((k) => `<tr><td>${items[k].row}</td><td>${esc(items[k].brand)}</td><td>${esc(items[k].name)}</td><td>${esc(items[k].unit || '')}</td></tr>`).join('') : '';
  return head + `<div class="po-card">
    <label class="po-field"><span>Order title</span><input class="po-input" data-w="title" value="${esc(W.title)}" placeholder="e.g. Term 2 Stationery"></label>
    <div class="po-grid">
      <label class="po-field"><span>Sheet</span><select class="po-select" data-w="sheet">${W.wb.worksheets.map((s) => `<option ${s.name === W.sheet ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>
      <label class="po-field"><span>Header row number</span><input type="number" min="1" class="po-input" data-w="header" value="${W.header}"></label>
      <label class="po-field"><span>Brand column</span><select class="po-select" data-w="brand">${colOpts(W.ws, W.header, m.brand, '<option value="">— none —</option>')}</select></label>
      <label class="po-field"><span>Item name column *</span><select class="po-select" data-w="item">${colOpts(W.ws, W.header, m.item, '<option value="">— choose —</option>')}</select></label>
      <label class="po-field"><span>Quantity column (empty box) *</span><select class="po-select" data-w="qty">${colOpts(W.ws, W.header, m.qty, '<option value="">— choose —</option><option value="new" ' + (m.qty === 'new' ? 'selected' : '') + '>➕ Add a new column at the end</option>')}</select></label>
      <label class="po-field"><span>Unit / pack column (optional)</span><select class="po-select" data-w="unit">${colOpts(W.ws, W.header, m.unit, '<option value="">— none —</option>')}</select></label>
    </div></div>
    <div class="po-card"><b>${okMap ? keys.length + ' items found' : 'Choose the Item and Quantity columns'}</b>
    ${sample ? `<div class="po-tablewrap" style="margin-top:8px"><table class="po-table"><thead><tr><th>Excel row</th><th>Brand</th><th>Item</th><th>Unit</th></tr></thead><tbody>${sample}</tbody></table></div>` : ''}</div>
    <div style="display:flex;gap:8px;justify-content:flex-end"><button class="po-btn" data-act="home">Cancel</button>
    <button class="po-btn primary" data-act="create" ${okMap && keys.length ? '' : 'disabled'}>Create Order Form →</button></div>`;
}
function autoDetect(W) {
  const d = detect(W.ws);
  W.header = d.row;
  W.map = { brand: d.map.brand || '', item: d.map.item || '', qty: d.map.qty || '', unit: d.map.unit || '' };
}
async function pickFile(file) {
  if (!file) return;
  busy(true, 'Reading Excel...');
  try {
    const buf = await fileToBuffer(file);
    const wb = await loadWb(buf);
    const sh = wb.worksheets.find((w) => w.rowCount > 1) || wb.worksheets[0];
    if (!sh) throw new Error('No sheet found');
    const W = { file, buf, wb, sheet: sh.name, ws: sh, title: file.name.replace(/\.[^.]+$/, ''), header: 1, map: {} };
    autoDetect(W); S.wiz = W; render();
  } catch (e) { console.error(e); toast('Could not read this Excel file', 'err'); }
  finally { busy(false); }
}
async function createOrder() {
  const W = S.wiz; if (!W) return;
  const m = W.map;
  const items = parseItems(W.ws, { row: W.header, brand: +m.brand || 0, item: +m.item, unit: +m.unit || 0 });
  if (!Object.keys(items).length) return toast('No items found - check the header row / item column', 'err');
  const id = 'PO' + Date.now().toString(36).toUpperCase();
  const qtyNew = m.qty === 'new';
  const cols = { header: W.header, item: +m.item, qty: qtyNew ? W.ws.columnCount + 1 : +m.qty, qtyNew };
  if (m.brand) cols.brand = +m.brand; if (m.unit) cols.unit = +m.unit;
  const keepFile = W.buf.byteLength <= MAX_FILE_BYTES;
  const order = { title: (W.title || 'Order').trim(), createdAt: Date.now(), createdBy: me(), status: 'draft', sheetName: W.sheet, fileName: W.file.name.replace(/\.xls$/i, '.xlsx'), hasFile: keepFile, cols, items };
  busy(true, 'Creating order form...');
  try {
    if (keepFile) await set(ref(db, 'po_files/' + id), { name: order.fileName, sheetName: W.sheet, data: toB64(W.buf) });
    await set(ref(db, 'po_orders/' + id), order);
    S.wiz = null; S.id = id; S.idx = 0; S.view = 'fill';
    S.orders[id] = order; render();
    if (!keepFile) toast('Large file: a clean Excel will be generated at the end');
  } catch (e) { console.error(e); toast('Save failed: ' + (e.message || e), 'err'); }
  finally { busy(false); }
}

/* ---- one-by-one form ---- */
function viewFill(o) {
  const ks = sortedKeys(o); const k = ks[S.idx]; const it = o.items[k]; const st = stats(o);
  if (!it) { S.view = 'review'; return viewReview(o); }
  const answered = st.total - st.unans;
  const last = S.idx >= ks.length - 1;
  return `<div class="po-head"><button class="po-back" data-act="home">← Orders</button><h3 class="po-grow">${esc(o.title)}</h3>
      <button class="po-btn" data-act="xl">⬇ Excel</button><button class="po-btn" data-act="review">Review (${answered}/${st.total})</button></div>
    <div class="po-bar" style="margin:0 0 12px"><i style="width:${Math.round((answered / (st.total || 1)) * 100)}%"></i></div>
    <div class="po-card po-fill">
      <div class="po-meta">Item ${S.idx + 1} of ${ks.length}</div>
      <div id="po-imgbox" class="po-imgbox"></div>
      <span class="po-chip po-brand">${esc(it.brand)}</span>
      <h2>${esc(it.name)}</h2>
      ${it.unit ? `<div class="po-meta">${esc(it.unit)}</div>` : ''}
      <label class="po-meta" for="po-qty" style="margin-top:12px;display:block">Quantity needed</label>
      <input id="po-qty" class="po-input po-qty" type="number" inputmode="decimal" min="0" step="any" placeholder="0" value="${it.ordered > 0 ? esc(it.ordered) : ''}">
      <div class="po-fill-actions"><button class="po-btn" data-act="skip">✕ Not needed</button>
        <button class="po-btn primary" data-act="add">${last ? 'Add & Review' : 'Add & Next'} →</button></div>
      <div class="po-fill-nav"><button class="po-btn sm ghost" data-act="prev" ${S.idx ? '' : 'disabled'}>‹ Back</button>
        <span class="po-chip ${it.skip ? 'gray' : it.ordered > 0 ? 'green' : 'amber'}">${it.skip ? 'Skipped' : it.ordered > 0 ? 'Added: ' + esc(it.ordered) : 'Not answered'}</span>
        <button class="po-btn sm ghost" data-act="next" ${last ? 'disabled' : ''}>Forward ›</button></div>
    </div>`;
}
async function saveAnswer(skip) {
  const o = S.orders[S.id]; const ks = sortedKeys(o); const k = ks[S.idx];
  let val = null;
  if (!skip) {
    val = parseFloat(($('po-qty') || {}).value);
    if (!(val > 0)) return toast('Enter a quantity, or press "Not needed"', 'err');
  }
  const patch = skip ? { skip: true, ordered: null } : { ordered: val, skip: null };
  try {
    await update(ref(db, `po_orders/${S.id}/items/${k}`), patch);
    Object.assign(o.items[k], skip ? { skip: true, ordered: null } : { ordered: val, skip: null });
    if (S.idx >= ks.length - 1) S.view = 'review'; else S.idx++;
    render();
  } catch (e) { toast('Save failed: ' + (e.message || e), 'err'); }
}

/* ---- review + submit ---- */
function viewReview(o) {
  const st = stats(o); const ks = sortedKeys(o);
  const q = S.rq.toLowerCase();
  const rows = ks.filter((k) => {
    const it = o.items[k];
    const cat = it.skip ? 'skip' : ordered(it) > 0 ? 'ord' : 'un';
    return (S.rf === 'all' || S.rf === cat) && (!q || (it.name + ' ' + it.brand).toLowerCase().includes(q));
  }).map((k) => {
    const it = o.items[k]; const i = ks.indexOf(k);
    const chip = it.skip ? '<span class="po-chip gray">Skipped</span>' : ordered(it) > 0 ? `<span class="po-chip green">${esc(it.ordered)}</span>` : '<span class="po-chip amber">—</span>';
    return `<div class="po-row click" data-act="jump" data-i="${i}" style="cursor:pointer"><div class="po-row-main"><b>${esc(it.name)}</b><div class="po-meta">${esc(it.brand)}</div></div>${chip}</div>`;
  }).join('');
  const f = (v, l) => `<button class="${S.rf === v ? 'on' : ''}" data-act="rf" data-v="${v}">${l}</button>`;
  return `<div class="po-head"><button class="po-back" data-act="home">← Orders</button><h3 class="po-grow">Review · ${esc(o.title)}</h3><button class="po-btn" data-act="xl">⬇ Excel</button></div>
    <div class="po-stats"><div class="po-stat"><b>${st.ord}</b><span>Ordered</span></div><div class="po-stat"><b>${st.skip}</b><span>Skipped</span></div><div class="po-stat"><b>${st.unans}</b><span>Not answered</span></div></div>
    <div class="po-tools"><input class="po-input" id="po-rq" placeholder="Search item / brand" value="${esc(S.rq)}"><div class="po-filters">${f('all', 'All')}${f('ord', 'Ordered')}${f('skip', 'Skipped')}${f('un', 'Unanswered')}</div></div>
    ${rows || '<div class="po-empty">Nothing here</div>'}
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px"><button class="po-btn" data-act="resume">‹ Continue filling</button>
    <button class="po-btn green" data-act="submit" ${st.ord ? '' : 'disabled'}>Submit Order ✓</button></div>`;
}
async function submitOrder() {
  const o = S.orders[S.id]; const st = stats(o);
  if (!st.ord) return toast('Add at least one item quantity', 'err');
  const body = `<b>${st.ord}</b> items will be ordered.` + (st.unans ? `<br><br>⚠️ <b>${st.unans}</b> items are not answered - they will stay <b>blank</b> in the Excel.` : '');
  if (!(await ask('Submit this order?', body, 'Submit', false))) return;
  busy(true, 'Submitting order & preparing Excel...');
  try {
    await update(ref(db, 'po_orders/' + S.id), { status: 'ordered', submittedAt: Date.now(), submittedBy: me() });
    o.status = 'ordered';
    const buf = await buildFilled(S.id, o);
    S.view = 'track'; S.filter = 'all'; S.q = ''; render();
    busy(false);
    const name = safeName(o.title) + '_order.xlsx';
    const ch = await modal(`<h4>✅ Order submitted</h4><p>The Excel file is filled. Send it to the Operations Manager, or let them open this order from their admin login.</p>`,
      [{ label: 'Close', value: 'x' }, { label: '📤 Share (WhatsApp / Email)', value: 's', cls: '' }, { label: '⬇ Download Excel', value: 'd', cls: 'primary' }]);
    if (ch === 'd') download(buf, name);
    else if (ch === 's') { if (!(await share(buf, name))) { download(buf, name); toast('Sharing not supported here - file downloaded'); } }
  } catch (e) { console.error(e); toast('Submit failed: ' + (e.message || e), 'err'); }
  finally { busy(false); }
}

/* ---- delivery tracking ---- */
function viewTrack(o) {
  const st = stats(o); const ks = sortedKeys(o).filter((k) => ordered(o.items[k]) > 0);
  const q = S.q.toLowerCase();
  const list = ks.filter((k) => {
    const it = o.items[k]; const r = recv(it), t = ordered(it);
    const cat = r >= t ? 'done' : r > 0 ? 'part' : 'none';
    const okF = S.filter === 'all' || (S.filter === 'pending' && cat !== 'done') || S.filter === cat;
    return okF && (!q || (it.name + ' ' + it.brand).toLowerCase().includes(q));
  });
  let html = '', lastBrand = null;
  list.forEach((k) => {
    const it = o.items[k]; const t = ordered(it), r = recv(it), pend = Math.max(t - r, 0), ex = Math.max(r - t, 0);
    if (it.brand !== lastBrand) { html += `<div class="po-brandhead">${esc(it.brand)}</div>`; lastBrand = it.brand; }
    const done = r >= t;
    html += `<div class="po-row ${done ? 'done' : ''}"><div class="po-row-main"><b>${esc(it.name)}</b>${it.unit ? `<small>${esc(it.unit)}</small>` : ''}
      <div class="po-nums"><span>Ordered <b>${t}</b></span><span>Received <b>${r}</b></span>${done ? (ex ? `<span class="extra">Extra <b>+${ex}</b></span>` : '<span class="po-chip green">✓ Complete</span>') : `<span class="pend">Pending <b>${pend}</b></span>`}</div>
      <div class="po-bar"><i style="width:${Math.min(100, Math.round((r / t) * 100))}%"></i></div></div>
      <button class="po-btn sm ${done ? '' : 'primary'}" data-act="recv" data-k="${k}">${done ? 'History' : '＋ Receive'}</button></div>`;
  });
  const f = (v, l) => `<button class="${S.filter === v ? 'on' : ''}" data-act="flt" data-v="${v}">${l}</button>`;
  const allDone = st.ord && st.done === st.ord;
  return `<div class="po-head"><button class="po-back" data-act="home">← Orders</button><h3 class="po-grow">${esc(o.title)}</h3>
      <button class="po-btn" data-act="xl">⬇ Excel</button></div>
    <div class="po-stats"><div class="po-stat"><b>${st.pct}%</b><span>Quantity received</span></div><div class="po-stat"><b>${st.done}/${st.ord}</b><span>Items complete</span></div>
      <div class="po-stat"><b>${st.part}</b><span>Partly received</span></div><div class="po-stat"><b>${st.none}</b><span>Not arrived</span></div></div>
    ${allDone ? '<div class="po-banner"><span>🎉 Everything has been delivered.</span><button class="po-btn green sm" data-act="complete">Complete & Remove</button></div>' : ''}
    <div class="po-tools"><input class="po-input" id="po-q" placeholder="Search item / brand" value="${esc(S.q)}"><div class="po-filters">${f('all', 'All')}${f('pending', 'Pending')}${f('part', 'Partial')}${f('done', 'Done')}</div></div>
    ${html || '<div class="po-empty">No items match</div>'}
    ${allDone ? '' : '<div style="margin-top:16px;text-align:right"><button class="po-btn" data-act="complete">Close order (remove from app)</button></div>'}`;
}

async function openReceive(k) {
  const o = S.orders[S.id]; const it = o.items[k]; const t = ordered(it), r = recv(it), pend = Math.max(t - r, 0);
  const today = new Date().toISOString().slice(0, 10);
  const logs = Object.entries(it.log || {}).sort((a, b) => b[1].at - a[1].at);
  const logHtml = logs.length ? `<div class="po-log"><b>Delivery history</b>${logs.map(([lid, l]) =>
    `<div><span>${fmtDate(l.at)} · <b>${esc(l.qty)}</b> <small>${esc(l.by || '')}</small></span><button class="po-btn sm ghost" data-del="${lid}">Remove</button></div>`).join('')}</div>` : '';
  const html = `<h4>${esc(it.name)}</h4><div class="po-meta">${esc(it.brand)} · Ordered <b>${t}</b> · Received <b>${r}</b> · Pending <b>${pend}</b></div>
    <div class="po-grid" style="margin-top:12px"><label class="po-field"><span>Received today</span><input id="po-rqty" class="po-input" type="number" inputmode="decimal" min="0" step="any" value="${pend || ''}"></label>
    <label class="po-field"><span>Date</span><input id="po-rdate" class="po-input" type="date" value="${today}" max="${today}"></label></div>${logHtml}`;
  const p = modal(html, [{ label: 'Close', value: null }, { label: 'Save delivery', cls: 'primary', value: 'save' }]);
  const host = modal.last;
  host.addEventListener('click', async (e) => {
    const b = e.target.closest('button[data-del]'); if (!b) return;
    if (!(await ask('Remove this delivery entry?', 'The received quantity will be reduced.', 'Remove', true))) return;
    try { await remove(ref(db, `po_orders/${S.id}/items/${k}/log/${b.dataset.del}`)); toast('Entry removed'); host.remove(); } catch (er) { toast('Failed: ' + er.message, 'err'); }
  });
  const v = await p;
  if (v !== 'save') return;
  const qty = parseFloat(host.querySelector('#po-rqty').value);
  const d = host.querySelector('#po-rdate').value;
  if (!(qty > 0)) return toast('Enter the received quantity', 'err');
  const now = new Date(); const at = d ? new Date(d + 'T' + now.toTimeString().slice(0, 8)).getTime() : Date.now();
  try {
    await set(push(ref(db, `po_orders/${S.id}/items/${k}/log`)), { qty, at, by: me() });
    toast(`Saved: +${qty} ${it.name}`);
  } catch (e) { toast('Save failed: ' + (e.message || e), 'err'); }
}

async function completeOrder() {
  const id = S.id; const o = S.orders[id]; if (!o) return;
  const st = stats(o); const pend = st.ord - st.done;
  const warn = pend ? `<p style="color:#b45309">⚠️ <b>${pend}</b> items are not fully received yet. They will be closed as they are.</p>` : '';
  const ch = await modal(`<h4>Complete & remove "${esc(o.title)}"?</h4>${warn}<p>The order is permanently deleted from the app and the database to free space.</p>
    <label style="display:flex;gap:8px;align-items:center;font-weight:600"><input type="checkbox" id="po-keep" checked> Download final report (Excel) first</label>`,
    [{ label: 'Cancel', value: false }, { label: 'Complete & Remove', cls: 'danger', value: true }]);
  if (!ch) return;
  const keep = !!(modal.checks && modal.checks['po-keep']);
  busy(true, 'Finishing order...');
  try {
    if (keep) download(await buildReport(o), safeName(o.title) + '_final_report.xlsx');   // if this fails, nothing is deleted
    await Promise.all([remove(ref(db, 'po_orders/' + id)), remove(ref(db, 'po_files/' + id))]);
    S.view = 'list'; S.id = null; render();
    toast('Order completed and removed');
  } catch (e) { console.error(e); toast('Could not complete: ' + (e.message || e), 'err'); }
  finally { busy(false); }
}


/* ------------------------- online item pictures (free: Wikimedia Commons + optional Pixabay) ------------------------- */
(() => { try { localStorage.removeItem('po_img_v1'); localStorage.removeItem('po_img_v2'); } catch (e) { /* old Openverse cache (wrong pictures) */ } })();
const IMG = { healed: '', tok: 0, cur: [], mem: {}, pend: {}, cache: (() => { try { return JSON.parse(localStorage.getItem('po_img_v3') || '{}'); } catch (e) { return {}; } })() };
const imgKey = (it) => (it.brand + '|' + it.name).toLowerCase().replace(/\s+/g, ' ').trim();
const gSearch = (it) => 'https://www.google.com/search?tbm=isch&q=' + encodeURIComponent((it.brand === '-' ? '' : it.brand + ' ') + it.name);
/* Free, unlimited picture search - no account, no API key, no credits.
   1) Wikimedia Commons (Wikipedia's media library) - tried first, best for common stationery items.
   2) Pixabay - optional backup, used only if you paste your own free key into PIXABAY_KEY below. */
const PIXABAY_KEY = '';   // OPTIONAL: paste your own free key from pixabay.com/api/docs here for extra photos. Empty = only Wikimedia (no key needed)

async function wikiSearch(q) {
  const url = 'https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=' + encodeURIComponent('filetype:bitmap ' + q) +
    '&gsrnamespace=6&gsrlimit=8&prop=imageinfo&iiprop=url&iiurlwidth=800&origin=*&format=json';
  const c = new AbortController(); const t = setTimeout(() => c.abort(), 15000);
  let j;
  try { const r = await fetch(url, { signal: c.signal }); j = await r.json(); }
  catch (e) { throw new Error(e && e.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK'); } finally { clearTimeout(t); }
  const pages = (j && j.query && j.query.pages) || {};
  return Object.values(pages).map((p) => {
    const ii = p.imageinfo && p.imageinfo[0]; if (!ii) return null;
    return { t: ii.thumburl || ii.url, u: ii.url, s: 'Wikimedia Commons' };
  }).filter(Boolean).slice(0, 8);
}
async function pixabaySearch(q) {
  const url = 'https://pixabay.com/api/?key=' + PIXABAY_KEY + '&q=' + encodeURIComponent(q) + '&image_type=photo&safesearch=true&per_page=8';
  const c = new AbortController(); const t = setTimeout(() => c.abort(), 15000);
  let j;
  try { const r = await fetch(url, { signal: c.signal }); j = await r.json(); }
  catch (e) { throw new Error(e && e.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK'); } finally { clearTimeout(t); }
  return ((j && j.hits) || []).map((h) => ({ t: h.webformatURL, u: h.largeImageURL || h.webformatURL, s: 'Pixabay' })).slice(0, 8);
}
/* "brand + item" first (most exact); if nothing is found, try the item name alone. Wikimedia first (no limit at all), Pixabay as backup. */
async function searchImages(it) {
  const clean = (x) => String(x || '').replace(/[()\[\],\/\\_*"]+/g, ' ').replace(/\s+/g, ' ').trim();
  const name = clean(it.name), brand = it.brand === '-' ? '' : clean(it.brand);
  // item name FIRST (brand names like "Galaxy" would otherwise match space photos); brand+name only as a second try
  const qs = [...new Set([name, (brand + ' ' + name).trim()].filter((x) => x.length > 1))];
  let lastErr = null;
  for (const q of qs) {
    const engines = PIXABAY_KEY ? [pixabaySearch, wikiSearch] : [wikiSearch];   // Pixabay gives cleaner product-style photos
    for (const eng of engines) { try { const r = await eng(q); if (r.length) return r; } catch (e) { lastErr = e; } }
  }
  if (lastErr) throw lastErr;
  return [];
}
function imgErrText(code) {
  if (code === 'TIMEOUT') return 'Picture search timed out. Check internet and tap Retry.';
  if (code === 'NETWORK') return 'Could not reach the picture search (internet, or the browser blocked it). Tap Retry.';
  if (/^MSG:/.test(code)) return 'Picture search failed: ' + code.slice(4);
  return 'No picture found. Tap Retry, or use Google Images.';
}
function paintImgBox(it, list, state) {
  const box = $('po-imgbox'); if (!box) return;
  IMG.cur = list || [];
  const link = `<a class="po-imglink" href="${esc(gSearch(it))}" target="_blank" rel="noopener">🔍 Google Images</a>`;
  if (state === 'loading') { box.innerHTML = '<div class="po-imgbig po-imgmsg">Loading picture…</div>'; return; }
  if (state && state !== 'ok') {
    box.innerHTML = `<div class="po-imgbig po-imgmsg">${esc(imgErrText(state))}</div><div class="po-imgfoot"><button type="button" class="po-btn sm" data-act="imgretry">↻ Retry</button>${link}</div>`; return;
  }
  if (!IMG.cur.length) { box.innerHTML = `<div class="po-imgbig po-imgmsg">No picture found for this item</div><div class="po-imgfoot"><span></span>${link}</div>`; return; }
  const f = IMG.cur[0];
  box.innerHTML = `<div class="po-imgbig"><span class="po-imgmsg" id="po-bigload">Loading picture…</span><img id="po-bigimg" alt="${esc(it.name)}" referrerpolicy="no-referrer" style="display:none"></div>
    <div class="po-thumbs">${IMG.cur.map((x, i) => `<button type="button" class="${i ? '' : 'on'}" data-act="img" data-i="${i}" style="display:none"><img alt="" referrerpolicy="no-referrer"></button>`).join('')}</div>
    <div class="po-imgfoot"><span><span id="po-imgsrc">Source: ${esc(f.s)}</span> · <a href="#" data-act="imgnew" style="color:inherit">↻ different photos? search again</a></span>${link}</div>`;
  hydrateImgs(it);
}
/* Pictures are first tested OFF-screen (detached Image objects), and only a picture that really loaded is put on the page.
   So a blocked/dead link can never show a broken box or the grey "No Image" placeholder.
   Order per photo: full-size link -> its small Google thumbnail -> next photo. If every photo is dead, the shared group is cleared and searched again once. */
const probe = (url) => new Promise((res) => {
  if (!url) return res(false);
  const im = new Image(); im.referrerPolicy = 'no-referrer';
  const t = setTimeout(() => { im.onload = im.onerror = null; res(false); }, 9000);
  im.onload = () => { clearTimeout(t); res(im.naturalWidth > 1); };
  im.onerror = () => { clearTimeout(t); res(false); };
  im.src = url;
});
function hydrateImgs(it) {
  const box = $('po-imgbox'); if (!box) return;
  const my = IMG.pt = (IMG.pt || 0) + 1, list = IMG.cur, dead = new Set(), tried = new Set();
  const stale = () => my !== IMG.pt || !$('po-bigimg');
  const alive = () => list.map((_, i) => i).filter((i) => !dead.has(i));
  const allDead = () => {
    if (IMG.healed === imgKey(it)) { box.innerHTML = '<div class="po-imgbig po-imgmsg">Pictures could not be loaded</div><div class="po-imgfoot"><button type="button" class="po-btn sm" data-act="imgnew">↻ Search again</button></div>'; return; }
    IMG.healed = imgKey(it); fillImages(true);
  };
  async function show(i) {
    const x = list[i]; if (!x) return;
    let ok = null;
    for (const u of [x.u, x.t]) { if (u && await probe(u)) { ok = u; break; } if (stale()) return; }
    if (stale()) return;
    if (!ok) { dead.add(i); const nx = alive().find((k) => !tried.has(k)); if (nx === undefined) { if (!alive().length || !$('po-bigimg').getAttribute('src')) allDead(); return; } tried.add(nx); return show(nx); }
    const big = $('po-bigimg'), ld = $('po-bigload'); big.src = ok; big.style.display = ''; if (ld) ld.remove();
    box.querySelectorAll('.po-thumbs button').forEach((b) => b.classList.toggle('on', +b.dataset.i === i));
    const f = $('po-imgsrc'); if (f) f.textContent = 'Source: ' + x.s;
  }
  IMG.show = (i) => { tried.clear(); tried.add(i); show(i); };
  tried.add(0); show(0);
  list.forEach(async (x, i) => {                                   // thumbnails: show only the ones that load
    const ok = await probe(x.t); if (stale()) return;
    const b = box.querySelector(`.po-thumbs button[data-i="${i}"]`); if (!b) return;
    if (ok) { b.querySelector('img').src = x.t; b.style.display = ''; } else dead.add(i);
  });
}
/* cache order: this device's saved cache -> fresh free search (Wikimedia then Pixabay) */
async function resolveImages(it, force) {
  const key = imgKey(it);
  if (force) { delete IMG.cache[key]; delete IMG.mem[key]; saveImgCache(); }
  let list = IMG.cache[key] || IMG.mem[key];
  if (list) return list;
  if (IMG.pend[key]) return IMG.pend[key];
  IMG.pend[key] = (async () => {
    const l = await searchImages(it);                              // errors are never cached
    if (l.length) { IMG.cache[key] = l; saveImgCache(); } else IMG.mem[key] = l;
    return l;
  })().finally(() => { delete IMG.pend[key]; });
  return IMG.pend[key];
}
async function fillImages(force) {
  const o = S.orders[S.id]; if (!o || S.view !== 'fill') return;
  const it = o.items[sortedKeys(o)[S.idx]]; if (!it) return;
  const tok = ++IMG.tok, key = imgKey(it);
  let list = force ? null : (IMG.cache[key] || IMG.mem[key]);
  if (!list) {
    paintImgBox(it, null, 'loading');
    try { list = await resolveImages(it, force); }
    catch (e) { if (tok === IMG.tok) paintImgBox(it, null, (e && e.message) || 'ERR'); return; }
    if (tok !== IMG.tok) return;                                   // admin already moved to another item
  }
  paintImgBox(it, list, 'ok');
  const nk = sortedKeys(o)[S.idx + 1], nx = nk && o.items[nk];     // quietly warm up the next item
  if (nx) resolveImages(nx).catch(() => {});
}
function pickImg(i) { if (IMG.show) IMG.show(i); }

/* ------------------------------ event wiring ------------------------------ */
function openOrder(id) {
  const o = S.orders[id]; if (!o) return;
  S.id = id; S.filter = 'all'; S.q = ''; S.rq = ''; S.rf = 'all';
  if (o.status === 'draft') {
    const ks = sortedKeys(o); const i = ks.findIndex((k) => !o.items[k].skip && !(o.items[k].ordered > 0));
    S.idx = i < 0 ? 0 : i; S.view = i < 0 ? 'review' : 'fill';
  } else S.view = 'track';
  render();
}

async function onClick(e) {
  const el = e.target.closest('[data-act]'); if (!el || el.disabled) return;
  const a = el.dataset.act;
  if (a === 'del') { e.stopPropagation(); return deleteOrder(el.dataset.id); }
  switch (a) {
    case 'new': S.wiz = null; S.view = 'wizard'; render(); break;
    case 'home': S.view = 'list'; S.id = null; S.wiz = null; render(); break;
    case 'open': openOrder(el.dataset.id); break;
    case 'create': createOrder(); break;
    case 'add': saveAnswer(false); break;
    case 'skip': saveAnswer(true); break;
    case 'prev': if (S.idx > 0) { S.idx--; render(); } break;
    case 'next': S.idx++; render(); break;
    case 'review': S.view = 'review'; render(); break;
    case 'resume': { const o = S.orders[S.id]; const ks = sortedKeys(o); const i = ks.findIndex((k) => !o.items[k].skip && !(o.items[k].ordered > 0)); S.idx = i < 0 ? 0 : i; S.view = 'fill'; render(); break; }
    case 'jump': S.idx = +el.dataset.i; S.view = 'fill'; render(); break;
    case 'rf': S.rf = el.dataset.v; render(); break;
    case 'flt': S.filter = el.dataset.v; render(); break;
    case 'submit': submitOrder(); break;
    case 'recv': openReceive(el.dataset.k); break;
    case 'complete': completeOrder(); break;
    case 'img': pickImg(+el.dataset.i); break;
    case 'imgretry': fillImages(); break;
    case 'imgnew': e.preventDefault(); fillImages(true); break;
    case 'xl': exportFilled(el.dataset.id || S.id); break;
    default: break;
  }
}
function onChange(e) {
  const el = e.target;
  if (el.id === 'po-file') { pickFile(el.files && el.files[0]); return; }
  const w = el.dataset && el.dataset.w; if (!w || !S.wiz) return;
  const W = S.wiz;
  if (w === 'title') { W.title = el.value; return; }
  if (w === 'sheet') { W.sheet = el.value; W.ws = W.wb.getWorksheet(el.value); autoDetect(W); }
  else if (w === 'header') W.header = Math.max(1, parseInt(el.value, 10) || 1);
  else W.map[w] = el.value;
  render();
}
function onInput(e) {
  if (e.target.id === 'po-q') { S.q = e.target.value; rerenderKeepFocus('po-q'); }
  else if (e.target.id === 'po-rq') { S.rq = e.target.value; rerenderKeepFocus('po-rq'); }
}
function rerenderKeepFocus(id) {
  render(); const i = $(id); if (i) { i.focus(); const l = i.value.length; try { i.setSelectionRange(l, l); } catch (x) { /* ignore */ } }
}
function onKey(e) { if (e.key === 'Enter' && e.target.id === 'po-qty') { e.preventDefault(); saveAnswer(false); } }

async function exportFilled(id) {
  const o = S.orders[id]; if (!o) return;
  const st = stats(o);
  const note = o.status === 'draft' && st.unans ? `<p style="color:#b45309">⚠️ ${st.unans} items are not answered yet - they stay blank in the Excel.</p>` : '';
  busy(true, 'Preparing Excel...');
  try {
    const buf = await buildFilled(id, o); busy(false);          // same format as the original file, Quantity column filled
    const name = safeName(o.title) + '_order.xlsx';
    const ch = await modal(`<h4>Order Excel</h4><p>Original format, quantity column filled (${st.ord} items ordered).</p>${note}`,
      [{ label: 'Close', value: 'x' }, { label: '📤 Share', value: 's' }, { label: '⬇ Download', value: 'd', cls: 'primary' }]);
    if (ch === 'd') download(buf, name);
    else if (ch === 's' && !(await share(buf, name))) { download(buf, name); toast('Sharing not supported here - downloaded'); }
  } catch (e) { toast('Could not build Excel: ' + (e.message || e), 'err'); }
  finally { busy(false); }
}

async function deleteOrder(id) {
  const o = S.orders[id]; if (!o) return;
  if (!(await ask('Delete this order?', `"${esc(o.title)}" and all its delivery records will be permanently removed.`, 'Delete', true))) return;
  try { await Promise.all([remove(ref(db, 'po_orders/' + id)), remove(ref(db, 'po_files/' + id))]); toast('Order deleted'); } catch (e) { toast('Delete failed: ' + e.message, 'err'); }
}

/* ---------------------------------- boot ---------------------------------- */

/* readable on any theme: group headings, modal box and modal buttons (they were dark-on-dark / white-on-white) */
function injectFixCss() {
  if (document.getElementById('po-fix-css')) return;
  const st = document.createElement('style'); st.id = 'po-fix-css';
  st.textContent = `
  #po-root .po-brandhead{background:#e0e7ff!important;color:#1e1b4b!important;padding:6px 12px!important;border-radius:10px!important;display:inline-block!important;max-width:100%;font-weight:700;line-height:1.35;overflow-wrap:anywhere}
  .po-modal-box{background:#fff!important;color:#0f172a!important}
  .po-modal-box h4,.po-modal-box div,.po-modal-box p,.po-modal-box label,.po-modal-box span{color:inherit}
  .po-modal-box input{color:#0f172a!important;background:#fff!important}
  .po-modal-actions{display:flex!important;gap:10px!important;justify-content:flex-end!important;flex-wrap:wrap!important;margin-top:16px!important}
  .po-modal .po-btn{background:#fff!important;color:#0f172a!important;border:1px solid #94a3b8!important;font-weight:700!important;opacity:1!important;visibility:visible!important;min-width:90px}
  .po-modal .po-btn.primary{background:#2563eb!important;color:#fff!important;border-color:#2563eb!important}
  .po-modal .po-btn.danger{background:#dc2626!important;color:#fff!important;border-color:#dc2626!important}
  .po-modal .po-btn.green{background:#16a34a!important;color:#fff!important;border-color:#16a34a!important}`;
  document.head.appendChild(st);
}
function boot() {
  injectFixCss();
  const r = root(); if (!r) return;
  r.addEventListener('click', onClick);
  r.addEventListener('change', onChange);
  r.addEventListener('input', onInput);
  r.addEventListener('keydown', onKey);
  document.querySelectorAll('[data-target="' + TAB_ID + '"]').forEach((b) => b.addEventListener('click', () => { start(); render(); }));
  const tab = $(TAB_ID);
  if (tab && tab.classList.contains('active')) { start(); render(); }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
