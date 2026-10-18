// Widok czyszczenia: formularz żądania + historia żądań z API.
import { h, toast, statusBadge, table, relTime, fmtDateTime, stateBlock, skeleton } from "../ui.js";
import { icon } from "../icons.js";
import { listBridges, listSensors, listCommands, createCommand } from "../api.js";

const LIMIT = 1000; // prototyp: bierzemy pierwszą porcję API

export function createView() {
  // --- Formularz ---------------------------------------------------------
  const bridgeSel = h("select", { id: "clean-bridge", onchange: () => loadSensors(bridgeSel.value) });
  const sensorSel = h("select", { id: "clean-sensor" });
  const submit = h(
    "button",
    { class: "btn btn--primary", type: "submit" },
    icon("send"),
    "Wyślij żądanie czyszczenia"
  );
  const formError = h("p", { class: "form-error", hidden: true });

  const form = h(
    "form",
    { onsubmit: onSubmit },
    h(
      "div",
      { class: "clean-form" },
      h("div", { class: "field" }, h("label", { for: "clean-bridge" }, "Mostek"), bridgeSel),
      h("div", { class: "field" }, h("label", { for: "clean-sensor" }, "Sensor"), sensorSel),
      h("div", { class: "field field--action" }, submit)
    ),
    formError
  );

  const formPanel = h(
    "section",
    { class: "panel" },
    h(
      "div",
      { class: "panel__head" },
      h("h2", {}, icon("send"), "Zleć czyszczenie"),
      h("span", { class: "panel__hint" }, "czyszczenie deszczomierza")
    ),
    h("div", { class: "panel__body" }, form)
  );

  // --- Historia ----------------------------------------------------------
  const refreshHint = h("span", { class: "panel__hint" });
  const refreshBtn = h(
    "button",
    { class: "iconbtn", type: "button", "aria-label": "Odśwież historię", title: "Odśwież", onclick: () => loadHistory() },
    icon("refresh")
  );
  const historyBox = h("div", { class: "panel__body panel__body--flush" }, skeleton(5, 5));
  const historyPanel = h(
    "section",
    { class: "panel" },
    h(
      "div",
      { class: "panel__head" },
      h("h2", {}, icon("inbox"), "Historia żądań"),
      h("div", { class: "panel__tools" }, refreshHint, refreshBtn)
    ),
    historyBox
  );

  const el = h("div", { class: "view-enter" }, formPanel, historyPanel);

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
    historyBox.replaceChildren(skeleton(5, 5));
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
        created: h("span", { class: "nowrap" }, fmtDateTime(c.created_at)),
        bridge: h("span", { class: "mono muted" }, c.bridge_id),
        sensor: h("span", { class: "mono" }, c.sensor_id || "—"),
        payload: h("span", { class: "chip mono" }, c.payload),
        status: statusBadge(c.status),
        response: c.responded_at
          ? h(
              "span",
              { class: "nowrap" },
              `${relTime(c.responded_at)}${c.response_note ? ` · ${c.response_note}` : ""}`
            )
          : h("span", { class: "muted" }, "—"),
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
