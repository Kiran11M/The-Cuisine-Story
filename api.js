// Data layer for table orders and waiter calls ("tickets").
// Uses Firebase Firestore when firebase-config.js is filled in, otherwise the local server (server.ps1).
//
// Ticket: { id, type: "order"|"waiter"|"bill", table, name, note, items:[{id,name,price,qty,veg}],
//           total, status, createdAt, updatedAt }
// Order statuses: new → preparing → ready → served (or cancelled). Call statuses: new → done.
(function () {
  const POLL_MS = 3000;
  const FB_VERSION = "10.12.2";
  const useFirebase = !!(window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.projectId);

  function poll(fn, cb, onError) {
    let stopped = false;
    let timer;
    async function tick() {
      try { const data = await fn(); if (!stopped) cb(data); }
      catch (e) { if (!stopped && onError) onError(e); }
      if (!stopped) timer = setTimeout(tick, POLL_MS);
    }
    tick();
    return () => { stopped = true; clearTimeout(timer); };
  }

  async function http(method, path, body, pin) {
    const headers = {};
    if (body) headers["Content-Type"] = "application/json";
    if (pin) headers["X-Staff-Pin"] = pin;
    const res = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined, cache: "no-store" });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { /* not JSON */ }
    if (!res.ok) {
      const err = new Error((data && data.error) || `Request failed (${res.status})`);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  // ---------- Local server backend ----------
  const serverBackend = {
    mode: "server",
    ready: Promise.resolve(),
    createTicket: t => http("POST", "api/tickets", t),
    watchTicket: (id, cb, onError) => poll(() => http("GET", "api/tickets/" + encodeURIComponent(id)), cb, onError),
    watchTickets: (pin, cb, onError) => poll(() => http("GET", "api/tickets", null, pin).then(list => list || []), cb, onError),
    updateTicket: (pin, id, patch) => http("PATCH", "api/tickets/" + encodeURIComponent(id), patch, pin),
    checkPin: pin => http("GET", "api/tickets", null, pin).then(() => true, e => { if (e.status === 401) return false; throw e; }),
  };

  // ---------- Firebase backend ----------
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src; s.onload = resolve; s.onerror = () => reject(new Error("Could not load " + src));
      document.head.appendChild(s);
    });
  }
  function dayKey(ms) {
    const d = new Date(ms);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function makeFirebaseBackend() {
    let col;
    const ready = (async () => {
      await loadScript(`https://www.gstatic.com/firebasejs/${FB_VERSION}/firebase-app-compat.js`);
      await loadScript(`https://www.gstatic.com/firebasejs/${FB_VERSION}/firebase-firestore-compat.js`);
      firebase.initializeApp(window.FIREBASE_CONFIG);
      col = firebase.firestore().collection("tickets");
    })();
    const docToTicket = d => ({ id: d.id, ...d.data() });

    return {
      mode: "firebase",
      ready,
      async createTicket(t) {
        await ready;
        const now = Date.now();
        const ref = await col.add({ ...t, status: "new", createdAt: now, updatedAt: now, day: dayKey(now) });
        return { id: ref.id };
      },
      watchTicket(id, cb, onError) {
        let unsub = () => {};
        ready.then(() => { unsub = col.doc(id).onSnapshot(d => cb(d.exists ? docToTicket(d) : null), onError); }, onError);
        return () => unsub();
      },
      watchTickets(pin, cb, onError) {
        let unsub = () => {};
        ready.then(() => {
          unsub = col.where("day", "==", dayKey(Date.now())).onSnapshot(
            snap => cb(snap.docs.map(docToTicket).sort((a, b) => a.createdAt - b.createdAt)), onError);
        }, onError);
        return () => unsub();
      },
      async updateTicket(pin, id, patch) {
        await ready;
        await col.doc(id).update({ status: patch.status, updatedAt: Date.now() });
      },
      async checkPin(pin) { return String(pin) === String(window.STAFF_PIN); },
    };
  }

  window.API = useFirebase ? makeFirebaseBackend() : serverBackend;

  // In local-server mode the page must be opened through the server (http://localhost:8080/...),
  // not by double-clicking the file or through another dev server, or every request fails.
  const page = location.pathname.split("/").pop() || "index.html";
  window.API.serverUrlHint = `http://localhost:8080/${page}${location.search}`;
  window.API.wrongOrigin = !useFirebase && (location.protocol === "file:" || location.port !== "8080");
  if (!useFirebase && location.protocol === "file:") location.replace(window.API.serverUrlHint);
})();
