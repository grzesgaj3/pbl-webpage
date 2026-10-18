// Testy czystej logiki panelu: wyliczanie zakresów czasu i budowa serii wykresu.
// Uruchomienie: node --test tests/
import test from "node:test";
import assert from "node:assert/strict";

import { RANGES, DEFAULT_RANGE, rangeWindow, buildSeries } from "../assets/js/ranges.js";

const NOW = Date.UTC(2026, 9, 18, 12, 0, 0); // ms, ustalony "teraz"

test("rangeWindow: 24 h kończy się teraz i obejmuje dokładnie dobę", () => {
  const { from, to } = rangeWindow("24h", NOW);
  assert.equal(to, Math.floor(NOW / 1000));
  assert.equal(from, Math.floor(NOW / 1000) - 24 * 3600);
});

test("rangeWindow: 'all' nie ma dolnej granicy", () => {
  const { from, to } = rangeWindow("all", NOW);
  assert.equal(from, null);
  assert.equal(to, Math.floor(NOW / 1000));
});

test("rangeWindow: nieznany identyfikator spada na zakres domyślny", () => {
  const def = RANGES.find((r) => r.id === DEFAULT_RANGE);
  const { from } = rangeWindow("nie-ma-takiego", NOW);
  assert.equal(from, Math.floor(NOW / 1000) - def.ms / 1000);
});

test("buildSeries: sortuje rosnąco po czasie i zamienia wartości na liczby", () => {
  const pts = buildSeries([
    { sent_at: "2026-10-18T12:00:00Z", value_mm: "4.20" },
    { sent_at: "2026-10-18T10:00:00Z", value_mm: 1.5 },
  ]);
  assert.deepEqual(
    pts.map((p) => p.y),
    [1.5, 4.2]
  );
  assert.ok(pts[0].x < pts[1].x, "punkty posortowane rosnąco");
});

test("buildSeries: pomija rekordy bez poprawnego czasu lub wartości", () => {
  const pts = buildSeries([
    { sent_at: "bez-daty", value_mm: 2 },
    { sent_at: "2026-10-18T12:00:00Z", value_mm: null },
    { sent_at: "2026-10-18T13:00:00Z", value_mm: 3 },
  ]);
  assert.equal(pts.length, 1);
  assert.equal(pts[0].y, 3);
});

test("buildSeries: pusta lista daje pustą serię", () => {
  assert.deepEqual(buildSeries(), []);
  assert.deepEqual(buildSeries([]), []);
});
