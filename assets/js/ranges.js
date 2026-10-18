// Zakresy czasu dla wykresów oraz budowa serii punktów dla Chart.js.
// Moduł czysty (bez DOM), dzięki czemu można go testować w Node.

const H = 3600 * 1000;
const D = 24 * H;

/** Zakresy dostępne na pasku wyboru. `ms === null` oznacza "całość". */
export const RANGES = [
  { id: "12h", label: "12 h", ms: 12 * H },
  { id: "24h", label: "24 h", ms: 24 * H },
  { id: "week", label: "Tydzień", ms: 7 * D },
  { id: "month", label: "Miesiąc", ms: 30 * D },
  { id: "all", label: "Całość", ms: null },
];

export const DEFAULT_RANGE = "24h";

/**
 * Granice zakresu w sekundach epoch (tak, jak chce ich API).
 * @param {string} id identyfikator zakresu
 * @param {number} [now] "teraz" w ms (wstrzykiwane w testach)
 * @returns {{from: number|null, to: number}}
 */
export function rangeWindow(id, now = Date.now()) {
  const range = RANGES.find((r) => r.id === id) || RANGES.find((r) => r.id === DEFAULT_RANGE);
  const to = Math.floor(now / 1000);
  if (range.ms === null) return { from: null, to };
  return { from: Math.floor((now - range.ms) / 1000), to };
}

/**
 * Zamienia pomiary z API na punkty wykresu `{x: ms, y: mm}`, rosnąco po czasie.
 * Rekordy bez poprawnej daty lub wartości są pomijane.
 * @param {Array<{sent_at: string, value_mm: number|string}>} [items]
 * @returns {Array<{x: number, y: number}>}
 */
export function buildSeries(items = []) {
  const points = [];
  for (const m of items || []) {
    const raw = m && m.value_mm;
    if (raw === null || raw === undefined || raw === "") continue;
    const y = Number(raw);
    const x = new Date(m.sent_at).getTime();
    if (!Number.isFinite(y) || !Number.isFinite(x)) continue;
    points.push({ x, y });
  }
  return points.sort((a, b) => a.x - b.x);
}
