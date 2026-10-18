// Okno logowania — pojawia się zawsze, gdy brak klucza w sesji.
// Adres API pochodzi z pliku config.js (panel i API są w innym origin).
import { h } from "../ui.js";
import { icon } from "../icons.js";
import { getApiBase, getApiKey, setApiKey } from "../store.js";
import { listMeasurements, health } from "../api.js";

export function renderLogin({ onAuthed }) {
  const errorBox = h("div", { class: "form-error", hidden: true }, icon("alert"), h("span"));
  const errorText = errorBox.querySelector("span");

  const keyInput = h("input", {
    id: "login-key",
    type: "password",
    autocomplete: "off",
    spellcheck: "false",
    placeholder: "klucz ADMIN_API_KEY",
    "aria-label": "API key admina",
    value: getApiKey(),
  });
  const submit = h(
    "button",
    { class: "btn btn--primary btn--block", type: "submit" },
    icon("lock"),
    "Zaloguj"
  );

  const apiBase = getApiBase();

  function showError(message) {
    errorText.textContent = message;
    errorBox.hidden = false;
  }
  function hideError() {
    errorBox.hidden = true;
  }

  async function onSubmit(e) {
    e.preventDefault();
    hideError();
    if (!apiBase) {
      showError("Nie ustawiono adresu API. Uzupełnij pole apiBase w pliku config.js.");
      return;
    }
    const key = keyInput.value.trim();
    if (!key) {
      showError("Podaj API key admina.");
      keyInput.focus();
      return;
    }
    submit.disabled = true;
    submit.replaceChildren(icon("refresh"), "Sprawdzam…");
    setApiKey(key);
    try {
      await health();
      await listMeasurements({ limit: 1 });
      onAuthed();
    } catch (err) {
      if (err && err.status === 403) {
        showError("Klucz został odrzucony. Sprawdź wartość ADMIN_API_KEY.");
      } else if (err && err.status === 401) {
        showError("Brak klucza na żądaniu. Wpisz API key admina.");
      } else {
        showError(err && err.message ? err.message : "Nie udało się połączyć z API.");
      }
    } finally {
      submit.disabled = false;
      submit.replaceChildren(icon("lock"), "Zaloguj");
    }
  }

  const form = h(
    "form",
    { class: "login__form", onsubmit: onSubmit },
    h("div", { class: "field" }, h("label", { for: "login-key" }, "API key admina"), keyInput),
    errorBox,
    h("div", { class: "login__actions" }, submit)
  );

  return h(
    "div",
    { class: "login", role: "dialog", "aria-modal": "true", "aria-labelledby": "login-title" },
    h(
      "div",
      { class: "login__card" },
      h(
        "div",
        { class: "login__brand" },
        icon("droplet", "login__mark"),
        h(
          "div",
          {},
          h("div", { class: "login__name" }, "STACJA"),
          h("div", { class: "login__tag" }, "panel sieci deszczomierzy LoRa")
        )
      ),
      h("h1", { id: "login-title" }, "Podaj API key admina"),
      h(
        "p",
        { class: "login__lead" },
        "Wpisz klucz administratora z konfiguracji API (ADMIN_API_KEY). Klucz obowiązuje tylko w tej sesji przeglądarki."
      ),
      !apiBase
        ? h(
            "div",
            { class: "form-error" },
            icon("alert"),
            h("span", {}, "Brak adresu API. Ustaw pole apiBase w pliku config.js.")
          )
        : null,
      form,
      h(
        "p",
        { class: "hint", style: { marginTop: "16px" } },
        h("span", { class: "muted" }, "API: "),
        h("span", { class: "mono" }, apiBase || "— nie ustawiono —"),
        h("br"),
        "Adres ustawia się w pliku config.js."
      )
    )
  );
}
