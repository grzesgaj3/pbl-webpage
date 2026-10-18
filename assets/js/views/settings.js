// Widok Ustawienia: informacja o adresie API (z config.js), wygląd, odświeżanie, sesja.
import { h, badge } from "../ui.js";
import { icon } from "../icons.js";
import { getApiBase, getApiKey, getTheme, getRefresh } from "../store.js";
import { health, healthReady } from "../api.js";

const REFRESH_OPTIONS = [
  { value: "0", label: "Wyłączone" },
  { value: "30", label: "co 30 sekund" },
  { value: "60", label: "co 60 sekund" },
  { value: "300", label: "co 5 minut" },
];
const THEME_OPTIONS = [
  { value: "auto", label: "Automatyczny (wg systemu)" },
  { value: "light", label: "Jasny" },
  { value: "dark", label: "Ciemny" },
];

function maskKey(key) {
  if (!key) return "—";
  if (key.length <= 10) return "•".repeat(key.length);
  return `${key.slice(0, 4)}${"•".repeat(6)}${key.slice(-4)}`;
}

export function createView(ctx = {}) {
  const healthState = h(
    "div",
    { class: "muted", style: { fontSize: "13.5px", marginTop: "10px" } },
    "Nie sprawdzono."
  );

  const theme = h(
    "select",
    { id: "s-theme", onchange: () => ctx.setTheme && ctx.setTheme(theme.value) },
    THEME_OPTIONS.map((o) => h("option", { value: o.value, selected: getTheme() === o.value ? true : null }, o.label))
  );
  const refresh = h(
    "select",
    { id: "s-refresh", onchange: () => ctx.setRefresh && ctx.setRefresh(refresh.value) },
    REFRESH_OPTIONS.map((o) => h("option", { value: o.value, selected: getRefresh() === o.value ? true : null }, o.label))
  );

  async function testConnection() {
    healthState.replaceChildren("Sprawdzam…");
    try {
      const info = await health();
      let ready = null;
      try {
        ready = await healthReady();
      } catch {
        ready = null;
      }
      healthState.replaceChildren(
        h(
          "div",
          { style: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px" } },
          badge("API odpowiada", "ok"),
          badge("wersja " + (info.version || "?"), "info"),
          ready ? badge("baza gotowa", "ok") : badge("baza niedostępna", "warn")
        )
      );
    } catch (err) {
      healthState.replaceChildren(badge(err.message || "brak połączenia", "danger"));
    }
  }

  const apiBase = getApiBase();

  const el = h(
    "div",
    { class: "view-enter" },
    h(
      "section",
      { class: "panel" },
      panelHead("sliders", "Połączenie"),
      h(
        "div",
        { class: "panel__body" },
        h(
          "dl",
          { class: "kv" },
          h("dt", {}, "Adres API"),
          h("dd", {}, apiBase ? h("span", { class: "mono" }, apiBase) : badge("nie ustawiono", "danger"))
        ),
        h(
          "p",
          { class: "hint" },
          "Adres ustawia się w pliku ",
          h("span", { class: "mono" }, "config.js"),
          " (pole ",
          h("span", { class: "mono" }, "apiBase"),
          "). Panel i API są w innym origin, więc po stronie API musi być włączony CORS (",
          h("span", { class: "mono" }, "CORS_ORIGINS"),
          ")."
        ),
        h(
          "div",
          { style: { marginTop: "14px" } },
          h("button", { class: "btn", type: "button", onclick: testConnection }, icon("refresh"), "Sprawdź połączenie")
        ),
        healthState
      )
    ),
    h(
      "section",
      { class: "panel" },
      panelHead("sun", "Wygląd i odświeżanie"),
      h(
        "div",
        {
          class: "panel__body",
          style: { display: "grid", gap: "16px", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" },
        },
        h("div", { class: "field" }, h("label", { for: "s-theme" }, "Motyw"), theme),
        h("div", { class: "field" }, h("label", { for: "s-refresh" }, "Automatyczne odświeżanie"), refresh),
        h(
          "p",
          { class: "hint", style: { gridColumn: "1 / -1" } },
          "Wartości domyślne pochodzą z config.js; zmiany tutaj działają tylko w tej przeglądarce."
        )
      )
    ),
    h(
      "section",
      { class: "panel" },
      panelHead("logout", "Sesja"),
      h(
        "div",
        { class: "panel__body" },
        h(
          "dl",
          { class: "kv" },
          h("dt", {}, "Klucz admina"),
          h("dd", {}, h("span", { class: "mono" }, maskKey(getApiKey()))),
          h("dt", {}, "Przechowywanie"),
          h("dd", {}, "sessionStorage — do zamknięcia karty")
        ),
        h(
          "p",
          { class: "hint" },
          "Klucz wysyłany jest wyłącznie do API w nagłówku X-API-Key. Logowanie jest wymagane w każdej nowej sesji przeglądarki."
        ),
        h(
          "div",
          { style: { marginTop: "16px" } },
          h(
            "button",
            { class: "btn btn--danger", type: "button", onclick: () => ctx.logout && ctx.logout() },
            icon("logout"),
            "Wyloguj"
          )
        )
      )
    ),
    h(
      "section",
      { class: "panel" },
      panelHead("info", "O panelu"),
      h(
        "div",
        { class: "panel__body" },
        h(
          "p",
          { class: "muted", style: { lineHeight: "1.6", maxWidth: "70ch" } },
          "Statyczny panel dla pbl-api (deszczomierze LoRa). Nie zużywa pamięci serwera — pliki serwuje nginx, logika działa w przeglądarce. Wykresy: Chart.js z CDN.",
          h("br"),
          "Widok administracyjny: tworzenie komend czyszczenia i podgląd danych. Potwierdzanie i odrzucanie komend wykonuje mostek (wymaga klucza bridge)."
        ),
        h(
          "p",
          { class: "hint" },
          "Statystyki na pulpicie są liczone z wczytanej porcji danych (limit API), a nie z pełnej historii."
        )
      )
    )
  );

  setTimeout(testConnection, 0);

  return { el, load: async () => {} };
}

function panelHead(iconName, title) {
  return h("div", { class: "panel__head" }, h("h2", {}, icon(iconName), title));
}
