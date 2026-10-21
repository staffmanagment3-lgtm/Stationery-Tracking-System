/* =====================================================================================
   Login Tutorial for teachers (v1.0.0)  -  login-tutorial.js
   - Fully separate overlay. It does NOT touch the login form, handleUserLogin, Firebase or the QR/URL.
   - Shows a welcome screen + 4 short steps BEFORE the login page for people who are not logged in.
   - Shown once per device (Skip / finish remembers it). Open the app with  ?tutorial=1  to always show it.
   - A small "How to log in?" button on the login page opens it again any time.
   ===================================================================================== */
(function () {
  'use strict';

  var SEEN_KEY = 'loginTutorialSeen';
  var params = new URLSearchParams(location.search);
  var forced = params.get('tutorial') === '1';

  function safeGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function safeSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { } }

  var loggedIn = !!safeGet('stationery_user_adec');     // same key app.js uses for a saved session
  var seen = safeGet(SEEN_KEY) === '1';

  /* ---------- styles (all prefixed "lt-") ---------- */
  var css = [
    '.lt-ov{position:fixed;inset:0;z-index:5000;display:flex;align-items:center;justify-content:center;padding:16px;',
    'padding-top:max(16px,env(safe-area-inset-top));padding-bottom:max(16px,env(safe-area-inset-bottom));',
    'background:linear-gradient(135deg,#0a1128 0%,#1c2b4b 45%,#2c3e6b 75%,#0d1b2a 100%);overflow-y:auto;',
    'font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;-webkit-font-smoothing:antialiased}',
    '.lt-ov[hidden]{display:none!important}',
    '.lt-card{width:100%;max-width:460px;margin:auto;background:#f3f6fa;border-radius:26px;padding:26px 22px 20px;',
    'box-shadow:0 24px 48px rgba(0,0,0,.38);color:#1e293b;text-align:center;animation:lt-in .28s ease}',
    '@keyframes lt-in{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}',
    '.lt-logo{display:block;margin:0 auto 10px;max-height:78px;max-width:100%;object-fit:contain}',
    '.lt-app{font-size:.8rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#2563eb;margin:0 0 6px}',
    '.lt-card h2{font-size:1.4rem;font-weight:800;line-height:1.3;margin:0 0 10px;color:#0f1a3a}',
    '.lt-card p{font-size:.95rem;line-height:1.55;color:#475569;margin:0 0 12px}',
    '.lt-step{display:inline-block;font-size:.74rem;font-weight:800;color:#1d4ed8;background:#dbeafe;border-radius:999px;padding:4px 12px;margin-bottom:10px}',
    '.lt-ex{margin:14px 0 6px;background:#fff;border:2px dashed #93c5fd;border-radius:16px;padding:14px 10px}',
    '.lt-ex small{display:block;font-size:.72rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px}',
    '.lt-code{font-size:clamp(1.35rem,7vw,1.9rem);font-weight:800;letter-spacing:.04em;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;word-break:break-all}',
    '.lt-code .a{color:#1d4ed8}.lt-code .b{color:#15803d}.lt-code .s{color:#c2410c}',
    '.lt-legend{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;margin-top:10px}',
    '.lt-legend span{font-size:.74rem;font-weight:700;border-radius:999px;padding:3px 10px}',
    '.lt-legend .a{background:#dbeafe;color:#1d4ed8}.lt-legend .b{background:#dcfce7;color:#15803d}.lt-legend .s{background:#ffedd5;color:#c2410c}',
    '.lt-note{text-align:left;background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:10px 12px;margin:10px 0 0}',
    '.lt-note li{font-size:.86rem;line-height:1.5;color:#334155;margin:4px 0}',
    '.lt-note ul{margin:0;padding-left:18px}',
    '.lt-warn{background:#fef3c7;border-color:#fde68a}',
    '.lt-dots{display:flex;gap:6px;justify-content:center;margin:16px 0 4px}',
    '.lt-dots i{width:8px;height:8px;border-radius:99px;background:#cbd5e1;transition:all .2s}',
    '.lt-dots i.on{width:22px;background:#2563eb}',
    '.lt-actions{display:flex;gap:10px;margin-top:14px}',
    '.lt-btn{flex:1;min-height:50px;border:0;border-radius:999px;font-size:1rem;font-weight:700;cursor:pointer;',
    'display:inline-flex;align-items:center;justify-content:center;transition:transform .15s,filter .15s}',
    '.lt-btn:active{transform:translateY(1px)}.lt-btn:hover{filter:brightness(1.06)}',
    '.lt-primary{background:linear-gradient(135deg,#3b82f6 0%,#1d4ed8 100%);color:#fff;box-shadow:0 4px 14px rgba(59,130,246,.32)}',
    '.lt-ghost{background:#fff;color:#334155;border:1px solid #cbd5e1}',
    '.lt-skip{display:block;margin:12px auto 0;background:none;border:0;color:#64748b;font-size:.9rem;font-weight:600;cursor:pointer;padding:8px 14px;text-decoration:underline}',
    '.lt-btn:focus-visible,.lt-skip:focus-visible,.lt-help:focus-visible{outline:3px solid rgba(59,130,246,.6);outline-offset:2px}',
    '.lt-help{position:fixed;left:14px;bottom:max(14px,env(safe-area-inset-bottom));z-index:4000;border:0;border-radius:999px;',
    'background:#fff;color:#1d4ed8;font-weight:700;font-size:.85rem;padding:10px 16px;min-height:42px;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.28)}',
    '.lt-help[hidden]{display:none!important}',
    '@media (prefers-reduced-motion:reduce){.lt-card{animation:none}.lt-dots i{transition:none}}'
  ].join('');

  /* ---------- content ---------- */
  var STEPS = [
    {
      step: 'Step 1 of 4',
      title: 'Enter your Login ID',
      text: 'On the login page, type the Login ID given to you by the school administrator in the first box. On the page this box is named <b>ADEK Pass Number</b>.',
      example: { label: 'Example only', html: '<span class="a">PASS</span><span class="b">123456</span>', legend: [['a', 'PASS = capital letters'], ['b', '123456 = numbers']] },
      notes: [
        '<b>PASS</b> is written in <b>capital letters</b>, followed by <b>numbers</b>.',
        'Always use the Login ID assigned to you by the school administrator. <b>PASS123456</b> is only an example for demonstration.'
      ]
    },
    {
      step: 'Step 2 of 4',
      title: 'Enter your Password',
      text: 'Type your password in the second box exactly as it was given to you.',
      example: { label: 'Example only', html: '<span class="a">JYS</span><span class="s">@</span><span class="b">123456</span>', legend: [['a', 'JYS = capital letters'], ['s', '@ = symbol'], ['b', '123456 = numbers']] },
      notes: [
        'The format is <b>capital letters</b>, then the <b>@</b> symbol, then <b>numbers</b>.',
        'Passwords are case-sensitive, so type capital letters exactly as given. Tap the <b>eye icon</b> to check what you typed.',
        '<b>JYS@123456</b> is only an example. Use the password given to you and never share it.'
      ]
    },
    {
      step: 'Step 3 of 4',
      title: 'Tap “Login to Dashboard”',
      text: 'Check both boxes once, then press the blue <b>Login to Dashboard</b> button.',
      notes: [
        'If you type the wrong details <b>5 times</b>, login is locked for <b>2 minutes</b>. Please check carefully before you tap.'
      ],
      warn: true
    },
    {
      step: 'Step 4 of 4',
      title: 'Faster login next time',
      text: 'After your first login the app may offer <b>Face ID / Fingerprint</b>. Enable it to log in with one touch next time.',
      notes: [
        'Forgot your password? Tap <b>Forgot Password?</b> on the login page, or contact the school administrator.'
      ]
    }
  ];

  var ov, help, idx = 0, lastFocus = null;

  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

  function logoHTML() {
    return '<img class="lt-logo" src="school.png" alt="School logo" onerror="this.style.display=\'none\'">';
  }

  function render() {
    var card = ov.querySelector('.lt-card');
    var h;
    if (idx === 0) {
      h = logoHTML() +
        '<p class="lt-app">Stationery Tracker</p>' +
        '<h2>Welcome to Stationery Tracker</h2>' +
        '<p>Learn how to log in using your assigned Login ID and Password.</p>' +
        '<div class="lt-actions"><button type="button" class="lt-btn lt-primary" data-a="next">Start Tutorial</button></div>' +
        '<button type="button" class="lt-skip" data-a="skip">Skip Tutorial</button>';
    } else {
      var s = STEPS[idx - 1], last = idx === STEPS.length;
      h = '<span class="lt-step">' + s.step + '</span>' +
        '<h2>' + s.title + '</h2><p>' + s.text + '</p>';
      if (s.example) {
        h += '<div class="lt-ex"><small>' + s.example.label + '</small><div class="lt-code">' + s.example.html + '</div><div class="lt-legend">' +
          s.example.legend.map(function (l) { return '<span class="' + l[0] + '">' + l[1] + '</span>'; }).join('') + '</div></div>';
      }
      h += '<div class="lt-note' + (s.warn ? ' lt-warn' : '') + '"><ul>' + s.notes.map(function (n) { return '<li>' + n + '</li>'; }).join('') + '</ul></div>';
      h += '<div class="lt-dots" aria-hidden="true">' + STEPS.map(function (_, i) { return '<i class="' + (i === idx - 1 ? 'on' : '') + '"></i>'; }).join('') + '</div>';
      h += '<div class="lt-actions"><button type="button" class="lt-btn lt-ghost" data-a="back">Back</button>' +
        '<button type="button" class="lt-btn lt-primary" data-a="' + (last ? 'done' : 'next') + '">' + (last ? 'Go to Login' : 'Next') + '</button></div>';
      if (!last) h += '<button type="button" class="lt-skip" data-a="skip">Skip Tutorial</button>';
    }
    card.innerHTML = h;
    var primary = card.querySelector('.lt-primary');
    if (primary) primary.focus({ preventScroll: true });
    ov.scrollTop = 0;
  }

  function open(startAt) {
    if (!ov) build();
    idx = startAt || 0;
    lastFocus = document.activeElement;
    ov.hidden = false;
    document.documentElement.style.overflow = 'hidden';
    render();
  }

  function close() {
    if (!ov) return;
    ov.hidden = true;
    document.documentElement.style.overflow = '';
    safeSet(SEEN_KEY, '1');
    syncHelp();
    var f = document.getElementById('login-pass-number');
    try { (f || lastFocus) && (f || lastFocus).focus && (f || lastFocus).focus({ preventScroll: true }); } catch (e) { }
  }

  function build() {
    if (!document.getElementById('lt-style')) { var st = document.createElement('style'); st.id = 'lt-style'; st.textContent = css; document.head.appendChild(st); }
    ov = el('div', 'lt-ov');
    ov.hidden = true;
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-label', 'Login tutorial');
    ov.appendChild(el('div', 'lt-card'));
    ov.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-a]');
      if (!b) return;
      var a = b.getAttribute('data-a');
      if (a === 'next') { idx++; render(); }
      else if (a === 'back') { idx = Math.max(0, idx - 1); render(); }
      else close();                       // skip / done
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && ov && !ov.hidden) close(); });
    document.body.appendChild(ov);
  }

  /* ---------- "How to log in?" button (only while the login page is on screen) ---------- */
  function loginVisible() {
    var lv = document.getElementById('login-view');
    return !!lv && lv.classList.contains('active') && !safeGet('stationery_user_adec');
  }
  function syncHelp() {
    if (!help) return;
    help.hidden = !(loginVisible() && (!ov || ov.hidden));
  }
  function buildHelp() {
    help = el('button', 'lt-help', '❓ How to log in?');
    help.type = 'button';
    help.hidden = true;
    help.addEventListener('click', function () { open(0); });
    document.body.appendChild(help);
    var lv = document.getElementById('login-view');
    if (lv && window.MutationObserver) new MutationObserver(syncHelp).observe(lv, { attributes: true, attributeFilter: ['class', 'style'] });
    setInterval(syncHelp, 1500);          // also covers logout (session key removed)
    syncHelp();
  }

  function init() {
    if (!document.getElementById('lt-style')) { var st = document.createElement('style'); st.id = 'lt-style'; st.textContent = css; document.head.appendChild(st); }
    buildHelp();
    if (!loggedIn && (forced || !seen)) open(0);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
