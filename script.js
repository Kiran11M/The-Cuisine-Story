// ---------- Config ----------
const RESTAURANT_WHATSAPP = "916364698860";
const LUNCH_SLOTS = ["12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30"];
const DINNER_SLOTS = ["19:00", "19:30", "20:00", "20:30", "21:00", "21:30", "22:00"];
const MAX_GUESTS = 10;
const STORAGE_KEY = "cuisineStoryBookings";

// ---------- Tabs ----------
const panels = document.querySelectorAll(".tab-panel");
const navLinks = document.querySelectorAll(".nav a");
const nav = document.querySelector(".nav");
const navToggle = document.querySelector(".nav-toggle");

function showTab(id) {
  if (!document.getElementById(id)) id = "home";
  panels.forEach(p => p.classList.toggle("active", p.id === id));
  navLinks.forEach(a => a.classList.toggle("active", a.dataset.tab === id));
  nav.classList.remove("open");
  navToggle.setAttribute("aria-expanded", "false");
  window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
}

document.addEventListener("click", e => {
  const link = e.target.closest("[data-tab]");
  if (!link) return;
  e.preventDefault();
  const id = link.dataset.tab;
  if (location.hash !== "#" + id) history.pushState(null, "", "#" + id);
  showTab(id);
});
window.addEventListener("popstate", () => showTab(location.hash.slice(1)));
navToggle.addEventListener("click", () => {
  const open = nav.classList.toggle("open");
  navToggle.setAttribute("aria-expanded", String(open));
});
showTab(location.hash.slice(1) || "home");

// ---------- Menu (data in menu-data.js) ----------
const menuList = document.getElementById("menuList");
const menuFilters = document.getElementById("menuFilters");
function renderMenu(filter = "all") {
  const items = filter === "all" ? window.MENU : window.MENU.filter(m => m.cat === filter);
  menuList.innerHTML = items.map(m => `
    <div class="menu-item">
      ${m.img ? `<img class="menu-thumb" src="${m.img}" alt="${m.name}" loading="lazy">`
              : `<span class="veg ${m.veg ? "is-veg" : "non-veg"}" title="${m.veg ? "Vegetarian" : "Non-vegetarian"}"></span>`}
      <div class="info">
        <h4><span>${m.img ? `<span class="veg ${m.veg ? "is-veg" : "non-veg"}"></span> ` : ""}${m.name}</span><span class="price">₹${m.price}</span></h4>
        <p>${m.desc}</p>
      </div>
    </div>`).join("");
}
menuFilters.innerHTML = [{ id: "all", name: "All" }, ...window.MENU_CATEGORIES]
  .map((c, i) => `<button class="chip${i ? "" : " active"}" data-filter="${c.id}">${c.name}</button>`).join("");
menuFilters.addEventListener("click", e => {
  const chip = e.target.closest(".chip");
  if (!chip) return;
  menuFilters.querySelectorAll(".chip").forEach(c => c.classList.toggle("active", c === chip));
  renderMenu(chip.dataset.filter);
});
renderMenu();

// ---------- Booking ----------
const form = document.getElementById("bookingForm");
const dateInput = document.getElementById("bDate");
const guestPicker = document.getElementById("guestPicker");
const formError = document.getElementById("formError");
let selectedGuests = 2;
let selectedSlot = null;

