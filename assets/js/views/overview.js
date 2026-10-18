// Widok wykresów: po jednym wykresie na każdy zarejestrowany sensor.
import { h, fmtInt, relTime, stateBlock, skeleton } from "../ui.js";
import { icon } from "../icons.js";
import { listSensors, listMeasurements } from "../api.js";
import { loadChart, sensorChart, destroyChart } from "../charts.js";
import { RANGES, DEFAULT_RANGE, rangeWindow, buildSeries } from "../ranges.js";

const LIMIT = 1000; // prototyp: bierzemy pierwszą porcję API

export function createView() {
  let range = DEFAULT_RANGE;
  let runId = 0;
  let charts = [];

  const rangeLabel = () => (RANGES.find((r) => r.id === range) || {}).label || "";
  const buttons = RANGES.map((r) =>
    h(
      "button",
      {
        type: "button",
        class: "rangebar__btn",
        "aria-pressed": r.id === range ? "true" : "false",
        dataset: { range: r.id },
        onclick: () => setRange(r.id),
      },
      r.label
    )
  );

  const rangebar = h(
    "div",
    { class: "rangebar", role: "group", "aria-label": "Zakres czasu" },
    h("span", { class: "rangebar__label" }, icon("clock"), "Zakres"),
    h("div", { class: "rangebar__group" }, buttons)
  );

  const grid = h("div", { class: "charts-grid" }, skeleton(4, 4));
  const note = h("p", { class: "charts-note" });
  const el = h("div", { class: "view-enter" }, rangebar, grid, note);

  function setRange(id) {
    if (id === range) return;
    range = id;
    for (const b of buttons) b.setAttribute("aria-pressed", b.dataset.range === id ? "true" : "false");
    load();
  }

  function destroyCharts() {
    while (charts.length) destroyChart(charts.pop());
    charts = [];
  }

  async function draw() {
    const cards = [...grid.querySelectorAll(".chart-card")];
    const drawn = cards.filter((c) => c.__points && c.__points.length);
    if (!drawn.length) return;
    try {
      await loadChart();
    } catch (err) {
      note.textContent = err.message;
      return;
    }
    for (const card of drawn) {
      const canvas = card.querySelector("canvas");
      if (canvas) charts.push(sensorChart(canvas, card.__points));
    }
  }

  function card({ sensor, items, error }) {
    const head = h(
      "div",
      { class: "panel__head" },
      h("h2", {}, icon("droplet"), h("span", { class: "mono" }, sensor.sensor_id)),
      sensor.bridge_id ? h("span", { class: "panel__hint" }, `mostek ${sensor.bridge_id}`) : null
    );
    const body = h(
      "div",
      { class: "panel__body" },
      h(
        "div",
        { class: "chart-meta" },
        h("span", {}, icon("gauge"), `${fmtInt(sensor.measurement_count)} pomiarów`),
        h(
          "span",
          {},
          icon("clock"),
          sensor.last_measurement_at ? `ostatni ${relTime(sensor.last_measurement_at)}` : "brak odczytów"
        )
      )
    );
    const section = h("section", { class: "panel chart-card", dataset: { sensor: sensor.sensor_id } }, head, body);

    if (error) {
      body.append(stateBlock({ iconName: "alert", title: "Nie udało się pobrać danych", hint: error.message }));
      return section;
    }
    const points = buildSeries(items);
    if (!points.length) {
      body.append(stateBlock({ iconName: "cloud", title: "Brak pomiarów w tym zakresie" }));
      return section;
    }
    const box = h("div", { class: "chart-box" }, h("canvas"));
    body.append(box);
    section.__points = points;
    return section;
  }

  async function load() {
    const run = ++runId;
    destroyCharts();
    grid.replaceChildren(skeleton(4, 4));
    note.textContent = "";

    let sensors;
    try {
      const page = await listSensors({ limit: LIMIT });
      sensors = page.items || [];
    } catch (err) {
      if (run !== runId) return;
      grid.replaceChildren(
        stateBlock({ iconName: "alert", title: "Nie udało się pobrać sensorów", hint: err.message })
      );
      return;
    }
    if (run !== runId) return;

    if (!sensors.length) {
      grid.replaceChildren(
        stateBlock({
          iconName: "droplet",
          title: "Brak zarejestrowanych sensorów",
          hint: "Sensor pojawia się, gdy mostek zgłosi jego pierwszy pomiar.",
        })
      );
      return;
    }

    const { from, to } = rangeWindow(range);
    const results = await Promise.all(
      sensors.map((sensor) =>
        listMeasurements({ sensor_id: sensor.sensor_id, sent_from: from || undefined, sent_to: to, limit: LIMIT })
          .then((page) => ({ sensor, items: page.items || [] }))
          .catch((error) => ({ sensor, error }))
      )
    );
    if (run !== runId) return;

    grid.replaceChildren(...results.map(card));
    note.textContent = `Zakres: ${rangeLabel()} · po jednym wykresie na sensor (do ${fmtInt(LIMIT)} punktów każdy).`;
    await draw();
    if (run !== runId) destroyCharts();
  }

  const onTheme = () => {
    destroyCharts();
    draw();
  };
  window.addEventListener("pbl:theme", onTheme);

  function destroy() {
    window.removeEventListener("pbl:theme", onTheme);
    destroyCharts();
  }

  return { el, load, destroy };
}
