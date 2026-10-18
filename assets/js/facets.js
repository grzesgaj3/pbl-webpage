// Jednorazowo pobiera i buforuje listę mostków oraz sensorów widocznych w danych.
// API nie udostępnia /bridges, więc zestaw wyprowadzamy z pomiarów i komend.
import { listMeasurements, listCommands } from "./api.js";

let cache = null;
let pending = null;

export function getFacets({ force = false } = {}) {
  if (cache && !force) return Promise.resolve(cache);
  if (pending && !force) return pending;
  pending = (async () => {
    const [meas, cmds] = await Promise.all([
      listMeasurements({ limit: 1000 }),
      listCommands({ limit: 1000 }),
    ]);
    const bridges = new Set();
    const sensors = new Set();
    for (const m of meas.items || []) {
      if (m.bridge_id) bridges.add(m.bridge_id);
      if (m.sensor_id) sensors.add(m.sensor_id);
    }
    for (const c of cmds.items || []) {
      if (c.bridge_id) bridges.add(c.bridge_id);
      if (c.sensor_id) sensors.add(c.sensor_id);
    }
    cache = {
      bridges: [...bridges].sort(),
      sensors: [...sensors].sort(),
    };
    return cache;
  })();
  pending.catch(() => {
    pending = null;
  });
  return pending;
}

export function invalidateFacets() {
  cache = null;
  pending = null;
}
