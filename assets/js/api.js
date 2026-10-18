// Klient HTTP dla pbl-api. Dodaje nagłówek X-API-Key i normalizuje kopertę błędów.
import { getApiBase, getApiKey } from "./store.js";

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details || [];
  }
}

const STATUS_TEXT = {
  0: "Brak połączenia",
  401: "Brak klucza API",
  403: "Klucz nieprawidłowy lub nieaktywny",
  404: "Nie znaleziono",
  409: "Konflikt — zasób już istnieje lub został obsłużony",
  422: "Dane żądania są nieprawidłowe",
  429: "Zbyt wiele żądań",
  503: "Usługa chwilowo niedostępna",
};

function baseUrl() {
  const base = (getApiBase() || "").replace(/\/+$/, "");
  return base;
}

function authHeaders(extra) {
  const headers = Object.assign({ Accept: "application/json" }, extra || {});
  const key = getApiKey();
  if (key) headers["X-API-Key"] = key;
  return headers;
}

/**
 * Wykonuje żądanie do API.
 * @param {string} path ścieżka zaczynająca się od /api/v1 lub /health
 * @param {{method?:string, query?:object, body?:object, signal?:AbortSignal}} [opts]
 */
async function request(path, opts = {}) {
  const { method = "GET", query, body, signal } = opts;
  const url = new URL(baseUrl() + path, window.location.origin);

  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === "") continue;
      url.searchParams.set(k, String(v));
    }
  }

  const init = { method, headers: authHeaders(), signal };
  if (body !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(url, init);
  } catch (err) {
    if (err && err.name === "AbortError") throw err;
    throw new ApiError(
      0,
      "network_error",
      "Nie można połączyć się z API. Sprawdź adres w config.js oraz CORS po stronie API (CORS_ORIGINS musi zawierać adres panelu)."
    );
  }

  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const env = data && typeof data === "object" && data.error ? data.error : null;
    const message = (env && env.message) || STATUS_TEXT[res.status] || `Błąd HTTP ${res.status}`;
    throw new ApiError(res.status, (env && env.code) || `http_${res.status}`, message, env && env.details);
  }
  return data;
}

// --- Endpointy -----------------------------------------------------------
export const health = () => request("/health");
export const healthReady = () => request("/health/ready");

export const listMeasurements = (q, signal) =>
  request("/api/v1/measurements", { query: q, signal });
export const getMeasurement = (id, signal) =>
  request(`/api/v1/measurements/${encodeURIComponent(id)}`, { signal });

export const listCommands = (q, signal) => request("/api/v1/commands", { query: q, signal });
export const getCommand = (id, signal) =>
  request(`/api/v1/commands/${encodeURIComponent(id)}`, { signal });
export const createCommand = (body, signal) =>
  request("/api/v1/commands", { method: "POST", body, signal });
