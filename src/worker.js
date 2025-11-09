#!/usr/bin/env node
import { exec } from "node:child_process";
import process from "node:process";
import { claimNext, complete, failAndRetry } from "./jobs.js";
import { sleep } from "./util.js";
import { db } from "./db.js"; // ensure DB ready
import "dotenv/config";

let running = true;

process.on("SIGINT", () => {
  running = false;
});
process.on("SIGTERM", () => {
  running = false;
});

async function runJob(job) {
  return new Promise((resolve) => {
    const child = exec(job.command, { shell: true });
    let errorBuf = "";
    child.stderr?.on("data", (d) => {
      errorBuf += String(d);
    });
    child.on("close", (code) => {
      if (code === 0) resolve({ ok: true });
      else resolve({ ok: false, error: `exit ${code}. ${errorBuf}` });
    });
    child.on("error", (err) => resolve({ ok: false, error: String(err) }));
  });
}

export async function workerLoop() {
  while (running) {
    const job = claimNext();
    if (!job) {
      await sleep(500);
      continue;
    }
    const res = await runJob(job);
    if (res.ok) {
      complete(job.id);
    } else {
      const out = failAndRetry(job, res.error);
      if (out.movedToDLQ) {
        // nothing else to do
      }
    }
  }
}

workerLoop().catch((err) => {
  console.error("[worker] fatal:", err);
  process.exit(1);
});
