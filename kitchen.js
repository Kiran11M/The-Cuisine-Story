// Kitchen / waiter screen: live list of table orders and waiter calls, with sound + pop-up alerts.
(function () {
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = n => "₹" + Math.round(n).toLocaleString("en-IN");
  const PIN_KEY = "cs_staff_pin";
  const REMINDER_MS = 20000;   // repeat the chime while something is waiting
  const SERVED_SHOWN = 30;

  let pin = null;
  let tickets = [];
  let seen = null;             // Set of ticket ids already alerted
  let unwatch = null;
  let soundOn = true;
  let audioCtx = null;
  let busy = new Set();        // ticket ids with an update in flight

  // ---------- Login ----------
  async function login(p, silent) {
    $("loginError").textContent = "";
    try {
      if (!(await API.checkPin(p))) { if (!silent) $("loginError").textContent = "Wrong PIN."; return; }
    } catch (e) {
      $("loginError").innerHTML = API.wrongOrigin
        ? `This page must be opened through the order server. Go to <a href="${API.serverUrlHint}">${API.serverUrlHint}</a>`
        : "Can't reach the order server. Make sure start-server.bat is running. (" + e.message.replace(/[<>&]/g, "") + ")";
      return;
    }
    pin = p;
    try { sessionStorage.setItem(PIN_KEY, p); } catch { /* ignore */ }
    $("login").hidden = true;
    $("board").hidden = false;
    unlockAudio();
    start();
  }

  $("loginForm").addEventListener("submit", e => { e.preventDefault(); login($("pin").value.trim()); });
  $("logoutBtn").addEventListener("click", () => {
    try { sessionStorage.removeItem(PIN_KEY); } catch { /* ignore */ }
    location.reload();
  });

  // ---------- Alerts ----------
  function unlockAudio() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") audioCtx.resume();
    } catch { audioCtx = null; }
  }
  function chime(times = 2) {
    if (!soundOn || !audioCtx) return;
    const t0 = audioCtx.currentTime;
    for (let i = 0; i < times; i++) {
      [880, 1175].forEach((f, j) => {
        const o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.type = "sine"; o.frequency.value = f;
        const st = t0 + i * 0.5 + j * 0.16;
        g.gain.setValueAtTime(0.0001, st);
        g.gain.exponentialRampToValueAtTime(0.4, st + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, st + 0.35);
        o.connect(g).connect(audioCtx.destination);
        o.start(st); o.stop(st + 0.4);
      });
    }
  }
  function popup(title, body) {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    try { new Notification(title, { body, tag: title + body }); } catch { /* ignore */ }
  }
  $("soundBtn").addEventListener("click", () => {
    soundOn = !soundOn;
    unlockAudio();
    $("soundBtn").textContent = soundOn ? "🔔 Sound on" : "🔕 Sound off";
    if (soundOn) chime(1);
  });
  function updateNotifyBtn() {
    const btn = $("notifyBtn");
    if (!("Notification" in window)) { btn.hidden = true; return; }
    btn.hidden = Notification.permission === "granted";
    if (Notification.permission === "denied") btn.textContent = "Pop-ups blocked";
  }
  $("notifyBtn").addEventListener("click", async () => {
    try { await Notification.requestPermission(); } catch { /* ignore */ }
    updateNotifyBtn();
  });
  updateNotifyBtn();
  // Browsers only allow sound after a click, e.g. when the PIN was remembered and login was automatic.
  document.addEventListener("click", unlockAudio);

  function describe(t) {
    if (t.type === "waiter") return "🙋 Waiter requested";
    if (t.type === "bill") return "🧾 Bill requested";
    const n = (t.items || []).reduce((s, i) => s + Number(i.qty || 0), 0);
    return `🍽️ New order · ${n} item${n === 1 ? "" : "s"} · ${money(t.total)}`;
  }

  function checkNew(list) {
    if (!seen) { seen = new Set(list.map(t => t.id)); return; }   // first load: no alerts
    const fresh = list.filter(t => !seen.has(t.id));
    fresh.forEach(t => { seen.add(t.id); popup(`Table ${t.table}`, describe(t)); });
    if (fresh.length) chime(fresh.some(t => t.type === "order") ? 3 : 2);
  }

  setInterval(() => {
    if (tickets.some(t => t.status === "new")) chime(1);
  }, REMINDER_MS);

  // ---------- Data ----------
  function start() {
    if (unwatch) unwatch();
    unwatch = API.watchTickets(pin, list => {
      $("conn").textContent = "● Live";
      $("conn").className = "conn";
      tickets = list;
      checkNew(list);
      render();
    }, err => {
      $("conn").textContent = "● Offline — retrying";
      $("conn").className = "conn offline";
      if (err && err.status === 401) { try { sessionStorage.removeItem(PIN_KEY); } catch { } location.reload(); }
    });
  }

  async function setStatus(id, status) {
    if (busy.has(id)) return;
    busy.add(id);
    const t = tickets.find(x => x.id === id);
    const prev = t && t.status;
    if (t) { t.status = status; render(); }   // optimistic
    try { await API.updateTicket(pin, id, { status }); }
    catch (e) { if (t) { t.status = prev; render(); } alert("Couldn't update: " + e.message); }
    finally { busy.delete(id); }
  }

  document.addEventListener("click", e => {
    const b = e.target.closest("[data-status]");
    if (!b) return;
    if (b.dataset.status === "cancelled" && !confirm("Cancel this order?")) return;
    setStatus(b.dataset.id, b.dataset.status);
  });

  // ---------- Render ----------
  function ago(ms) {
    const m = Math.max(0, Math.floor((Date.now() - ms) / 60000));
    if (m < 1) return "just now";
    if (m < 60) return `${m} min ago`;
    return `${Math.floor(m / 60)} h ${m % 60} min ago`;
  }
  const clock = ms => new Date(ms).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });

  const ACTIONS = {
    new: [["preparing", "Accept & start", "primary"], ["cancelled", "Cancel", "ghost"]],
    preparing: [["ready", "Mark ready", "primary"]],
    ready: [["served", "Served", "primary"], ["preparing", "Back", "ghost"]],
    served: [],
    cancelled: [],
  };

  function orderCard(t) {
    const waitMin = (Date.now() - t.createdAt) / 60000;
    const late = (t.status === "new" && waitMin > 5) || (t.status === "preparing" && waitMin > 30);
    const buttons = (ACTIONS[t.status] || []).map(([s, label, kind]) =>
      `<button type="button" class="k-btn ${kind}" data-id="${esc(t.id)}" data-status="${s}">${label}</button>`).join("");
    return `<article class="k-card ${t.status} ${late ? "late" : ""}">
      <div class="k-card-head">
        <span class="k-table">Table ${esc(t.table)}</span>
        <span class="k-time" title="${esc(clock(t.createdAt))}">${esc(clock(t.createdAt))} · ${ago(t.createdAt)}</span>
      </div>
      ${t.name ? `<p class="k-name">👤 ${esc(t.name)}</p>` : ""}
      <ul class="k-items">${(t.items || []).map(i => `
        <li><b>${esc(i.qty)}×</b> <span class="veg ${i.veg ? "is-veg" : "non-veg"}"></span> ${esc(i.name)}</li>`).join("")}
      </ul>
      ${t.note ? `<p class="k-note">📝 ${esc(t.note)}</p>` : ""}
      <div class="k-card-foot">
        <span>${money(t.total)}</span>
        ${t.status === "cancelled" ? `<span class="k-cancel">Cancelled</span>` : ""}
        <div class="k-actions">${buttons}</div>
      </div>
    </article>`;
  }

  function render() {
    const orders = tickets.filter(t => t.type === "order");
    const by = s => orders.filter(t => t.status === s);
    ["new", "preparing", "ready"].forEach(s => {
      const list = by(s).sort((a, b) => a.createdAt - b.createdAt);
      $("col-" + s).innerHTML = list.map(orderCard).join("") || `<p class="k-empty">Nothing here</p>`;
      $("cnt-" + s).textContent = list.length;
    });
    const done = orders.filter(t => t.status === "served" || t.status === "cancelled").sort((a, b) => b.updatedAt - a.updatedAt);
    $("col-served").innerHTML = done.slice(0, SERVED_SHOWN).map(orderCard).join("") || `<p class="k-empty">Nothing yet</p>`;
    $("cnt-served").textContent = by("served").length;

    const calls = tickets.filter(t => t.type !== "order" && t.status === "new").sort((a, b) => a.createdAt - b.createdAt);
    $("calls").hidden = calls.length === 0;
    $("calls").innerHTML = calls.map(c => `
      <div class="k-call ${c.type}">
        <strong>Table ${esc(c.table)}</strong>
        <span>${c.type === "bill" ? "🧾 wants the bill" : "🙋 needs a waiter"} · ${ago(c.createdAt)}</span>
        <button type="button" class="k-btn primary" data-id="${esc(c.id)}" data-status="done">Done</button>
      </div>`).join("");

    const sales = by("served").reduce((s, t) => s + Number(t.total || 0), 0);
    const pending = by("new").length;
    $("stats").innerHTML = `
      <div><b>${orders.filter(t => t.status !== "cancelled").length}</b><span>orders today</span></div>
      <div><b>${money(sales)}</b><span>served value</span></div>`;
    document.title = (pending + calls.length ? `(${pending + calls.length}) ` : "") + "Kitchen Orders | The Cuisine Story";
  }

  function tickClock() {
    $("clock").textContent = new Date().toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  }
  setInterval(() => { tickClock(); if (pin) render(); }, 30000);
  tickClock();

  // Auto-login if PIN is remembered for this browser tab
  let saved = null;
  try { saved = sessionStorage.getItem(PIN_KEY); } catch { /* ignore */ }
  if (saved) login(saved, true);
})();
