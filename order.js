// QR table ordering: customers browse the menu, build a cart and send it to the kitchen.
(function () {
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = n => "₹" + Math.round(n).toLocaleString("en-IN");
  const CALL_COOLDOWN_MS = 60000;

  const store = {
    get(key, fallback) { try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; } catch { return fallback; } },
    set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ } },
  };

  // ---------- Table ----------
  const params = new URLSearchParams(location.search);
  const table = (params.get("table") || params.get("t") || "").trim();
  const validTable = /^[A-Za-z0-9-]{1,10}$/.test(table);

  if (!validTable) {
    $("tablePrompt").hidden = false;
    $("tableForm").addEventListener("submit", e => {
      e.preventDefault();
      const t = $("tableInput").value.trim();
      if (!/^[A-Za-z0-9-]{1,10}$/.test(t)) { $("tableInput").focus(); return; }
      params.set("table", t);
      location.search = params.toString();
    });
    return;
  }

  $("tablePill").textContent = "Table " + table;
  $("tablePill").hidden = false;
  $("orderApp").hidden = false;
  $("quickActions").hidden = false;
  document.title = `Table ${table} | The Cuisine Story`;

  const CART_KEY = "cs_cart_" + table;
  const ORDERS_KEY = "cs_orders_" + table;
  const menuById = Object.fromEntries(window.MENU.map(m => [m.id, m]));

  // cart: { itemId: qty }, dropping items no longer on the menu
  let cart = store.get(CART_KEY, {});
  for (const id of Object.keys(cart)) if (!menuById[id] || !(cart[id] > 0)) delete cart[id];

  // ---------- Toast ----------
  let toastTimer;
  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 3200);
  }

  // ---------- Menu ----------
  function controlHtml(id) {
    const qty = cart[id] || 0;
    if (!qty) return `<button class="add-btn" type="button" data-add="${id}">ADD</button>`;
    return `<div class="stepper"><button type="button" data-dec="${id}" aria-label="Remove one">−</button><span>${qty}</span><button type="button" data-inc="${id}" aria-label="Add one">+</button></div>`;
  }

  function renderMenu() {
    const q = $("search").value.trim().toLowerCase();
    const vegOnly = $("vegOnly").checked;
    let shown = 0;
    const html = window.MENU_CATEGORIES.map(cat => {
      const items = window.MENU.filter(m => m.cat === cat.id && (!vegOnly || m.veg) &&
        (!q || m.name.toLowerCase().includes(q) || m.desc.toLowerCase().includes(q)));
      if (!items.length) return "";
      shown += items.length;
      return `<section class="o-section" id="cat-${cat.id}">
        <h2>${esc(cat.name)}</h2>
        ${items.map(m => `
          <article class="o-item">
            <div class="o-item-text">
              <span class="veg ${m.veg ? "is-veg" : "non-veg"}" title="${m.veg ? "Veg" : "Non-veg"}"></span>
              <h3>${esc(m.name)}</h3>
              <p class="o-price">${money(m.price)}</p>
              <p class="o-desc">${esc(m.desc)}</p>
            </div>
            <div class="o-item-media">
              ${m.img ? `<img src="${esc(m.img)}" alt="${esc(m.name)}" loading="lazy">` : `<div class="o-noimg">${esc(m.name.charAt(0))}</div>`}
              <div class="o-ctrl" data-ctrl="${m.id}">${controlHtml(m.id)}</div>
            </div>
          </article>`).join("")}
      </section>`;
    }).join("");
    $("menuSections").innerHTML = html;
    $("noResults").hidden = shown > 0;
  }

  function renderCatNav() {
    $("catNav").innerHTML = window.MENU_CATEGORIES
      .filter(c => window.MENU.some(m => m.cat === c.id))
      .map(c => `<a href="#cat-${c.id}" class="chip">${esc(c.name)}</a>`).join("");
  }

  function setQty(id, qty) {
    if (!menuById[id]) return;
    if (qty > 0) cart[id] = Math.min(qty, 50); else delete cart[id];
    store.set(CART_KEY, cart);
    document.querySelectorAll(`[data-ctrl="${id}"]`).forEach(el => { el.innerHTML = controlHtml(id); });
    renderCartBar();
    if (!$("cartSheet").hidden) renderCartLines();
  }

  document.addEventListener("click", e => {
    const t = e.target.closest("[data-add],[data-inc],[data-dec]");
    if (!t) return;
    if (t.dataset.add) { setQty(t.dataset.add, 1); return; }
    if (t.dataset.inc) setQty(t.dataset.inc, (cart[t.dataset.inc] || 0) + 1);
    if (t.dataset.dec) setQty(t.dataset.dec, (cart[t.dataset.dec] || 0) - 1);
  });
  $("search").addEventListener("input", renderMenu);
  $("vegOnly").addEventListener("change", renderMenu);

  // ---------- Cart ----------
  function cartSummary() {
    let count = 0, total = 0;
    for (const [id, qty] of Object.entries(cart)) { count += qty; total += menuById[id].price * qty; }
    return { count, total };
  }

  function renderCartBar() {
    const { count, total } = cartSummary();
    $("cartBar").hidden = count === 0;
    document.body.classList.toggle("has-cart", count > 0);
    $("cartCount").textContent = `${count} item${count === 1 ? "" : "s"}`;
    $("cartTotal").textContent = money(total);
  }

  function renderCartLines() {
    const ids = Object.keys(cart);
    if (!ids.length) { closeSheet("cartSheet"); return; }
    $("cartLines").innerHTML = ids.map(id => {
      const m = menuById[id];
      return `<div class="cart-line">
        <span class="veg ${m.veg ? "is-veg" : "non-veg"}"></span>
        <div class="cart-line-name">${esc(m.name)}<small>${money(m.price)} each</small></div>
        <div data-ctrl="${id}">${controlHtml(id)}</div>
        <strong>${money(m.price * cart[id])}</strong>
      </div>`;
    }).join("");
    $("sheetTotal").textContent = money(cartSummary().total);
  }

  function openSheet(id) { $(id).hidden = false; document.body.classList.add("no-scroll"); }
  function closeSheet(id) { $(id).hidden = true; document.body.classList.remove("no-scroll"); }
  document.querySelectorAll(".sheet-backdrop").forEach(bd => {
    bd.addEventListener("click", e => { if (e.target === bd || e.target.closest("[data-close]")) closeSheet(bd.id); });
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") document.querySelectorAll(".sheet-backdrop:not([hidden])").forEach(bd => closeSheet(bd.id));
  });

  $("cartBar").addEventListener("click", () => { $("orderError").textContent = ""; renderCartLines(); openSheet("cartSheet"); });

  let placing = false;
  $("placeOrder").addEventListener("click", async () => {
    if (placing) return;
    const items = Object.entries(cart).map(([id, qty]) => {
      const m = menuById[id];
      return { id, name: m.name, price: m.price, qty, veg: m.veg };
    });
    if (!items.length) return;
    placing = true;
    $("placeOrder").disabled = true;
    $("placeOrder").textContent = "Sending to kitchen…";
    $("orderError").textContent = "";
    try {
      const { id } = await API.createTicket({
        type: "order", table, items,
        note: $("orderNote").value.trim(), name: $("orderName").value.trim(),
      });
      const mine = store.get(ORDERS_KEY, []);
      mine.push({ id, createdAt: Date.now() });
      store.set(ORDERS_KEY, mine);
      cart = {};
      store.set(CART_KEY, cart);
      $("orderNote").value = "";
      renderMenu();
      renderCartBar();
      closeSheet("cartSheet");
      watchOrder(id);
      openSheet("ordersSheet");
      toast("Order sent to the kitchen! 🎉");
    } catch (err) {
      $("orderError").textContent = API.wrongOrigin
        ? "This page isn't connected to the order server. Open " + API.serverUrlHint + " instead."
        : "Couldn't send your order. Please check your WiFi connection or call a waiter. (" + err.message + ")";
    } finally {
      placing = false;
      $("placeOrder").disabled = false;
      $("placeOrder").textContent = "Place order";
    }
  });

  // ---------- My orders (live status) ----------
  const STEPS = [["new", "Received"], ["preparing", "Preparing"], ["ready", "Ready"], ["served", "Served"]];
  const orders = {};      // id -> latest ticket
  const watching = {};    // id -> unsubscribe

  function todaysOrderIds() {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const mine = store.get(ORDERS_KEY, []).filter(o => o.createdAt >= start.getTime());
    store.set(ORDERS_KEY, mine);
    return mine.map(o => o.id);
  }

  function watchOrder(id) {
    if (watching[id]) return;
    watching[id] = API.watchTicket(id, ticket => {
      if (!ticket) return;
      const prev = orders[id];
      orders[id] = ticket;
      if (prev && prev.status !== ticket.status) {
        if (ticket.status === "preparing") toast("👨‍🍳 The kitchen is preparing your order");
        if (ticket.status === "ready") toast("🍽️ Your food is ready and on its way!");
        if (ticket.status === "cancelled") toast("Your order was cancelled. Please ask a waiter.");
      }
      if (["served", "cancelled"].includes(ticket.status) && watching[id]) { watching[id](); watching[id] = () => {}; }
      renderOrders();
    }, () => { /* keep retrying silently */ });
  }

  function renderOrders() {
    const list = Object.values(orders).sort((a, b) => b.createdAt - a.createdAt);
    const active = list.filter(o => !["served", "cancelled"].includes(o.status)).length;
    $("ordersBadge").hidden = active === 0;
    $("ordersBadge").textContent = active;
    if (!list.length) { $("ordersList").innerHTML = `<p class="muted center">You haven't placed an order yet.</p>`; return; }
    $("ordersList").innerHTML = list.map(o => {
      const stepIdx = STEPS.findIndex(s => s[0] === o.status);
      const time = new Date(o.createdAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
      const progress = o.status === "cancelled"
        ? `<p class="status-cancelled">Cancelled — please speak to a waiter.</p>`
        : `<ol class="progress">${STEPS.map((s, i) => `<li class="${i <= stepIdx ? "done" : ""} ${i === stepIdx ? "current" : ""}">${s[1]}</li>`).join("")}</ol>`;
      return `<div class="order-card">
        <div class="order-card-head"><strong>Order at ${esc(time)}</strong><span>${money(o.total)}</span></div>
        ${progress}
        <ul class="order-items">${(o.items || []).map(i => `<li>${esc(i.qty)} × ${esc(i.name)}</li>`).join("")}</ul>
        ${o.note ? `<p class="order-note">Note: ${esc(o.note)}</p>` : ""}
      </div>`;
    }).join("");
  }

  $("openOrders").addEventListener("click", () => { renderOrders(); openSheet("ordersSheet"); });

  // ---------- Waiter / bill ----------
  function setupCall(buttonId, type, okMsg) {
    const btn = $(buttonId);
    const key = `cs_call_${type}_${table}`;
    const label = btn.innerHTML;
    function cooldown() {
      const left = store.get(key, 0) + CALL_COOLDOWN_MS - Date.now();
      if (left > 0) {
        btn.disabled = true;
        setTimeout(() => { btn.disabled = false; btn.innerHTML = label; }, left);
      }
    }
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      try {
        await API.createTicket({ type, table });
        store.set(key, Date.now());
        toast(okMsg);
        cooldown();
      } catch (err) {
        btn.disabled = false;
        toast("Couldn't reach the staff. Please wave to a waiter. (" + err.message + ")");
      }
    });
    cooldown();
  }
  setupCall("callWaiter", "waiter", "🙋 A waiter is on the way to your table");
  setupCall("askBill", "bill", "🧾 Your bill is being prepared");

  // ---------- Init ----------
  renderCatNav();
  renderMenu();
  renderCartBar();
  todaysOrderIds().forEach(watchOrder);
  renderOrders();
  if (API.wrongOrigin) toast("Open this page through the order server: " + API.serverUrlHint);
})();
