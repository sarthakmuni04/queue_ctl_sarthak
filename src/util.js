export function nowSec() {
  return Math.floor(Date.now() / 1000);
}
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function jsonTryParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