function pad(n) { return String(n).padStart(2, "0"); }
function toISODate(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function fmtTime(t) {
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${pad(m)} ${h < 12 ? "AM" : "PM"}`;
}
function fmtDate(iso) {
  return new Date(iso + "T00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

// Date: today .. +60 days
const today = new Date();
const maxDate = new Date(); maxDate.setDate(today.getDate() + 60);
dateInput.min = toISODate(today);
dateInput.max = toISODate(maxDate);
dateInput.value = toISODate(today);

// Guests
for (let i = 1; i <= MAX_GUESTS; i++) {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = i === MAX_GUESTS ? `${i}` : i;
  b.setAttribute("aria-label", `${i} guest${i > 1 ? "s" : ""}`);
  if (i === selectedGuests) b.classList.add("selected");
  b.addEventListener("click", () => {
    selectedGuests = i;
    guestPicker.querySelectorAll("button").forEach(x => x.classList.toggle("selected", x === b));
  });
  guestPicker.appendChild(b);
}

// Time slots (past slots disabled for today, with 30 min lead time)
function renderSlots() {
  const isToday = dateInput.value === toISODate(new Date());
  const now = new Date();
  const cutoff = now.getHours() * 60 + now.getMinutes() + 30;
  [["lunchSlots", LUNCH_SLOTS], ["dinnerSlots", DINNER_SLOTS]].forEach(([id, slots]) => {
    const wrap = document.getElementById(id);
    wrap.innerHTML = "";
    slots.forEach(t => {
      const [h, m] = t.split(":").map(Number);
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = fmtTime(t);
      b.disabled = isToday && h * 60 + m < cutoff;
      if (t === selectedSlot && !b.disabled) b.classList.add("selected");
      b.addEventListener("click", () => {
        selectedSlot = t;
        document.querySelectorAll(".slots button").forEach(x => x.classList.toggle("selected", x === b));
      });
      wrap.appendChild(b);
    });
  });
  if (selectedSlot && !document.querySelector(".slots button.selected")) selectedSlot = null;
}
dateInput.addEventListener("change", renderSlots);
renderSlots();

// Saved bookings (stored in this browser)
function loadBookings() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { return []; }
}
function saveBookings(list) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch { /* storage unavailable */ }
}
function renderMyBookings() {
  const wrap = document.getElementById("myBookings");
  const todayISO = toISODate(new Date());
  const list = loadBookings().filter(b => b.date >= todayISO).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  if (!list.length) { wrap.innerHTML = '<p class="muted">No upcoming bookings.</p>'; return; }
  wrap.innerHTML = list.map(b => `
    <div class="booking-entry">
      <strong>${fmtDate(b.date)} · ${fmtTime(b.time)}</strong>
      <div class="row"><span>${b.guests} guest${b.guests > 1 ? "s" : ""} · ${b.ref}</span>
      <button type="button" data-cancel="${b.ref}">Cancel</button></div>
    </div>`).join("");
}
document.getElementById("myBookings").addEventListener("click", e => {
  const ref = e.target.dataset.cancel;
  if (!ref || !confirm("Cancel this booking? Please also let the restaurant know.")) return;
  saveBookings(loadBookings().filter(b => b.ref !== ref));
  renderMyBookings();
});
renderMyBookings();

// Submit
form.addEventListener("submit", e => {
  e.preventDefault();
  formError.textContent = "";
  form.querySelectorAll(".invalid").forEach(el => el.classList.remove("invalid"));

  const name = form.elements.name.value.trim();
  const phone = form.elements.phone.value.replace(/\D/g, "");
  const email = form.elements.email.value.trim();

  const errors = [];
  if (name.length < 2) { errors.push("Please enter your name."); form.elements.name.classList.add("invalid"); }
  if (!/^[6-9]\d{9}$/.test(phone)) { errors.push("Please enter a valid 10-digit mobile number."); form.elements.phone.classList.add("invalid"); }
  if (email && !form.elements.email.checkValidity()) { errors.push("Please enter a valid email."); form.elements.email.classList.add("invalid"); }
  if (!dateInput.value || dateInput.value < dateInput.min || dateInput.value > dateInput.max) {
    errors.push("Please choose a date within the next 60 days."); dateInput.classList.add("invalid");
  }
  if (!selectedSlot) errors.push("Please pick a time slot.");
  if (errors.length) { formError.textContent = errors[0]; return; }

  const booking = {
    ref: "CS" + Date.now().toString(36).toUpperCase().slice(-6),
    name, phone, email,
    date: dateInput.value,
    time: selectedSlot,
    guests: selectedGuests,
    seating: form.elements.seating.value,
    notes: form.elements.notes.value.trim(),
  };
  saveBookings([...loadBookings(), booking]);
  renderMyBookings();
  openConfirm(booking);

  form.reset();
  dateInput.value = toISODate(new Date());
  selectedSlot = null;
  renderSlots();
});

// Confirmation modal
const modal = document.getElementById("confirmModal");
function openConfirm(b) {
  const rows = [
    ["Booking ID", b.ref], ["Name", b.name], ["Date", fmtDate(b.date)],
    ["Time", fmtTime(b.time)], ["Guests", b.guests], ["Seating", b.seating],
  ];
  if (b.notes) rows.push(["Requests", b.notes]);
  const detail = document.getElementById("confirmDetails");
  detail.innerHTML = "";
  rows.forEach(([k, v]) => {
    const row = document.createElement("div");
    const a = document.createElement("span"); a.textContent = k;
    const c = document.createElement("span"); c.textContent = v;
    row.append(a, c); detail.appendChild(row);
  });

  const msg = [
    "Hello The Cuisine Story, I'd like to book a table.",
    ...rows.map(([k, v]) => `${k}: ${v}`),
    `Phone: ${b.phone}`,
  ].join("\n");
  document.getElementById("waConfirm").href = `https://wa.me/${RESTAURANT_WHATSAPP}?text=${encodeURIComponent(msg)}`;
  modal.hidden = false;
}
function closeConfirm() { modal.hidden = true; }
document.getElementById("closeModal").addEventListener("click", closeConfirm);
modal.addEventListener("click", e => { if (e.target === modal) closeConfirm(); });
document.addEventListener("keydown", e => { if (e.key === "Escape" && !modal.hidden) closeConfirm(); });

document.getElementById("year").textContent = new Date().getFullYear();
