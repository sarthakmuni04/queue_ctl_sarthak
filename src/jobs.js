import { db } from "./db.js";
import { nowSec } from "./util.js";
import { getConfig } from "./config.js";

// =============== Enqueue ===============
export function enqueue(job) {
  let runAt = nowSec();
  if (job.run_at !== undefined) {
    const ts = new Date(job.run_at).getTime();
    if (!Number.isFinite(ts)) {
      throw new Error("Invalid run_at value. Expected a date or timestamp.");
    }
    runAt = Math.floor(ts / 1000);
  }

  const j = {
    id: job.id,
    command: job.command,
    state: "pending",
    attempts: 0,
    max_retries: job.max_retries ?? Number(getConfig("max-retries")),
    run_at: runAt,
  };

  db.prepare(
    `INSERT INTO jobs(id,command,state,attempts,max_retries,run_at)
     VALUES(@id,@command,@state,@attempts,@max_retries,@run_at)`
  ).run(j);

  return j;
}

// =============== List by State ===============
export function listByState(state) {
  return db
    .prepare("SELECT * FROM jobs WHERE state = ? ORDER BY created_at")
    .all(state);
}

// =============== Stats ===============
export function stats() {
  const total = db
    .prepare("SELECT state, COUNT(*) c FROM jobs GROUP BY state")
    .all();
  const summary = Object.fromEntries(total.map((r) => [r.state, r.c]));
  const all = db.prepare("SELECT COUNT(*) c FROM jobs").get().c;
  return { total: all, ...summary };
}

// =============== Claim Next ===============
export function claimNext() {
  const tx = db.transaction(() => {
    const job = db
      .prepare(
        `SELECT * FROM jobs
       WHERE state='pending' AND run_at <= ?
       ORDER BY created_at LIMIT 1`
      )
      .get(nowSec());
    if (!job) return null;
    db.prepare(
      `UPDATE jobs SET state='processing', updated_at=strftime('%s','now') WHERE id=?`
    ).run(job.id);
    job.state = "processing";
    return job;
  });
  return tx();
}

// =============== Complete ===============
export function complete(id) {
  db.prepare(
    `UPDATE jobs SET state='completed', updated_at=strftime('%s','now') WHERE id=?`
  ).run(id);
}

// =============== Fail and Retry ===============
export function failAndRetry(job, errorMessage) {
  const base = Number(getConfig("backoff-base")) || 2;
  const nextAttempt = job.attempts + 1;
  if (nextAttempt > job.max_retries) {
    db.transaction(() => {
      db.prepare("DELETE FROM jobs WHERE id=?").run(job.id);
      db.prepare(
        "INSERT OR REPLACE INTO dlq(id,command,attempts,max_retries,last_error) VALUES(?,?,?,?,?)"
      ).run(
        job.id,
        job.command,
        nextAttempt - 1,
        job.max_retries,
        errorMessage?.slice(0, 2048) || ""
      );
    })();
    return { movedToDLQ: true };
  }
  const delay = Math.pow(base, nextAttempt);
  const runAt = nowSec() + delay;
  db.prepare(
    `UPDATE jobs SET state='pending', attempts=?, run_at=?, updated_at=strftime('%s','now') WHERE id=?`
  ).run(nextAttempt, runAt, job.id);
  return { movedToDLQ: false, delay };
}

// =============== DLQ Fetch ===============
export function fetchDLQ() {
  return db.prepare("SELECT * FROM dlq ORDER BY failed_at DESC").all();
}

// =============== Retry from DLQ ===============
export function retryFromDLQ(id) {
  const row = db.prepare("SELECT * FROM dlq WHERE id=?").get(id);
  if (!row) throw new Error("DLQ job not found");
  db.transaction(() => {
    db.prepare("DELETE FROM dlq WHERE id=?").run(id);
    db.prepare(
      `INSERT OR REPLACE INTO jobs(id,command,state,attempts,max_retries,run_at)
       VALUES(?,?,?,?,?,strftime('%s','now'))`
    ).run(row.id, row.command, "pending", 0, row.max_retries);
  })();
}
