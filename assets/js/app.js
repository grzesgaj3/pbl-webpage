// Powłoka aplikacji, routing (hash), motyw Bootstrapa, stan API, auto‑odświeżanie.
import { h, clear, toast, confirmDialog } from "./ui.js";
import { icon } from "./icons.js";
import { getApiKey, clearApiKey, getTheme, setTheme, getRefresh, setRefresh } from "./store.js";
import { health, healthReady, listCommands } from "./api.js";
import { renderLogin } from "./views/login.js";

const ROUTES = {
  overview: {
    title: "Wykresy",
    sub: "Opady z poszczególnych sensorów",
    icon: "droplet",
    load: () => import("./views/overview.js"),
  },
  cleaning: {
    title: "Czyszczenie",
    sub: "Żądania czyszczenia deszczomierzy",
    icon: "send",
    load: () => import("./views/cleaning.js"),
  },
};
const DEFAULT_ROUTE = "overview";

const app = document.getElementById("app");
let current = null; // { route, view }
let refreshTimer = null;
let healthTimer = null;
const refs = {};

// --- Motyw ---------------------------------------------------------------
function resolvedTheme() {
  const pref = getTheme();
  if (pref === "light" || pref === "dark") return pref;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
function applyTheme() {
  const theme = resolvedTheme();
  document.documentElement.setAttribute("data-bs-theme", theme);
  if (refs.themeBtn) {
    refs.themeBtn.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
    refs.themeBtn.title = theme === "dark" ? "Motyw jasny" : "Motyw ciemny";
    clear(refs.themeBtn);
    refs.themeBtn.append(icon(theme === "dark" ? "sun" : "moon"));
  }
  window.dispatchEvent(new CustomEvent("pbl:theme"));
}
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  if (getTheme() === "auto") applyTheme();
});

// --- Routing -------------------------------------------------------------
function parseHash() {
  const raw = window.location.hash.replace(/^#\/?/, "");
  const [path, qs] = raw.split("?");
  const route = ROUTES[path] ? path : DEFAULT_ROUTE;
  const params = Object.fromEntries(new URLSearchParams(qs || ""));
  return { route, params };
}

function navigate(hash) {
  if (window.location.hash === hash) mount();
  else window.location.hash = hash;
}

async function mount() {
  if (!getApiKey()) return renderLoginScreen();
  const { route, params } = parseHash();
  if (!ROUTES[route]) {
    navigate(`#/${DEFAULT_ROUTE}`);
    return;
  }
  // Zwalniamy poprzedni widok (wykresy, nasłuchy).
  if (current && current.view.destroy) {
    try {
      current.view.destroy();
    } catch {
      /* ignore */
    }
  }
  clear(refs.main);

  const meta = ROUTES[route];
  refs.title.textContent = meta.title;
  refs.sub.textContent = meta.sub;
  document.title = `STACJA · ${meta.title}`;
  for (const a of refs.navLinks) {
    const isActive = a.dataset.route === route;
    a.classList.toggle("active", isActive);
    if (isActive) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  }

  const mod = await meta.load();
  const view = mod.createView({
    params,
    navigate,
    setTheme: (mode) => {
      setTheme(mode);
      applyTheme();
    },
    setRefresh: (sec) => {
      setRefresh(sec);
      restartRefresh();
      toast(sec === "0" ? "Auto‑odświeżanie wyłączone." : `Auto‑odświeżanie: co ${sec} s.`, { tone: "ok" });
    },
    logout,
  });
  refs.main.append(view.el);
  current = { route, view };
  if (typeof view.load === "function") {
    try {
      await view.load();
    } catch (err) {
      toast(err && err.message ? err.message : "Błąd wczytywania widoku.", { tone: "danger" });
    }
  }
  // Tytuł widoku dla czytników ekranu.
  refs.main.setAttribute("aria-label", meta.title);
}

function refreshCurrent() {
  if (!current || !current.view.load) return;
  try {
    current.view.load();
  } catch {
    /* ignore */
  }
}

// --- Auto-odświeżanie ----------------------------------------------------
function restartRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
  const sec = Number(getRefresh() || "0");
  if (!sec) return;
  refreshTimer = setInterval(() => {
    if (document.hidden) return;
    refreshCurrent();
    refreshHealth();
    refreshPendingBadge();
  }, sec * 1000);
}

// --- Stan API ------------------------------------------------------------
const PILL_TONE = { ok: "success", warn: "warning", danger: "danger" };
const pillClass = (tone) => `badge rounded-pill pill text-bg-${PILL_TONE[tone] || "secondary"}`;

async function refreshHealth() {
  if (!refs.healthPill) return;
  try {
    const info = await health();
    let tone = "ok";
    let label = `API ${(info && info.version) || ""}`.trim();
    let note = "połączenie OK";
    try {
      await healthReady();
    } catch (err) {
      tone = "warn";
      label = "API · baza?";
      note = `baza danych niedostępna (${err && err.status ? "HTTP " + err.status : (err && err.message) || "błąd"})`;
    }
    refs.healthPill.dataset.tone = tone;
    refs.healthPill.className = pillClass(tone);
    clear(refs.healthPill);
    refs.healthPill.append(h("span", { class: "dot" }), label);
    refs.healthPill.title = `pbl-api ${(info && info.version) || ""} · ${new Date().toLocaleTimeString("pl-PL")} · ${note}`;
  } catch (err) {
    const reason =
      err && err.status ? `HTTP ${err.status} — ${err.message}` : (err && err.message) || "nieznany błąd";
    refs.healthPill.dataset.tone = "danger";
    refs.healthPill.className = pillClass("danger");
    clear(refs.healthPill);
    refs.healthPill.append(h("span", { class: "dot" }), "brak połączenia");
    refs.healthPill.title = `Health check nieudany: ${reason}`;
    console.warn("[STACJA] health check nieudany:", err);
  }
}

