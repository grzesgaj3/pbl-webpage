// Okno logowania — pojawia się zawsze, gdy brak klucza w sesji.
// Adres API pochodzi z pliku config.js (panel i API są w innym origin).
import { h } from "../ui.js";
import { icon } from "../icons.js";
import { getApiBase, getApiKey, setApiKey } from "../store.js";
import { listMeasurements, health } from "../api.js";

export function renderLogin({ onAuthed }) {
  const errorBox = h(
    "div",
    { class: "alert alert-danger py-2 small d-flex align-items-start gap-2", hidden: true },
    icon("alert"),
    h("span")
  );
  const errorText = errorBox.querySelector("span");

  const keyInput = h("input", {
    id: "login-key",
    class: "form-control",
    type: "password",
    autocomplete: "off",
    spellcheck: "false",
    placeholder: "klucz ADMIN_API_KEY",
    "aria-label": "API key admina",
    value: getApiKey(),
  });
  const submit = h(
    "button",
    { class: "btn btn-primary w-100 d-inline-flex align-items-center justify-content-center gap-2", type: "submit" },
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
    { onsubmit: onSubmit },
    h(
      "div",
      { class: "mb-3" },
      h("label", { class: "form-label", for: "login-key" }, "API key admina"),
      keyInput
    ),
    errorBox,
    submit
  );

  return h(
    "div",
    {
      class: "d-flex align-items-center justify-content-center min-vh-100 p-3",
      role: "dialog",
      "aria-modal": "true",
      "aria-labelledby": "login-title",
    },
    h(
      "div",
      { class: "card shadow-sm", style: { width: "100%", maxWidth: "26rem" } },
      h(
        "div",
        { class: "card-body p-4" },
        h(
          "div",
          { class: "d-flex align-items-center gap-2 mb-3" },
          icon("droplet", "fs-3 text-primary"),
          h(
            "div",
            {},
            h("div", { class: "fw-semibold lh-1" }, "STACJA"),
            h("div", { class: "text-body-secondary small" }, "panel sieci deszczomierzy LoRa")
          )
        ),
        h("h1", { id: "login-title", class: "h4 mb-2" }, "Podaj API key admina"),
        h(
          "p",
          { class: "text-body-secondary small" },
          "Wpisz klucz administratora z konfiguracji API (ADMIN_API_KEY). Klucz obowiązuje tylko w tej sesji przeglądarki."
        ),
        !apiBase
          ? h(
              "div",
              { class: "alert alert-warning py-2 small d-flex align-items-start gap-2" },
              icon("alert"),
              h("span", {}, "Brak adresu API. Ustaw pole apiBase w pliku config.js.")
            )
          : null,
        form,
        h(
          "p",
          { class: "text-body-secondary small mt-3 mb-0" },
          "API: ",
          h("span", { class: "mono" }, apiBase || "— nie ustawiono —"),
          h("br"),
          "Adres ustawia się w pliku config.js."
        )
      )
    )
  );
}
