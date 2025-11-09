import { db } from "./db.js";

const defaultConfig = {
  "max-retries": "3",
  "backoff-base": "2",
};

export function getConfig(key) {
  const row = db.prepare("SELECT value FROM config WHERE key = ?").get(key);
  if (row) return row.value;
  if (key in defaultConfig) return defaultConfig[key];
  return null;
}

export function setConfig(key, value) {
  db.prepare("REPLACE INTO config(key,value) VALUES(?,?)").run(
    key,
    String(value)
  );
}

export function getAllConfig() {
  const rows = db.prepare("SELECT key, value FROM config").all();
  const out = { ...defaultConfig };
  for (const r of rows) out[r.key] = r.value;
  return out;
}
