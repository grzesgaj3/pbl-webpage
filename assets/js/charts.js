// Wykresy oparte na Chart.js ładowanym leniwie z CDN (tylko gdy widok go potrzebuje).
const CDN = "https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js";
let loading = null;

export function loadChart() {
  if (window.Chart) return Promise.resolve(window.Chart);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = CDN;
    s.async = true;
    s.onload = () => (window.Chart ? resolve(window.Chart) : reject(new Error("Brak obiektu Chart.")));
    s.onerror = () => {
      loading = null;
      reject(new Error("Nie udało się wczytać Chart.js z CDN. Sprawdź dostęp do internetu."));
    };
    document.head.append(s);
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
    accentSoft: cssVar("--accent-soft", "#dcecef"),
    text: cssVar("--text", "#0b171c"),
    soft: cssVar("--text-soft", "#516369"),
    faint: cssVar("--text-faint", "#7b8c91"),
    line: cssVar("--line", "#d5e0de"),
    surface: cssVar("--surface", "#fff"),
    ok: cssVar("--ok", "#1c7a53"),
    warn: cssVar("--warn", "#9c620c"),
    danger: cssVar("--danger", "#a83a29"),
    info: cssVar("--info", "#2a6ea6"),
  };
}

const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function baseOptions(c) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: reduced() ? false : { duration: 420, easing: "easeOutQuart" },
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
        bodyFont: { family: "IBM Plex Mono" },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { color: c.line },
        ticks: { color: c.faint, font: { family: "IBM Plex Mono", size: 11 }, maxRotation: 0, autoSkipPadding: 14 },
      },
      y: {
        beginAtZero: true,
        grid: { color: c.line, drawTicks: false },
        border: { display: false },
        ticks: { color: c.faint, font: { family: "IBM Plex Mono", size: 11 }, padding: 8 },
      },
    },
  };
}

function areaGradient(ctx, area, color) {
  if (!area) return color;
  const g = ctx.createLinearGradient(0, area.top, 0, area.bottom);
  g.addColorStop(0, hexA(color, 0.85));
  g.addColorStop(1, hexA(color, 0.12));
  return g;
}

function hexA(hex, alpha) {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Dzienne opady — wykres słupkowy (bohater pulpitu). */
export function rainfallChart(canvas, { labels, values }) {
  const Chart = window.Chart;
  const c = themeColors();
  return new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Opad (mm)",
          data: values,
          backgroundColor: (ctx) => areaGradient(ctx.chart.ctx, ctx.chart.chartArea, c.accent),
          hoverBackgroundColor: c.accent,
          borderRadius: 4,
          maxBarThickness: 34,
        },
      ],
    },
    options: {
      ...baseOptions(c),
      plugins: {
        ...baseOptions(c).plugins,
        tooltip: {
          ...baseOptions(c).plugins.tooltip,
          callbacks: {
            label: (item) => `${Number(item.parsed.y).toFixed(2).replace(".", ",")} mm`,
          },
        },
      },
    },
  });
}

/** Suma opadów per mostek — poziome słupki. */
export function bridgeChart(canvas, { labels, values }) {
  const Chart = window.Chart;
  const c = themeColors();
  return new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Suma (mm)",
          data: values,
          backgroundColor: hexA(c.accent, 0.75),
          hoverBackgroundColor: c.accent,
          borderRadius: 4,
          maxBarThickness: 22,
        },
      ],
    },
    options: {
      ...baseOptions(c),
      indexAxis: "y",
      scales: {
        x: {
          beginAtZero: true,
          grid: { color: c.line, drawTicks: false },
          border: { display: false },
          ticks: { color: c.faint, font: { family: "IBM Plex Mono", size: 11 }, padding: 8 },
        },
        y: {
          grid: { display: false },
          border: { color: c.line },
          ticks: { color: c.soft, font: { family: "IBM Plex Mono", size: 11 } },
        },
      },
    },
  });
}

export function destroyChart(chart) {
  if (chart && typeof chart.destroy === "function") chart.destroy();
}
