// Widok Mostki i sensory. API nie udostępnia /bridges, więc zestawienie budujemy
// z ostatnich pomiarów oraz z komend.
import {
  h,
  stateBlock,
  skeleton,
  table,
  relTime,
  fmtNum,
  fmtInt,
  fmtDateTime,
  toast,
} from "../ui.js";
import { icon } from "../icons.js";
import { listMeasurements, listCommands } from "../api.js";

const WINDOW_DAYS = 30;
const DAY_MS = 86400000;

export function createView(ctx = {}) {
  const bridgesBody = h("div", { class: "panel__body panel__body--flush" }, skeleton(6, 6));
  const sensorsBody = h("div", { class: "panel__body panel__body--flush" }, skeleton(6, 6));

  const el = h(
    "div",
    { class: "view-enter" },
    h(
      "section",
      { class: "panel" },
      panelHead("radio", "Mostki (stacje odbiorcze)", "ostatnie 1000 pomiarów"),
      bridgesBody
    ),
    h(
      "section",
      { class: "panel" },
      panelHead("droplet", "Sensory (deszczomierze)", "ostatnie 1000 pomiarów"),
      sensorsBody
    )
  );

  async function load() {
    bridgesBody.replaceChildren(skeleton(6, 6));
    sensorsBody.replaceChildren(skeleton(6, 6));
    let page, cmds;
    try {
      const since = Math.floor((Date.now() - WINDOW_DAYS * DAY_MS) / 1000);
      [page, cmds] = await Promise.all([
        listMeasurements({ sent_from: since, limit: 1000 }),
        listCommands({ limit: 1000 }),
      ]);
    } catch (err) {
      bridgesBody.replaceChildren(stateBlock({ iconName: "alert", title: "Nie udało się wczytać danych", hint: err.message }));
      sensorsBody.replaceChildren();
      return;
    }

    const items = page.items || [];
    const byBridge = new Map();
    const bySensor = new Map();

    for (const m of items) {
      const sum = Number(m.value_mm || 0);
      const b = byBridge.get(m.bridge_id) || { id: m.bridge_id, count: 0, sum: 0, sensors: new Set(), last: m.sent_at };
      b.count += 1;
      b.sum += sum;
      b.sensors.add(m.sensor_id);
      if (new Date(m.sent_at) > new Date(b.last)) b.last = m.sent_at;
      byBridge.set(m.bridge_id, b);

      const s = bySensor.get(m.sensor_id) || { id: m.sensor_id, count: 0, sum: 0, bridges: new Set(), last: m.sent_at };
      s.count += 1;
      s.sum += sum;
      s.bridges.add(m.bridge_id);
      if (new Date(m.sent_at) > new Date(s.last)) s.last = m.sent_at;
      bySensor.set(m.sensor_id, s);
    }
    // Mostki znane tylko z komend (bez pomiarów).
    for (const c of cmds.items || []) {
      if (c.bridge_id && !byBridge.has(c.bridge_id)) {
        byBridge.set(c.bridge_id, { id: c.bridge_id, count: 0, sum: 0, sensors: new Set(), last: null });
      }
    }

    const bridgeRows = [...byBridge.values()].sort((a, b) => b.sum - a.sum || a.id.localeCompare(b.id));
    const sensorRows = [...bySensor.values()].sort((a, b) => b.sum - a.sum || a.id.localeCompare(b.id));

    bridgesBody.replaceChildren(
      table(
        [
          { key: "id", label: "Mostek" },
          { key: "sensors", label: "Sensory", numeric: true },
          { key: "count", label: "Pomiarów", numeric: true },
          { key: "sum", label: "Suma", numeric: true },
          { key: "last", label: "Ostatni pomiar" },
          { key: "actions", label: "", numeric: false },
        ],
        bridgeRows.map((b) => ({
          id: h("span", { class: "cell-strong mono" }, b.id),
          sensors: fmtInt(b.sensors.size),
          count: fmtInt(b.count),
          sum: fmtNum(b.sum) + " mm",
          last: b.last ? h("span", { title: fmtDateTime(b.last) }, relTime(b.last)) : h("span", { class: "faint" }, "brak pomiarów"),
          actions: h(
            "button",
            { class: "btn btn--sm", type: "button", onclick: (e) => { e.stopPropagation(); goToMeasurements({ bridge_id: b.id }); } },
            "Pomiary"
          ),
          __click: () => goToMeasurements({ bridge_id: b.id }),
        })),
        { emptyText: "Nie znaleziono mostków w ostatnich 30 dniach." }
      )
    );

    sensorsBody.replaceChildren(
      table(
        [
          { key: "id", label: "Sensor" },
          { key: "bridge", label: "Mostek" },
          { key: "count", label: "Pomiarów", numeric: true },
          { key: "sum", label: "Suma", numeric: true },
          { key: "last", label: "Ostatni pomiar" },
        ],
        sensorRows.map((s) => ({
          id: h("span", { class: "cell-strong mono" }, s.id),
          bridge: h("span", { class: "mono muted" }, [...s.bridges].join(", ")),
          count: fmtInt(s.count),
          sum: fmtNum(s.sum) + " mm",
          last: h("span", { title: fmtDateTime(s.last) }, relTime(s.last)),
          __click: () => goToMeasurements({ sensor_id: s.id }),
        })),
        { emptyText: "Brak sensorów w ostatnich 30 dniach." }
      )
    );

    if (page.has_more) {
      toast("Mostki liczone z pierwszych 1000 pomiarów w oknie 30 dni.", { tone: "info", timeout: 6000 });
    }
  }

  function goToMeasurements(query) {
    const qs = new URLSearchParams(query).toString();
    if (ctx.navigate) ctx.navigate(`#/measurements?${qs}`);
  }

  return { el, load };
}

function panelHead(iconName, title, hint) {
  return h(
    "div",
    { class: "panel__head" },
    h("h2", {}, icon(iconName), title),
    hint ? h("span", { class: "panel__hint" }, hint) : null
  );
}
