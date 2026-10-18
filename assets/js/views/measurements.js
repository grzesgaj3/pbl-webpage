// Widok Pomiary: filtry, tabela z paginacją, eksport, szczegóły wiersza.
import {
  h,
  clear,
  fmtDateTime,
  fmtFullDateTime,
  fmtNum,
  fmtInt,
  stateBlock,
  skeleton,
  table,
  pager,
  openModal,
  toast,
  download,
  toCSV,
  debounce,
} from "../ui.js";
import { icon } from "../icons.js";
import { listMeasurements } from "../api.js";
import { getFacets } from "../facets.js";

const LIMITS = [50, 100, 250, 500];
const DEFAULT_LIMIT = 100;

export function createView(ctx = {}) {
  let offset = 0;
  let limit = DEFAULT_LIMIT;
  let lastPage = null;

  const bridgeInput = datalistInput("m-bridge", "np. mostek1", "dl-bridges");
  const sensorInput = datalistInput("m-sensor", "np. sensor1", "dl-sensors");
  if (ctx.params && ctx.params.bridge_id) bridgeInput.value = ctx.params.bridge_id;
  if (ctx.params && ctx.params.sensor_id) sensorInput.value = ctx.params.sensor_id;
  const fromInput = h("input", { type: "datetime-local", id: "m-from" });
  const toInput = h("input", { type: "datetime-local", id: "m-to" });
  const limitSelect = h(
    "select",
    { id: "m-limit", onchange: () => { limit = Number(limitSelect.value); offset = 0; load(); } },
    LIMITS.map((n) => h("option", { value: String(n), selected: n === DEFAULT_LIMIT ? true : null }, `${n} / stronę`))
  );

  const body = h("div", { class: "panel__body panel__body--flush" }, skeleton(8, 6));
  const foot = h("div");

  const bridgeList = h("datalist", { id: "dl-bridges" });
  const sensorList = h("datalist", { id: "dl-sensors" });

  const toolbar = h(
    "div",
    { class: "toolbar" },
    field("Mostek", bridgeInput),
    field("Sensor", sensorInput),
    field("Od (wysłano)", fromInput),
    field("Do (wysłano)", toInput),
    field("Wierszy", limitSelect),
    h(
      "div",
      { class: "toolbar__spacer", style: { display: "flex", gap: "8px" } },
      h(
        "button",
        { class: "btn btn--sm", type: "button", onclick: () => { resetFilters(); } },
        icon("close"),
        "Wyczyść"
      ),
      h(
        "button",
        { class: "btn btn--sm", type: "button", onclick: () => exportData("csv") },
        icon("download"),
        "CSV"
      ),
      h(
        "button",
        { class: "btn btn--sm", type: "button", onclick: () => exportData("json") },
        icon("download"),
        "JSON"
      )
    )
  );

  const el = h(
    "div",
    { class: "view-enter" },
    h(
      "section",
      { class: "panel" },
      h(
        "div",
        { class: "panel__head" },
        h("h2", {}, icon("droplet"), "Zarejestrowane pomiary"),
        h("span", { class: "panel__hint" }, "sortowane od najnowszych")
      ),
      toolbar,
      body,
      foot,
      bridgeList,
      sensorList
    )
  );

  const onFilterChange = debounce(() => {
    offset = 0;
    load();
  }, 350);
  bridgeInput.addEventListener("input", onFilterChange);
  sensorInput.addEventListener("input", onFilterChange);
  fromInput.addEventListener("change", () => { offset = 0; load(); });
  toInput.addEventListener("change", () => { offset = 0; load(); });

  function resetFilters() {
    bridgeInput.value = "";
    sensorInput.value = "";
    fromInput.value = "";
    toInput.value = "";
    offset = 0;
    load();
  }

  function currentQuery() {
    const q = {
      limit,
      offset,
      bridge_id: bridgeInput.value.trim() || undefined,
      sensor_id: sensorInput.value.trim() || undefined,
    };
    const from = fromInput.value ? Date.parse(fromInput.value) : NaN;
    const to = toInput.value ? Date.parse(toInput.value) : NaN;
    if (!Number.isNaN(from)) q.sent_from = Math.floor(from / 1000);
    if (!Number.isNaN(to)) q.sent_to = Math.floor(to / 1000);
    return q;
  }

  async function load() {
    body.replaceChildren(skeleton(8, 6));
    foot.replaceChildren();
    try {
      const page = await listMeasurements(currentQuery());
      lastPage = page;
      renderPage();
    } catch (err) {
      body.replaceChildren(
        stateBlock({ iconName: "alert", title: "Nie udało się wczytać pomiarów", hint: err.message })
      );
    }
  }

  function renderPage() {
    const items = lastPage.items || [];
    body.replaceChildren(
      table(
        [
          { key: "id", label: "ID", numeric: true },
          { key: "bridge", label: "Mostek" },
          { key: "sensor", label: "Sensor" },
          { key: "value", label: "Opad", numeric: true },
          { key: "sent", label: "Wysłano (lokalnie)" },
          { key: "recorded", label: "Zapisano" },
        ],
        items.map((m) => ({
          id: "#" + m.id,
          bridge: h("span", { class: "mono muted" }, m.bridge_id),
          sensor: h("span", { class: "cell-strong mono" }, m.sensor_id),
          value: fmtNum(m.value_mm) + " mm",
          sent: h("span", { class: "nowrap mono", style: { fontSize: "13px" } }, fmtDateTime(m.sent_at)),
          recorded: h("span", { class: "nowrap mono muted", style: { fontSize: "13px" } }, fmtDateTime(m.recorded_at)),
          __click: () => showDetail(m),
        })),
        { emptyText: "Brak pomiarów dla wybranych filtrów." }
      )
    );
    foot.replaceChildren(
      pager(
        { offset: lastPage.offset, limit: lastPage.limit, count: lastPage.count, hasMore: lastPage.has_more },
        {
          onPrev: () => { offset = Math.max(0, offset - limit); load(); },
          onNext: () => { offset += limit; load(); },
        }
      )
    );
  }

  function showDetail(m) {
    openModal({
      title: `Pomiar #${m.id}`,
      body: h(
        "dl",
        { class: "kv" },
        dt("Mostek", m.bridge_id),
        dt("Sensor", m.sensor_id),
        dt("Opad", fmtNum(m.value_mm) + " mm"),
        dt("Wysłano (UTC)", m.sent_at),
        dt("Wysłano (lokalnie)", fmtFullDateTime(m.sent_at)),
        dt("Zapisano (UTC)", m.recorded_at),
        dt("Zapisano (lokalnie)", fmtFullDateTime(m.recorded_at))
      ),
      footer: h("button", { class: "btn", type: "button", onclick: (e) => e.target.closest(".modal-overlay").remove() }, "Zamknij"),
    });
  }

  function exportData(kind) {
    const items = (lastPage && lastPage.items) || [];
    if (!items.length) {
      toast("Brak danych do wyeksportowania.", { tone: "warn" });
      return;
    }
    const stamp = new Date().toISOString().slice(0, 10);
    if (kind === "csv") {
      const cols = [
        { key: "id", label: "id" },
        { key: "bridge_id", label: "bridge_id" },
        { key: "sensor_id", label: "sensor_id" },
        { key: "value_mm", label: "value_mm" },
        { key: "sent_at", label: "sent_at" },
        { key: "recorded_at", label: "recorded_at" },
      ];
      download(`pomiary-${stamp}.csv`, toCSV(items, cols));
    } else {
      download(`pomiary-${stamp}.json`, JSON.stringify(items, null, 2), "application/json");
    }
    toast(`Wyeksportowano ${fmtInt(items.length)} wierszy.`, { tone: "ok" });
  }

  async function loadFacets() {
    try {
      const f = await getFacets();
      clear(bridgeList);
      clear(sensorList);
      for (const b of f.bridges) bridgeList.append(h("option", { value: b }));
      for (const s of f.sensors) sensorList.append(h("option", { value: s }));
    } catch {
      /* fasetowanie jest opcjonalne */
    }
  }

  return {
    el,
    load: async () => {
      loadFacets();
      await load();
    },
  };
}

function field(label, control) {
  const id = control.getAttribute("id");
  return h("div", { class: "field" }, h("label", { for: id }, label), control);
}

function datalistInput(id, placeholder, listId) {
  return h("input", { type: "text", id, placeholder, list: listId, autocomplete: "off", spellcheck: "false" });
}

function dt(term, value) {
  return [h("dt", {}, term), h("dd", {}, value ?? "—")];
}
