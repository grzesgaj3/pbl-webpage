// Widok Komendy: kolejka czyszczenia. Admin tworzy komendy i przegląda stan;
// potwierdzenie/odrzucenie należy do mostka (klucz bridge), więc nie ma ich tutaj.
import {
  h,
  clear,
  fmtDateTime,
  fmtFullDateTime,
  relTime,
  fmtInt,
  stateBlock,
  skeleton,
  table,
  pager,
  openModal,
  toast,
  statusBadge,
  copyButton,
  download,
  toCSV,
} from "../ui.js";
import { icon } from "../icons.js";
import { listCommands, createCommand } from "../api.js";
import { getFacets, invalidateFacets } from "../facets.js";

const LIMITS = [50, 100, 250, 500];
const DEFAULT_LIMIT = 100;
const STATUSES = [
  { value: "", label: "Wszystkie statusy" },
  { value: "PENDING", label: "Oczekujące" },
  { value: "ACKNOWLEDGED", label: "Potwierdzone" },
  { value: "REJECTED", label: "Odrzucone" },
];

export function createView(ctx = {}) {
  let offset = 0;
  let limit = DEFAULT_LIMIT;
  let lastPage = null;

  const statusSelect = h(
    "select",
    { id: "c-status", onchange: () => { offset = 0; load(); } },
    STATUSES.map((s) => h("option", { value: s.value }, s.label))
  );
  const bridgeInput = h("input", {
    type: "text",
    id: "c-bridge",
    placeholder: "np. mostek1",
    list: "dl-bridges",
    autocomplete: "off",
    spellcheck: "false",
  });
  bridgeInput.addEventListener(
    "input",
    debounceInput(() => {
      offset = 0;
      load();
    })
  );
  const limitSelect = h(
    "select",
    { id: "c-limit", onchange: () => { limit = Number(limitSelect.value); offset = 0; load(); } },
    LIMITS.map((n) => h("option", { value: String(n), selected: n === DEFAULT_LIMIT ? true : null }, `${n} / stronę`))
  );

  const body = h("div", { class: "panel__body panel__body--flush" }, skeleton(8, 7));
  const foot = h("div");
  const bridgeList = h("datalist", { id: "dl-bridges" });
  const sensorList = h("datalist", { id: "dl-sensors" });

  const toolbar = h(
    "div",
    { class: "toolbar" },
    field("Status", statusSelect),
    field("Mostek", bridgeInput),
    field("Wierszy", limitSelect),
    h(
      "div",
      { class: "toolbar__spacer", style: { display: "flex", gap: "8px" } },
      h("button", { class: "btn btn--sm", type: "button", onclick: exportData }, icon("download"), "CSV"),
      h("button", { class: "btn btn--sm btn--primary", type: "button", onclick: openCreate }, icon("plus"), "Nowa komenda")
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
        h("h2", {}, icon("send"), "Kolejka komend czyszczenia"),
        h("span", { class: "panel__hint" }, "potwierdza / odrzuca mostek")
      ),
      toolbar,
      body,
      foot,
      bridgeList,
      sensorList
    )
  );

  function currentQuery() {
    return {
      limit,
      offset,
      status: statusSelect.value || undefined,
      bridge_id: bridgeInput.value.trim() || undefined,
    };
  }

  async function load() {
    body.replaceChildren(skeleton(8, 7));
    foot.replaceChildren();
    try {
      const page = await listCommands(currentQuery());
      lastPage = page;
      renderPage();
    } catch (err) {
      body.replaceChildren(stateBlock({ iconName: "alert", title: "Nie udało się wczytać komend", hint: err.message }));
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
          { key: "payload", label: "Payload" },
          { key: "status", label: "Status" },
          { key: "created", label: "Utworzono" },
          { key: "responded", label: "Odpowiedziano" },
        ],
        items.map((c) => ({
          id: "#" + c.id,
          bridge: h("span", { class: "mono muted" }, c.bridge_id),
          sensor: h("span", { class: "cell-strong mono" }, c.sensor_id || "—"),
          payload: h("span", { style: { display: "inline-flex", alignItems: "center", gap: "4px" } },
            h("span", { class: "chip mono" }, c.payload),
            copyButton(() => c.payload, "Kopiuj payload")
          ),
          status: statusBadge(c.status),
          created: h("span", { class: "nowrap", title: fmtFullDateTime(c.created_at) }, relTime(c.created_at)),
          responded: h("span", { class: "nowrap mono muted", style: { fontSize: "13px" } },
            c.responded_at ? fmtDateTime(c.responded_at) : "—"),
          __click: () => showDetail(c),
        })),
        { emptyText: "Brak komend dla wybranych filtrów." }
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

  function showDetail(c) {
    openModal({
      title: `Komenda #${c.id}`,
      body: h(
        "dl",
        { class: "kv" },
        dt("Mostek", c.bridge_id),
        dt("Sensor", c.sensor_id || "—"),
        dt("Typ", c.command_type),
        dt("Payload", h("span", { class: "chip mono" }, c.payload)),
        dt("Status", statusBadge(c.status)),
        dt("Utworzono", fmtFullDateTime(c.created_at)),
        dt("Odpowiedziano", c.responded_at ? fmtFullDateTime(c.responded_at) : "—"),
        dt("Notatka", c.response_note || "—")
      ),
      footer: [
        copyButton(() => c.payload, "Kopiuj payload"),
        h("button", { class: "btn", type: "button", onclick: (e) => e.target.closest(".modal-overlay").remove() }, "Zamknij"),
      ],
    });
  }

  function openCreate() {
    const bridge = h("input", { type: "text", id: "cc-bridge", list: "dl-bridges", placeholder: "np. mostek1", autocomplete: "off", spellcheck: "false" });
    const sensor = h("input", { type: "text", id: "cc-sensor", list: "dl-sensors", placeholder: "np. sensor1", autocomplete: "off", spellcheck: "false" });
    const errorBox = h("div", { class: "form-error", hidden: true }, icon("alert"), h("span"));
    const submit = h("button", { class: "btn btn--primary", type: "button" }, icon("plus"), "Utwórz komendę");

    async function doCreate() {
      errorBox.hidden = true;
      const bridgeId = bridge.value.trim();
      const sensorId = sensor.value.trim();
      if (!bridgeId || !sensorId) {
        errorBox.querySelector("span").textContent = "Podaj identyfikator mostka i sensora.";
        errorBox.hidden = false;
        return;
      }
      submit.disabled = true;
      try {
        const created = await createCommand({ bridge_id: bridgeId, sensor_id: sensorId, command_type: "clean" });
        toast(`Komenda #${created.id} zakolejkowana dla ${created.bridge_id}.`, { tone: "ok", title: "Utworzono" });
        invalidateFacets();
        modal.close();
        offset = 0;
        load();
      } catch (err) {
        errorBox.querySelector("span").textContent = err.message;
        errorBox.hidden = false;
      } finally {
        submit.disabled = false;
      }
    }
    submit.addEventListener("click", doCreate);
    sensor.addEventListener("keydown", (e) => { if (e.key === "Enter") doCreate(); });

    const modal = openModal({
      title: "Nowa komenda czyszczenia",
      wide: true,
      body: [
        h(
          "p",
          { class: "muted", style: { marginBottom: "16px", lineHeight: "1.55" } },
          "API wygeneruje payload LoRa (np. sensor1;clean;), który mostek pośle do sieci. Potwierdzenie wykonania po stronie mostka."
        ),
        h("div", { class: "field" }, h("label", { for: "cc-bridge" }, "Mostek (bridge_id)"), bridge),
        h("div", { class: "field", style: { marginTop: "14px" } }, h("label", { for: "cc-sensor" }, "Sensor (sensor_id)"), sensor),
        errorBox,
      ],
      footer: [
        h("button", { class: "btn", type: "button", onclick: () => modal.close() }, "Anuluj"),
        submit,
      ],
    });
  }

  function exportData() {
    const items = (lastPage && lastPage.items) || [];
    if (!items.length) {
      toast("Brak danych do wyeksportowania.", { tone: "warn" });
      return;
    }
    const stamp = new Date().toISOString().slice(0, 10);
    const cols = [
      { key: "id", label: "id" },
      { key: "bridge_id", label: "bridge_id" },
      { key: "sensor_id", label: "sensor_id" },
      { key: "command_type", label: "command_type" },
      { key: "payload", label: "payload" },
      { key: "status", label: "status" },
      { key: "created_at", label: "created_at" },
      { key: "responded_at", label: "responded_at" },
      { key: "response_note", label: "response_note" },
    ];
    download(`komendy-${stamp}.csv`, toCSV(items, cols));
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
      /* opcjonalne */
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

function dt(term, value) {
  return [h("dt", {}, term), h("dd", {}, value ?? "—")];
}

function debounceInput(fn) {
  let t;
  return () => {
    clearTimeout(t);
    t = setTimeout(fn, 350);
  };
}
