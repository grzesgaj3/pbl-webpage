// Wspólne helpery DOM i komponenty UI.
import { icon } from "./icons.js";

/** Tworzy element z atrybutami i dziećmi. */
export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs && typeof attrs === "object" && !(attrs instanceof Node)) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "dataset") Object.assign(el.dataset, v);
      else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
      else if (k.startsWith("on") && typeof v === "function")
        el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === "html") el.innerHTML = v;
      else if (v === true) el.setAttribute(k, "");
      else el.setAttribute(k, v);
    }
  } else if (attrs !== undefined) {
    children.unshift(attrs);
  }
  append(el, children);
  return el;
}

export function append(parent, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    parent.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return parent;
}

export const clear = (el) => {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
};

export function debounce(fn, ms = 300) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

// --- Formaty -------------------------------------------------------------
const dtMedium = new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium", timeStyle: "short" });
const dtFull = new Intl.DateTimeFormat("pl-PL", { dateStyle: "full", timeStyle: "medium" });
const dOnly = new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium" });
const rtf = new Intl.RelativeTimeFormat("pl", { numeric: "auto" });

export function parseISO(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
export function fmtDateTime(value) {
  const d = parseISO(value);
  return d ? dtMedium.format(d) : "—";
}
export function fmtFullDateTime(value) {
  const d = parseISO(value);
  return d ? dtFull.format(d) : "—";
}
export function fmtDate(value) {
  const d = parseISO(value);
  return d ? dOnly.format(d) : "—";
}
export function relTime(value) {
  const d = parseISO(value);
  if (!d) return "—";
  const diff = (Date.now() - d.getTime()) / 1000;
  const abs = Math.abs(diff);
  const units = [
    [60, "second"],
    [3600, "minute"],
    [86400, "hour"],
    [604800, "day"],
    [2592000, "week"],
    [31536000, "month"],
  ];
  if (abs < 45) return "teraz";
  let prev = 1;
  for (const [limit, unit] of units) {
    if (abs < limit) return rtf.format(-Math.round(diff / prev), unit);
    prev = limit;
  }
  return rtf.format(-Math.round(diff / 31536000), "year");
}
export function fmtNum(value, digits = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("pl-PL", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
export function fmtInt(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString("pl-PL") : "—";
}
/** Do <input type="datetime-local"> potrzeba lokalnego czasu bez strefy. */
export function toLocalInput(date) {
  const d = date instanceof Date ? date : new Date(date);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}
export const epochToDate = (epochSec) => new Date(Number(epochSec) * 1000);

// --- Odznaki -------------------------------------------------------------
// Kolory i etykiety statusów komend z API.
const STATUS_META = {
  PENDING: { label: "Oczekuje", tone: "warning" },
  ACKNOWLEDGED: { label: "Wykonano", tone: "success" },
  REJECTED: { label: "Odrzucono", tone: "danger" },
};
export function statusBadge(status) {
  const meta = STATUS_META[status] || { label: status || "—", tone: "secondary" };
  return h("span", { class: `badge text-bg-${meta.tone}` }, meta.label);
}
export function badge(text, tone = "secondary") {
  return h("span", { class: `badge text-bg-${tone}` }, text);
}

// --- Toasty --------------------------------------------------------------
// Bootstrap nie daje alertów z automatycznym znikaniem bez swojego JS-a,
// więc używamy klas alertów i sami chowamy element po czasie.
const TOAST_TONE = { ok: "success", danger: "danger", warn: "warning", info: "info" };
const TOAST_ICON = { ok: "check", danger: "alert", warn: "alert", info: "info" };
export function toast(message, { title, tone = "info", timeout = 5000 } = {}) {
  const host = document.getElementById("toasts");
  if (!host) return () => {};
  const el = h(
    "div",
    {
      class: `alert alert-${TOAST_TONE[tone] || "info"} d-flex align-items-start gap-2 shadow-sm mb-0`,
      dataset: { tone },
      role: "status",
    },
    icon(TOAST_ICON[tone] || "info"),
    h("div", { class: "flex-grow-1" }, title ? h("div", { class: "fw-semibold" }, title) : null, message),
    h("button", { class: "btn-close", type: "button", "aria-label": "Zamknij", onclick: () => remove() })
  );
  host.append(el);
  let timer = timeout ? setTimeout(remove, timeout) : null;
  function remove() {
    if (timer) clearTimeout(timer);
    el.style.opacity = "0";
    el.style.transform = "translateX(14px)";
    el.style.transition = "opacity 140ms, transform 140ms";
    setTimeout(() => el.remove(), 150);
  }
  el.addEventListener("mouseenter", () => timer && clearTimeout(timer));
  return remove;
}

// --- Modal ---------------------------------------------------------------
// Bootstrapowy wygląd, ale pokazywanie/ukrywanie robimy sami (bez JS bundle'a).
export function openModal({ title, body, footer, wide = false, onClose } = {}) {
  const root = document.getElementById("modal-root");
  const previouslyFocused = document.activeElement;
  const headingId = "modal-title-" + Math.random().toString(36).slice(2, 7);

  const modal = h(
    "div",
    {
      class: "modal fade show d-block",
      tabindex: "-1",
      role: "dialog",
      "aria-modal": "true",
      "aria-labelledby": headingId,
    },
    h(
      "div",
      { class: `modal-dialog modal-dialog-centered${wide ? " modal-lg" : ""}` },
      h(
        "div",
        { class: "modal-content" },
        h(
          "div",
          { class: "modal-header" },
          h("h5", { class: "modal-title", id: headingId }, title || ""),
          h("button", { class: "btn-close", type: "button", "aria-label": "Zamknij", onclick: () => close() })
        ),
        h("div", { class: "modal-body" }, body || null),
        footer ? h("div", { class: "modal-footer" }, footer) : null
      )
    )
  );
  const backdrop = h("div", { class: "modal-backdrop fade show", onclick: () => close() });
  root.append(backdrop, modal);
  document.body.classList.add("modal-open");

  function onKey(e) {
    if (e.key === "Escape") close();
  }
  document.addEventListener("keydown", onKey);

  const focusable = modal.querySelector(
    "input, select, textarea, button, [href], [tabindex]:not([tabindex='-1'])"
  );
  if (focusable) focusable.focus();

  function close() {
    document.removeEventListener("keydown", onKey);
    backdrop.remove();
    modal.remove();
    document.body.classList.remove("modal-open");
    if (previouslyFocused && previouslyFocused.focus) previouslyFocused.focus();
    if (onClose) onClose();
  }
  return { el: modal, close };
}

export function confirmDialog({
  title = "Potwierdź",
  message,
  confirmLabel = "Potwierdź",
  cancelLabel = "Anuluj",
  danger = false,
} = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (v) => {
      if (settled) return;
      settled = true;
      resolve(v);
    };
    const { close } = openModal({
      title,
      body: h("p", { class: "text-body-secondary mb-0" }, message),
      footer: [
        h(
          "button",
          { class: "btn btn-outline-secondary", type: "button", onclick: () => { done(false); close(); } },
          cancelLabel
        ),
        h(
          "button",
          {
            class: `btn ${danger ? "btn-danger" : "btn-primary"}`,
            type: "button",
            onclick: () => { done(true); close(); },
          },
          confirmLabel
        ),
      ],
      onClose: () => done(false),
    });
  });
}

// --- Stan pusty / skeleton ----------------------------------------------
export function stateBlock({ iconName = "cloud", title, hint, action } = {}) {
  return h(
    "div",
    { class: "text-center text-body-secondary py-5 px-3" },
    h("div", { class: "mb-2" }, icon(iconName, "fs-1")),
    title ? h("p", { class: "fw-semibold text-body mb-1" }, title) : null,
    hint ? h("p", { class: "small mb-0" }, hint) : null,
    action ? h("div", { class: "mt-3" }, action) : null
  );
}

export function skeleton(rows = 5) {
  const grid = h("div", { class: "vstack gap-3 py-2", "aria-hidden": "true" });
  for (let i = 0; i < rows; i++) {
    grid.append(
      h(
        "div",
        { class: "placeholder-glow" },
        h("span", { class: "placeholder col-12 rounded", style: { display: "block", height: "1rem" } })
      )
    );
  }
  return grid;
}

// --- Tabela --------------------------------------------------------------
/**
 * Buduje tabelę.
 * @param {Array<{label:string, numeric?:boolean, key:string}>} columns
 * @param {Array<Record<string, any>>} rows - każdy wiersz to mapa kolumna -> Node|string
 */
export function table(columns, rows, { emptyText = "Brak danych." } = {}) {
  const thead = h(
    "thead",
    {},
    h(
      "tr",
      {},
      columns.map((c) => h("th", { class: c.numeric ? "text-end" : null, scope: "col" }, c.label))
    )
  );
  const tbody = h("tbody");
  if (!rows.length) {
    tbody.append(
      h(
        "tr",
        {},
        h("td", { class: "text-body-secondary", colspan: columns.length }, emptyText)
      )
    );
  } else {
    for (const row of rows) {
      const tr = h("tr");
      if (row.__click) {
        tr.classList.add("cursor-pointer");
        tr.addEventListener("click", row.__click);
      }
      for (const c of columns) {
        const cell = h("td", { class: c.numeric ? "text-end" : null });
        append(cell, [row[c.key]]);
        tr.append(cell);
      }
      tbody.append(tr);
    }
  }
  return h(
    "div",
    { class: "table-responsive" },
    h("table", { class: "table table-sm table-hover align-middle mb-0" }, thead, tbody)
  );
}

// --- Paginacja -----------------------------------------------------------
export function pager({ offset, limit, count, hasMore }, handlers = {}) {
  const from = count ? offset + 1 : offset;
  const to = offset + count;
  return h(
    "div",
    { class: "pager" },
    h("span", { class: "mono" }, count ? `Wiersze ${fmtInt(from)}–${fmtInt(to)}` : "Brak wierszy na tej stronie"),
    h(
      "div",
      { class: "pager__nav" },
      h(
        "button",
        {
          class: "btn btn--sm",
          type: "button",
          disabled: offset <= 0 ? true : null,
          onclick: () => handlers.onPrev && handlers.onPrev(),
        },
        icon("chevronLeft"),
        "Poprzednie"
      ),
      h(
        "button",
        {
          class: "btn btn--sm",
          type: "button",
          disabled: hasMore ? null : true,
          onclick: () => handlers.onNext && handlers.onNext(),
        },
        "Następne",
        icon("chevronRight")
      )
    )
  );
}

// --- Kopiowanie ----------------------------------------------------------
export function copyButton(getValue, label = "Kopiuj") {
  return h(
    "button",
    {
      class: "copy",
      type: "button",
      title: label,
      "aria-label": label,
      onclick: async (e) => {
        e.stopPropagation();
        const value = typeof getValue === "function" ? getValue() : getValue;
        try {
          await navigator.clipboard.writeText(String(value));
          toast("Skopiowano do schowka.", { tone: "ok", timeout: 1800 });
        } catch {
          toast("Nie udało się skopiować.", { tone: "warn" });
        }
      },
    },
    icon("copy")
  );
}

export function download(filename, content, type = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = h("a", { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function toCSV(rows, columns) {
  const esc = (v) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = columns.map((c) => esc(c.label)).join(",");
  const body = rows.map((r) => columns.map((c) => esc(r[c.key])).join(",")).join("\n");
  return head + "\n" + body;
}
