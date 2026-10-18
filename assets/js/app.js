// Powłoka aplikacji, routing (hash), motyw, stan zdrowia API, auto-odświeżanie.
import { h, clear, toast, confirmDialog } from "./ui.js";
import { icon } from "./icons.js";
import { getApiKey, clearApiKey, getTheme, setTheme, getRefresh, setRefresh } from "./store.js";
import { health, healthReady, listCommands } from "./api.js";
import { renderLogin } from "./views/login.js";

const ROUTES = {
  dashboard: { title: "Pulpit", sub: "Przegląd sieci deszczomierzy", icon: "dashboard", load: () => import("./views/dashboard.js") },
  measurements: { title: "Pomiary", sub: "Zarejestrowane opady", icon: "droplet", load: () => import("./views/measurements.js") },
  commands: { title: "Komendy", sub: "Kolejka czyszczenia deszczomierzy", icon: "send", load: () => import("./views/commands.js") },
  bridges: { title: "Mostki i sensory", sub: "Stacje odbiorcze i deszczomierze", icon: "radio", load: () => import("./views/bridges.js") },
  settings: { title: "Ustawienia", sub: "Połączenie, wygląd, sesja", icon: "sliders", load: () => import("./views/settings.js") },
};
const DEFAULT_ROUTE = "dashboard";

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
  document.documentElement.dataset.theme = theme;
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
    if (isActive) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  }
  closeNav();

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
      toast(sec === "0" ? "Auto-odświeżanie wyłączone." : `Auto-odświeżanie: co ${sec} s.`, { tone: "ok" });
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
async function refreshHealth() {
  if (!refs.healthPill) return;
  try {
    const info = await health();
    apiInfo = info;
    let tone = "ok";
    let label = `API ${info.version || ""}`.trim();
    try {
      await healthReady();
    } catch {
      tone = "warn";
      label = "API · baza?";
    }
    refs.healthPill.dataset.tone = tone;
    clear(refs.healthPill);
    refs.healthPill.append(h("span", { class: "dot" }), label);
    refs.healthPill.title = `pbl-api ${info.version || ""} · ${new Date().toLocaleTimeString("pl-PL")}`;
  } catch {
    refs.healthPill.dataset.tone = "danger";
    clear(refs.healthPill);
    refs.healthPill.append(h("span", { class: "dot" }), "brak połączenia");
  }
}

async function refreshPendingBadge() {
  if (!refs.cmdBadge) return;
  try {
    const page = await listCommands({ status: "PENDING", limit: 1 });
    const n = page.count || 0;
    if (n > 0) {
      refs.cmdBadge.hidden = false;
      refs.cmdBadge.dataset.tone = "warn";
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
    { class: "nav__item", href: `#/${route}`, dataset: { route } },
    icon(meta.icon),
    h("span", {}, meta.title)
  );
  if (route === "commands") {
    link.append(h("span", { class: "nav__badge", hidden: true }));
  }
  return link;
}

function renderShell() {
  refs.navLinks = [];
  const nav = h("nav", { class: "nav", "aria-label": "Nawigacja główna" });
  for (const route of Object.keys(ROUTES)) {
    const link = navLink(route);
    refs.navLinks.push(link);
    nav.append(link);
    if (route === "commands") refs.cmdBadge = link.querySelector(".nav__badge");
  }

  const rail = h(
    "aside",
    { class: "rail" },
    h(
      "div",
      { class: "brand" },
      icon("droplet", "brand__mark"),
      h("div", { class: "brand__text" }, h("span", { class: "brand__name" }, "STACJA"), h("span", { class: "brand__sub" }, "panel opadów"))
    ),
    nav,
    h(
      "div",
      { class: "rail__foot" },
      h("span", { class: "rail__label" }, "Deszczomierze LoRa"),
      h("span", { class: "rail__ver" }, "pbl-api · X-API-Key")
    )
  );

  refs.title = h("h1", { id: "page-title" }, "Pulpit");
  refs.sub = h("p", { id: "page-sub", class: "topbar__sub" }, "");
  refs.healthPill = h("span", { class: "pill", dataset: { tone: "" } }, h("span", { class: "dot" }), "…");
  refs.themeBtn = h(
    "button",
    { class: "iconbtn", type: "button", "aria-pressed": "false", "aria-label": "Przełącz motyw" },
    icon("moon")
  );
  refs.themeBtn.addEventListener("click", () => {
    setTheme(resolvedTheme() === "dark" ? "light" : "dark");
    applyTheme();
  });
  const refreshBtn = h(
    "button",
    { class: "iconbtn", type: "button", "aria-label": "Odśwież dane", title: "Odśwież" },
    icon("refresh")
  );
  refreshBtn.addEventListener("click", () => {
    refreshBtn.animate?.([{ transform: "rotate(0)" }, { transform: "rotate(360deg)" }], { duration: 500 });
    refreshCurrent();
    refreshHealth();
    refreshPendingBadge();
  });
  let logoutBtn = h(
    "button",
    { class: "iconbtn", type: "button", "aria-label": "Wyloguj", title: "Wyloguj" },
    icon("logout")
  );
  logoutBtn.addEventListener("click", logout);

  const menuBtn = h(
    "button",
    { class: "iconbtn index-toggle", type: "button", "aria-label": "Otwórz menu" },
    icon("menu")
  );
  menuBtn.addEventListener("click", () => app.classList.toggle("is-nav-open"));

  const topbar = h(
    "header",
    { class: "topbar" },
    h("div", { class: "topbar__lead" }, menuBtn, h("div", { class: "topbar__title" }, refs.title, refs.sub)),
    h("div", { class: "topbar__actions" }, refs.healthPill, refreshBtn, refs.themeBtn, logoutBtn)
  );

  refs.main = h("main", { id: "main", class: "main", tabindex: "-1" });
  const scrim = h("div", { class: "scrim", onclick: () => closeNav() });

  clear(app);
  app.dataset.phase = "ready";
  app.classList.remove("is-nav-open");
  app.append(rail, h("div", { class: "shell" }, topbar, refs.main), scrim);
}

function closeNav() {
  app.classList.remove("is-nav-open");
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
  app.dataset.phase = "login";
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
