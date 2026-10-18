// Widok czyszczenia: formularz żądania + historia żądań z API.
import { h, toast, statusBadge, table, relTime, fmtDateTime, stateBlock, skeleton } from "../ui.js";
import { icon } from "../icons.js";
import { listBridges, listSensors, listCommands, createCommand } from "../api.js";

const LIMIT = 1000; // prototyp: bierzemy pierwszą porcję API

export function createView() {
  // --- Formularz ---------------------------------------------------------
  const bridgeSel = h("select", {
    id: "clean-bridge",
    class: "form-select",
    onchange: () => loadSensors(bridgeSel.value),
  });
  const sensorSel = h("select", { id: "clean-sensor", class: "form-select" });
  const submit = h(
    "button",
    { class: "btn btn-primary w-100 d-inline-flex align-items-center justify-content-center gap-2", type: "submit" },
    icon("send"),
    "Wyślij żądanie czyszczenia"
  );
  const formError = h("p", { class: "alert alert-danger py-2 small mt-3 mb-0", hidden: true });

  const form = h(
    "form",
    { onsubmit: onSubmit },
    h(
      "div",
      { class: "row g-3 align-items-end" },
      h(
        "div",
        { class: "col-12 col-md-5" },
        h("label", { class: "form-label", for: "clean-bridge" }, "Mostek"),
        bridgeSel
      ),
      h(
        "div",
        { class: "col-12 col-md-4" },
        h("label", { class: "form-label", for: "clean-sensor" }, "Sensor"),
        sensorSel
      ),
      h("div", { class: "col-12 col-md-3" }, submit)
    ),
    formError
  );

  const formCard = h(
    "section",
    { class: "card" },
    h(
      "div",
      { class: "card-header d-flex align-items-center gap-2" },
      icon("send", "text-primary"),
      h("span", { class: "fw-semibold" }, "Wyślij żądanie czyszczenia")
    ),
    h("div", { class: "card-body" }, form)
  );

  // --- Historia ----------------------------------------------------------
  const refreshHint = h("span", { class: "text-body-secondary small" });
  const refreshBtn = h(
    "button",
    { class: "btn btn-outline-secondary btn-sm", type: "button", "aria-label": "Odśwież historię", title: "Odśwież", onclick: () => loadHistory() },
    icon("refresh")
  );
  const historyBox = h("div", { class: "card-body p-0" }, skeleton(5));
  const historyCard = h(
    "section",
    { class: "card" },
    h(
      "div",
      { class: "card-header d-flex flex-wrap align-items-center justify-content-between gap-2" },
      h(
        "span",
        { class: "d-flex align-items-center gap-2" },
        icon("inbox", "text-primary"),
        h("span", { class: "fw-semibold" }, "Historia żądań")
      ),
      h("div", { class: "d-flex align-items-center gap-2" }, refreshHint, refreshBtn)
    ),
    historyBox
  );

  const el = h("div", { class: "vstack gap-3" }, formCard, historyCard);

  function showFormError(message) {
    formError.textContent = message;
    formError.hidden = false;
  }
  function hideFormError() {
    formError.hidden = true;
  }

  // --- Dane --------------------------------------------------------------
  async function loadBridges() {
    bridgeSel.replaceChildren(h("option", { value: "" }, "Wczytywanie…"));
    bridgeSel.disabled = true;
    try {
      const page = await listBridges({ limit: LIMIT });
      const items = page.items || [];
      if (!items.length) {
        bridgeSel.replaceChildren(h("option", { value: "" }, "Brak mostków"));
        sensorSel.replaceChildren(h("option", { value: "" }, "—"));
        sensorSel.disabled = true;
        return;
      }
      bridgeSel.disabled = false;
      bridgeSel.replaceChildren(
        ...items.map((b) =>
          h("option", { value: b.bridge_id }, b.is_active ? b.bridge_id : `${b.bridge_id} (nieaktywny)`)
        )
      );
      await loadSensors(bridgeSel.value);
    } catch (err) {
      bridgeSel.replaceChildren(h("option", { value: "" }, "Błąd wczytywania"));
      showFormError(err.message);
    }
  }

  async function loadSensors(bridgeId) {
    sensorSel.replaceChildren(h("option", { value: "" }, "Wczytywanie…"));
    sensorSel.disabled = true;
    try {
      const page = await listSensors({ bridge_id: bridgeId || undefined, limit: LIMIT });
      const items = page.items || [];
      if (!items.length) {
        sensorSel.replaceChildren(h("option", { value: "" }, "Brak sensorów"));
        return;
      }
      sensorSel.disabled = false;
      sensorSel.replaceChildren(...items.map((s) => h("option", { value: s.sensor_id }, s.sensor_id)));
    } catch (err) {
      sensorSel.replaceChildren(h("option", { value: "" }, "Błąd wczytywania"));
      showFormError(err.message);
    }
  }

  async function loadHistory() {
    historyBox.replaceChildren(h("div", { class: "p-3" }, skeleton(5)));
    try {
      const page = await listCommands({ limit: LIMIT });
      const items = page.items || [];
      refreshHint.textContent = items.length ? `${items.length}${page.has_more ? "+" : ""} żądań` : "";
      historyBox.replaceChildren(historyTable(items));
    } catch (err) {
      refreshHint.textContent = "";
      historyBox.replaceChildren(
        stateBlock({ iconName: "alert", title: "Nie udało się pobrać historii", hint: err.message })
      );
    }
  }

  function historyTable(items) {
    return table(
      [
        { key: "created", label: "Wysłano" },
        { key: "bridge", label: "Mostek" },
        { key: "sensor", label: "Sensor" },
        { key: "payload", label: "Payload" },
        { key: "status", label: "Status" },
        { key: "response", label: "Odpowiedź" },
      ],
      items.map((c) => ({
        created: h("span", { class: "text-nowrap" }, fmtDateTime(c.created_at)),
        bridge: h("span", { class: "mono text-body-secondary" }, c.bridge_id),
        sensor: h("span", { class: "mono" }, c.sensor_id || "—"),
        payload: h("code", { class: "mono" }, c.payload),
        status: statusBadge(c.status),
        response: c.responded_at
          ? h(
              "span",
              {},
              h("span", { class: "text-nowrap" }, relTime(c.responded_at)),
              c.response_note ? h("span", { class: "d-block text-body-secondary small" }, c.response_note) : null
            )
          : h("span", { class: "text-body-secondary" }, "—"),
      })),
      { emptyText: "Brak żądań czyszczenia." }
    );
  }

  async function onSubmit(e) {
    e.preventDefault();
    hideFormError();
    const bridge_id = bridgeSel.value;
    const sensor_id = sensorSel.value;
    if (!bridge_id || !sensor_id) {
      showFormError("Wybierz mostek i sensor.");
      return;
    }
    submit.disabled = true;
    submit.replaceChildren(icon("refresh"), "Wysyłam…");
    try {
      await createCommand({ bridge_id, sensor_id, command_type: "clean" });
      toast(`Żądanie czyszczenia dla ${sensor_id} wysłane.`, { tone: "ok" });
      await loadHistory();
    } catch (err) {
      showFormError(err.message);
      toast(err.message, { tone: "danger" });
    } finally {
      submit.disabled = false;
      submit.replaceChildren(icon("send"), "Wyślij żądanie czyszczenia");
    }
  }

  async function load() {
    hideFormError();
    await Promise.all([loadBridges(), loadHistory()]);
  }

  return { el, load };
}