async function refreshPendingBadge() {
  if (!refs.cmdBadge) return;
  try {
    const page = await listCommands({ status: "PENDING", limit: 1 });
    const n = page.count || 0;
    if (n > 0) {
      refs.cmdBadge.hidden = false;
      refs.cmdBadge.textContent = page.has_more ? "1+" : String(n);
    } else {
      refs.cmdBadge.hidden = true;
    }
  } catch {
    refs.cmdBadge.hidden = true;
  }
}

// --- Powłoka -------------------------------------------------------------
function navLink(route) {
  const meta = ROUTES[route];
  const link = h(
    "a",
    {
      class: "nav-link d-flex align-items-center gap-2",
      href: `#/${route}`,
      dataset: { route },
    },
    icon(meta.icon),
    h("span", {}, meta.title)
  );
  if (route === "cleaning") {
    link.append(h("span", { class: "badge rounded-pill text-bg-warning", hidden: true }));
  }
  return link;
}

function renderShell() {
  refs.navLinks = [];
  const navList = h("ul", { class: "nav nav-pills flex-nowrap" });
  for (const route of Object.keys(ROUTES)) {
    const link = navLink(route);
    refs.navLinks.push(link);
    navList.append(h("li", { class: "nav-item" }, link));
    if (route === "cleaning") refs.cmdBadge = link.querySelector(".badge");
  }

  refs.healthPill = h(
    "span",
    { class: "badge rounded-pill pill text-bg-secondary", dataset: { tone: "" } },
    h("span", { class: "dot" }),
    "…"
  );
  refs.themeBtn = h(
    "button",
    { class: "btn btn-outline-secondary btn-sm", type: "button", "aria-pressed": "false", "aria-label": "Przełącz motyw" },
    icon("moon")
  );
  refs.themeBtn.addEventListener("click", () => {
    setTheme(resolvedTheme() === "dark" ? "light" : "dark");
    applyTheme();
  });
  const refreshBtn = h(
    "button",
    { class: "btn btn-outline-secondary btn-sm", type: "button", "aria-label": "Odśwież dane", title: "Odśwież" },
    icon("refresh")
  );
  refreshBtn.addEventListener("click", () => {
    refreshCurrent();
    refreshHealth();
    refreshPendingBadge();
  });
  const logoutBtn = h(
    "button",
    { class: "btn btn-outline-secondary btn-sm", type: "button", "aria-label": "Wyloguj", title: "Wyloguj" },
    icon("logout")
  );
  logoutBtn.addEventListener("click", logout);

  const navbar = h(
    "nav",
    { class: "navbar navbar-expand bg-body border-bottom sticky-top" },
    h(
      "div",
      { class: "container-xl flex-wrap gap-2" },
      h(
        "a",
        { class: "navbar-brand d-flex align-items-center gap-2 me-2", href: `#/${DEFAULT_ROUTE}` },
        icon("droplet"),
        h("span", { class: "fw-semibold" }, "STACJA")
      ),
      navList,
      h("div", { class: "d-flex align-items-center gap-2 ms-auto" }, refs.healthPill, refreshBtn, refs.themeBtn, logoutBtn)
    )
  );

  refs.title = h("h1", { id: "page-title", class: "h4 mb-0" }, ROUTES[DEFAULT_ROUTE].title);
  refs.sub = h("p", { id: "page-sub", class: "text-body-secondary mb-0" }, "");
  refs.main = h("div", { id: "main", tabindex: "-1" });

  clear(app);
  app.append(
    navbar,
    h(
      "main",
      { class: "container-xl py-4" },
      h("div", { class: "d-flex flex-wrap align-items-baseline gap-2 mb-3" }, refs.title, refs.sub),
      refs.main
    )
  );
}

// --- Sesja ---------------------------------------------------------------
async function logout() {
  const ok = await confirmDialog({
    title: "Wylogować?",
    message: "Klucz administratora zostanie usunięty z tej sesji przeglądarki. Aby wrócić, podasz go ponownie.",
    confirmLabel: "Wyloguj",
    danger: true,
  });
  if (!ok) return;
  clearApiKey();
  if (refreshTimer) clearInterval(refreshTimer);
  if (current && current.view.destroy) current.view.destroy();
  current = null;
  renderLoginScreen();
  toast("Wylogowano. Klucz usunięty.", { tone: "ok" });
}

function renderLoginScreen() {
  clear(app);
  app.append(
    renderLogin({
      onAuthed: async () => {
        renderShell();
        await mount();
        refreshHealth();
        refreshPendingBadge();
        restartRefresh();
      },
    })
  );
}

// --- Start ---------------------------------------------------------------
async function boot() {
  applyTheme();
  window.addEventListener("hashchange", mount);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refreshHealth();
  });
  if (!getApiKey()) {
    renderLoginScreen();
    return;
  }
  renderShell();
  await mount();
  refreshHealth();
  refreshPendingBadge();
  restartRefresh();
  // Okresowy, tani test zdrowia (niezależny od widoku).
  healthTimer = setInterval(() => !document.hidden && refreshHealth(), 60000);
}

boot();
