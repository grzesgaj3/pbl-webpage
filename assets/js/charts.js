// Wykresy oparte na Chart.js, ładowanym leniwie z CDN (dopiero gdy widok go
// potrzebuje). Razem z Chart.js dociągamy adapter osi czasu.
const CDN_CHART = "https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js";
const CDN_ADAPTER =
  "https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns@3/dist/chartjs-adapter-date-fns.bundle.min.js";

let loading = null;

function script(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(src));
    document.head.append(s);
  });
}

/** Wczytuje Chart.js (i adapter dat) z CDN. Kolejne wywołania korzystają z cache. */
export function loadChart() {
  if (window.Chart) return Promise.resolve(window.Chart);
  if (loading) return loading;
  loading = (async () => {
    await script(CDN_CHART);
    if (!window.Chart) throw new Error("brak obiektu Chart");
    await script(CDN_ADAPTER);
    return window.Chart;
  })().catch(() => {
    loading = null;
    throw new Error("Nie udało się wczytać Chart.js z CDN. Sprawdź dostęp do internetu.");
  });
  return loading;
}

function cssVar(name, fallback = "#000") {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export function themeColors() {
  return {
    accent: cssVar("--accent", "#0c6472"),
    text: cssVar("--text", "#0b171c"),
    soft: cssVar("--text-soft", "#516369"),
    faint: cssVar("--text-faint", "#7b8c91"),
    line: cssVar("--line", "#d5e0de"),
    surface: cssVar("--surface", "#fff"),
  };
}

const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const MONO = (size = 11) => ({ family: "IBM Plex Mono", size });

function hexA(hex, alpha) {
  let h = String(hex).replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  if (!Number.isFinite(n)) return hex;
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function baseOptions(c) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: reduced() ? false : { duration: 380, easing: "easeOutQuart" },
    interaction: { mode: "nearest", intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: c.text,
        titleColor: c.surface,
        bodyColor: c.surface,
        padding: 10,
        cornerRadius: 8,
        displayColors: false,
        titleFont: { family: "IBM Plex Sans", weight: "600" },
        bodyFont: MONO(),
      },
    },
  };
}

const fmtMm = (v) => `${Number(v).toFixed(2).replace(".", ",")} mm`;
const dtTip = new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium", timeStyle: "short" });

/**
 * Wykres opadów jednego sensora w czasie.
 * @param {HTMLCanvasElement} canvas
 * @param {Array<{x:number,y:number}>} points
 */
export function sensorChart(canvas, points) {
  const Chart = window.Chart;
  const c = themeColors();
  const many = points.length > 80;
  const opts = baseOptions(c);
  return new Chart(canvas, {
    type: "line",
    data: {
      datasets: [
        {
          data: points,
          borderColor: c.accent,
          backgroundColor: hexA(c.accent, 0.14),
          fill: true,
          borderWidth: 2,
          tension: 0.28,
          spanGaps: true,
          pointRadius: many ? 0 : 2.5,
          pointHoverRadius: 4,
          pointBackgroundColor: c.accent,
          pointBorderColor: c.surface,
          pointBorderWidth: 1,
        },
      ],
    },
    options: {
      ...opts,
      plugins: {
        ...opts.plugins,
        tooltip: {
          ...opts.plugins.tooltip,
          callbacks: {
            title: (items) => (items.length ? dtTip.format(new Date(items[0].parsed.x)) : ""),
            label: (item) => fmtMm(item.parsed.y),
          },
        },
      },
      scales: {
        x: {
          type: "time",
          time: {
            displayFormats: {
              minute: "HH:mm",
              hour: "HH:mm",
              day: "dd.MM",
              week: "dd.MM",
              month: "MM.yy",
              year: "yyyy",
            },
          },
          grid: { display: false },
          border: { color: c.line },
          ticks: { color: c.faint, font: MONO(), maxRotation: 0, autoSkipPadding: 16 },
        },
        y: {
          beginAtZero: true,
          grid: { color: c.line, drawTicks: false },
          border: { display: false },
          ticks: { color: c.faint, font: MONO(), padding: 8, callback: (v) => `${v} mm` },
        },
      },
    },
  });
}

export function destroyChart(chart) {
  if (chart && typeof chart.destroy === "function") chart.destroy();
}
