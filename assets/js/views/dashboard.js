// Pulpit: odczyty zbiorcze, wykres opadów dziennych, suma per mostek,
// ostatnie pomiary i oczekujące komendy.
import { h, clear, relTime, fmtNum, fmtInt, fmtDateTime, stateBlock, skeleton, table } from "../ui.js";
import { icon } from "../icons.js";
import { listMeasurements, listCommands } from "../api.js";
import { loadChart, rainfallChart, bridgeChart, destroyChart, themeColors } from "../charts.js";

const DAY_MS = 86400000;
const WINDOW_DAYS = 30;
const CHART_DAYS = 14;

const dayKey = (d) => {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

function readout(iconName, label) {
  return h(
    "div",
    { class: "readout" },
    h("div", { class: "readout__label" }, icon(iconName), label),
    h("div", { class: "readout__value" }, "—"),
    h("div", { class: "readout__foot" })
  );
}

export function createView() {
  const kpis = h(
    "div",
    { class: "panel", style: { marginBottom: "18px" } },
    h(
      "div",
      { class: "readouts" },
      (() => {
        const a = readout("clock", "Ostatni pomiar");
        const b = readout("droplet", "Pomiary · 30 dni");
        const c = readout("gauge", "Suma opadów · 30 dni");
        const d = readout("radio", "Aktywne mostki · 30 dni");
        const e = readout("send", "Komendy oczekujące");
        return [a, b, c, d, e];
      })()
    )
  );
  const readouts = kpis.querySelectorAll(".readout");

  const rainBox = h("div", { class: "panel__body" }, skeleton(6, 6));
  const rainNote = h("div", { class: "chart-note" });
  const rainPanel = h(
    "section",
    { class: "panel" },
    panelHead("droplet", "Opady dzienne", `ostatnie ${CHART_DAYS} dni`),
    rainBox,
    rainNote
  );

  const bridgeBox = h("div", { class: "panel__body" }, skeleton(6, 6));
  const bridgePanel = h(
    "section",
    { class: "panel" },
    panelHead("radio", "Suma wg mostka", `${WINDOW_DAYS} dni`),
    bridgeBox
  );

  const recentBox = h("div", { class: "panel__body panel__body--flush" }, skeleton(5, 6));
  const recentPanel = h(
    "section",
    { class: "panel" },
    panelHead("clock", "Ostatnie pomiary"),
    recentBox
  );

  const pendingBox = h("div", { class: "panel__body panel__body--flush" }, skeleton(4, 5));
  const pendingPanel = h(
    "section",
    { class: "panel" },
    panelHead("send", "Komendy oczekujące"),
    pendingBox
  );

  const el = h(
    "div",
    { class: "view-enter" },
    kpis,
    h("div", { class: "grid grid--dash" }, rainPanel, bridgePanel),
    h("div", { class: "grid grid--dash", style: { marginTop: "18px" } }, recentPanel, pendingPanel)
  );

  let charts = { rain: null, bridge: null };
  let cache = { series: null, bridges: null };

  function setReadout(i, value, foot, valueNode) {
    const r = readouts[i];
    if (!r) return;
    const v = r.querySelector(".readout__value");
    const f = r.querySelector(".readout__foot");
    clear(v);
    if (valueNode) v.append(valueNode);
    else v.textContent = value;
    f.textContent = foot || "";
  }

  async function load() {
    let latest, windowed, pending, allCommands;
    try {
      const since = Math.floor((Date.now() - WINDOW_DAYS * DAY_MS) / 1000);
      [latest, windowed, pending, allCommands] = await Promise.all([
        listMeasurements({ limit: 1 }),
        listMeasurements({ sent_from: since, limit: 500 }),
        listCommands({ status: "PENDING", limit: 100 }),
        listCommands({ limit: 100 }),
      ]);
    } catch (err) {
      rainBox.replaceChildren(stateBlock({ iconName: "alert", title: "Nie udało się wczytać danych", hint: err.message }));
      bridgeBox.replaceChildren();
      recentBox.replaceChildren(stateBlock({ iconName: "alert", title: "Błąd wczytywania", hint: err.message }));
      pendingBox.replaceChildren();
      return;
    }

    const items = windowed.items || [];
    const sum = items.reduce((acc, m) => acc + Number(m.value_mm || 0), 0);
    const bridges = new Set(items.map((m) => m.bridge_id));

    const last = (latest.items || [])[0];
    if (last) {
      const v = h("span");
      v.append(fmtNum(last.value_mm));
      v.append(h("small", {}, " mm"));
      setReadout(0, null, `${relTime(last.sent_at)} · ${last.sensor_id} @ ${last.bridge_id}`, v);
    } else {
      setReadout(0, "—", "brak danych");
    }
    setReadout(1, fmtInt(items.length) + (windowed.has_more ? "+" : ""), windowed.has_more ? "wczytano pierwsze 500" : "wczytane w oknie");
    setReadout(2, null, "wczytane w oknie", (() => {
      const v = h("span");
      v.append(fmtNum(sum));
      v.append(h("small", {}, " mm"));
      return v;
    })());
    setReadout(3, fmtInt(bridges.size), "z pomiarów w oknie");
    setReadout(4, fmtInt((pending.items || []).length) + (pending.has_more ? "+" : ""), (pending.items || []).length ? "do obsłużenia przez mostki" : "kolejka pusta");

    // Seria dzienna — ostatnie CHART_DAYS dni.
    const byDay = new Map();
    for (const m of items) {
      const d = new Date(m.sent_at);
      if (Number.isNaN(d.getTime())) continue;
      const k = dayKey(d);
      byDay.set(k, (byDay.get(k) || 0) + Number(m.value_mm || 0));
    }
    const labels = [];
    const values = [];
    const labelFmt = new Intl.DateTimeFormat("pl-PL", { day: "2-digit", month: "2-digit" });
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    for (let i = CHART_DAYS - 1; i >= 0; i--) {
      const d = new Date(base.getTime() - i * DAY_MS);
      labels.push(labelFmt.format(d));
      values.push(Number((byDay.get(dayKey(d)) || 0).toFixed(2)));
    }
    const perBridge = new Map();
    for (const m of items) perBridge.set(m.bridge_id, (perBridge.get(m.bridge_id) || 0) + Number(m.value_mm || 0));
    const bSorted = [...perBridge.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    cache.series = { labels, values };
    cache.bridges = { labels: bSorted.map((x) => x[0]), values: bSorted.map((x) => Number(x[1].toFixed(2))) };

    recentBox.replaceChildren(
      table(
        [
          { key: "sensor", label: "Sensor" },
          { key: "bridge", label: "Mostek" },
          { key: "value", label: "Opad", numeric: true },
          { key: "sent", label: "Wysłano", numeric: false },
        ],
        items.slice(0, 8).map((m) => ({
          sensor: h("span", { class: "cell-strong mono" }, m.sensor_id),
          bridge: h("span", { class: "mono muted" }, m.bridge_id),
          value: fmtNum(m.value_mm) + " mm",
          sent: h("span", { class: "nowrap" }, fmtDateTime(m.sent_at)),
        })),
        { emptyText: "Brak pomiarów w ostatnich 30 dniach." }
      )
    );

    pendingBox.replaceChildren(
      table(
        [
          { key: "id", label: "ID", numeric: true },
          { key: "bridge", label: "Mostek" },
          { key: "sensor", label: "Sensor" },
          { key: "payload", label: "Payload" },
          { key: "created", label: "Utworzono" },
        ],
        (pending.items || []).slice(0, 8).map((c) => ({
          id: "#" + c.id,
          bridge: h("span", { class: "mono muted" }, c.bridge_id),
          sensor: h("span", { class: "mono" }, c.sensor_id || "—"),
          payload: h("span", { class: "chip mono" }, c.payload),
          created: h("span", { class: "nowrap" }, relTime(c.created_at)),
        })),
        { emptyText: "Kolejka komend jest pusta." }
      )
    );

    await drawCharts();
  }

  async function drawCharts() {
    if (!cache.series) return;
    try {
      await loadChart();
    } catch (err) {
      rainBox.replaceChildren(stateBlock({ iconName: "alert", title: "Wykres niedostępny", hint: err.message }));
      bridgeBox.replaceChildren();
      rainNote.textContent = "";
      return;
    }
    rainBox.replaceChildren(h("div", { class: "chart-box" }, h("canvas", { id: "chart-rain" })));
    bridgeBox.replaceChildren(h("div", { class: "chart-box chart-box--sm" }, h("canvas", { id: "chart-bridge" })));

    destroyChart(charts.rain);
    destroyChart(charts.bridge);
    charts.rain = rainfallChart(document.getElementById("chart-rain"), cache.series);
    if (cache.bridges.labels.length) {
      charts.bridge = bridgeChart(document.getElementById("chart-bridge"), cache.bridges);
    } else {
      bridgeBox.replaceChildren(stateBlock({ iconName: "cloud", title: "Brak danych o mostkach" }));
    }
    rainNote.textContent = `Wykres obejmuje ostatnie ${CHART_DAYS} dni. Sumy wg mostka — ostatnie ${WINDOW_DAYS} dni. Statystyki liczone z wczytanych pomiarów (limit 500).`;
  }

  const onTheme = () => drawCharts();
  window.addEventListener("pbl:theme", onTheme);

  function destroy() {
    window.removeEventListener("pbl:theme", onTheme);
    destroyChart(charts.rain);
    destroyChart(charts.bridge);
  }

  return { el, load, destroy };
}

function panelHead(iconName, title, hint) {
  return h(
    "div",
    { class: "panel__head" },
    h("h2", {}, icon(iconName), title),
    hint ? h("span", { class: "panel__hint" }, hint) : null
  );
}
