// Konfiguracja pochodzi ze statycznego pliku config.js (window.PBL_CONFIG).
// Klucz admina trzymamy w sessionStorage — logowanie jest wymagane w każdej
// sesji przeglądarki. Motyw i interwał odświeżania zapisujemy w localStorage.
const LS = { theme: "pbl.theme", refresh: "pbl.refresh" };
const SS = { key: "pbl.apiKey" };

const cfg = () => (typeof window !== "undefined" && window.PBL_CONFIG) || {};
const asStr = (v) => (typeof v === "string" ? v.trim() : "");

function read(store, name, fallback) {
  try {
    const v = store.getItem(name);
    return v === null ? fallback : v;
  } catch {
    return fallback;
  }
}
function write(store, name, value) {
  try {
    if (value === null || value === undefined || value === "") store.removeItem(name);
    else store.setItem(name, String(value));
  } catch {
    /* prywatny tryb / brak miejsca — ignorujemy */
  }
}

// --- Adres API (z pliku) -------------------------------------------------
export const getApiBase = () => asStr(cfg().apiBase);
export const hasApiBase = () => getApiBase().length > 0;

// --- Klucz admina (na sesję przeglądarki) --------------------------------
export const getApiKey = () => read(sessionStorage, SS.key, "");
export const setApiKey = (v) => write(sessionStorage, SS.key, v);
export const clearApiKey = () => write(sessionStorage, SS.key, "");

// --- Preferencje wyglądu (trwałe) ----------------------------------------
export const getTheme = () => read(localStorage, LS.theme, asStr(cfg().theme) || "auto");
export const setTheme = (v) => write(localStorage, LS.theme, v);

export function getRefresh() {
  const def = cfg().refreshSeconds;
  const fallback = def === undefined || def === null ? "60" : String(def);
  return read(localStorage, LS.refresh, fallback);
}
export const setRefresh = (v) => write(localStorage, LS.refresh, v);
