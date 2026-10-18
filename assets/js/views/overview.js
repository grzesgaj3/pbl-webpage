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
  const rangeControls = RANGES.map((r) => {
    const id = `range-${r.id}`;
    return [
      h("input", {
        type: "radio",
        class: "btn-check",
        name: "range",
        id,
        autocomplete: "off",
        checked: r.id === range ? true : null,
        onclick: () => setRange(r.id),
      }),
      h("label", { class: "btn btn-outline-secondary", for: id }, r.label),
    ];
  });

  const rangebar = h(
    "div",
    { class: "d-flex flex-wrap align-items-center gap-2 mb-3" },
    h(
      "span",
      { class: "text-body-secondary small d-inline-flex align-items-center gap-1" },
      icon("clock"),
      "Zakres"
    ),
    h(
      "div",
      { class: "btn-group btn-group-sm", role: "group", "aria-label": "Zakres czasu" },
      rangeControls
    )
  );

  const grid = h("div", { class: "vstack gap-3" }, skeleton(3));
  const note = h("p", { class: "text-body-secondary small mt-3 mb-0" });
  const el = h("div", {}, rangebar, grid, note);

  function setRange(id) {
    if (id === range) return;
    range = id;
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

  function metaLine(sensor) {
    const parts = [];
    if (sensor.bridge_id) parts.push(h("span", {}, `mostek ${sensor.bridge_id}`));
    parts.push(h("span", {}, `${fmtInt(sensor.measurement_count)} pomiarów`));
    parts.push(
      h("span", {}, sensor.last_measurement_at ? `ostatni ${relTime(sensor.last_measurement_at)}` : "brak odczytów")
    );
    return h("span", { class: "text-body-secondary small d-flex flex-wrap gap-3" }, parts);
  }

  function card({ sensor, items, error }) {
    const header = h(
      "div",
      { class: "card-header d-flex flex-wrap align-items-center justify-content-between gap-2" },
      h(
        "span",
        { class: "d-inline-flex align-items-center gap-2" },
        icon("droplet", "text-primary"),
        h("span", { class: "fw-semibold mono" }, sensor.sensor_id)
      ),
      metaLine(sensor)
    );
    const body = h("div", { class: "card-body" });
    const section = h(
      "section",
      { class: "card chart-card", dataset: { sensor: sensor.sensor_id } },
      header,
      body
    );

    if (error) {
      body.append(stateBlock({ iconName: "alert", title: "Nie udało się pobrać danych", hint: error.message }));
      return section;
    }
    const points = buildSeries(items);
    if (!points.length) {
      body.append(stateBlock({ iconName: "cloud", title: "Brak pomiarów w tym zakresie" }));
      return section;
    }
    body.append(h("div", { class: "chart-box" }, h("canvas")));
    section.__points = points;
    return section;
  }

  async function load() {
    const run = ++runId;
    destroyCharts();
    grid.replaceChildren(skeleton(3));
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
        h(
          "div",
          { class: "card" },
          h(
            "div",
            { class: "card-body" },
            stateBlock({
              iconName: "droplet",
              title: "Brak zarejestrowanych sensorów",
              hint: "Sensor pojawia się, gdy mostek zgłosi jego pierwszy pomiar.",
            })
          )
        )
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
    note.textContent = `Zakres: ${rangeLabel()}. Po jednym wykresie na sensor, do ${fmtInt(LIMIT)} punktów każdy.`;
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
