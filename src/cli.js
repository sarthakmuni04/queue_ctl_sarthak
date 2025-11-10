#!/usr/bin/env node
import { Command } from "commander";
import { enqueue, listByState, stats, fetchDLQ, retryFromDLQ } from "./jobs.js";
import pidusage from "pidusage";
import { getAllConfig, setConfig } from "./config.js";
import { jsonTryParse } from "./util.js";
import { fork } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  rmSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "./db.js";

const program = new Command();
const __dirname = dirname(fileURLToPath(import.meta.url));
const PIDFILE = process.env.QUEUECTL_PIDFILE || join(DATA_DIR, "workers.pid");

program
  .name("queuectl")
  .description("Minimal job queue CLI (Node.js)")
  .version("1.0.0");

program
  .command("enqueue")
  .argument("[payload...]", "job as JSON {id, command, max_retries?, run_at?}")
  .option("-f, --file <path>", "read job JSON from file")
  .option("--id <id>", "job id")
  .option("--command <cmd...>", "job command (supports spaces)")
  .action(async (payloadParts, opts) => {
    let text = null;

    // 1) file input
    if (opts.file) {
      text = await fs.readFile(opts.file, "utf8");
    }
    // 2) explicit flags
    else if (opts.id && opts.command) {
      const cmd = Array.isArray(opts.command)
        ? opts.command.join(" ")
        : opts.command;
      text = JSON.stringify({ id: opts.id, command: cmd });
    }
    // 3) rest args (re-join the line PowerShell split)
    else if (payloadParts?.length) {
      text = payloadParts.join(" ");
    }
    // 4) stdin (pipe JSON)
    else if (!process.stdin.isTTY) {
      text = await new Promise((resolve) => {
        let s = "";
        process.stdin.setEncoding("utf8");
        process.stdin.on("data", (d) => (s += d));
        process.stdin.on("end", () => resolve(s));
      });
    } else {
      console.error("Provide JSON, --file, or --id/--command.");
      process.exit(1);
    }

    text = text.trim();
    if (
      (text.startsWith('"') && text.endsWith('"')) ||
      (text.startsWith("'") && text.endsWith("'"))
    ) {
      text = text.slice(1, -1);
    }

    const obj = jsonTryParse(text);
    if (!obj || !obj.id || !obj.command) {
      console.error("Invalid job JSON. Requires id and command.");
      process.exit(1);
    }

    try {
      const j = enqueue(obj);
      console.log("enqueued", j);
    } catch (err) {
      console.error(err?.message || String(err));
      process.exit(1);
    }
  });

program
 .command("worker")
  .description("Manage workers")
  .argument("<action>", "start|stop")
  .argument("[count]", "number of workers when starting")
  .option("--count <n>", "number of workers")
  .action(async (action, opts) => {
    const sub = action;
    if (sub === "start") {
      const n = Number(opts.count || 1);
      const pids = [];
      for (let i = 0; i < n; i++) {
        const proc = fork(join(__dirname, "worker.js"), {
          detached: true,
          stdio: "ignore",
        });
        proc.unref();
        pids.push(proc.pid);
      }
      const pidDir = dirname(PIDFILE);
      if (!existsSync(pidDir)) {
        mkdirSync(pidDir, { recursive: true });
      }
      writeFileSync(
        PIDFILE,
        JSON.stringify({ startedAt: Date.now(), pids }, null, 2)
      );
      console.log(`Started ${pids.length} worker(s). PID file: ${PIDFILE}`);
    } else if (sub === "stop") {
      if (!existsSync(PIDFILE)) {
        console.log("No workers running.");
        return;
      }
      const { pids } = JSON.parse(readFileSync(PIDFILE, "utf8"));
      for (const pid of pids) {
        try {
          process.kill(pid, "SIGTERM");
        } catch {
          // ignore
        }
      }
      rmSync(PIDFILE, { force: true });
      console.log(
        "Sent SIGTERM to workers. They will finish current job and exit."
      );
    }
  });

// =============== status ===============
program
  .command("status")
  .description("Show summary of all job states & active workers")
  .action(async () => {
    const s = stats(); // { total, pending, processing, completed, ... }
    const workers = [];
    if (existsSync(PIDFILE)) {
      const { pids } = JSON.parse(readFileSync(PIDFILE, "utf8"));
      for (const pid of pids) {
        try {
          const info = await pidusage(pid);
          workers.push({
            pid,
            cpu: `${info.cpu.toFixed(1)}%`,
            mem: `${(info.memory / 1024 / 1024).toFixed(1)}MB`,
          });
        } catch {
          workers.push({ pid, dead: true });
        }
      }
    }
    console.log({ jobs: s, workers });
  });

// =============== list ===============
program
  .command("list")
  .description("List jobs by state (or all states if none specified)")
  .option("--state <state>", "pending|processing|completed|failed|dead")
  .action((opts) => {
    const state = opts.state;

    // ✅ Case 1: Specific state requested
    if (state) {
      console.log(`\n📋 Listing jobs in state: ${state.toUpperCase()}`);
      const rows = listByState(state);
      if (!rows || rows.length === 0) {
        console.log("(No jobs found in this state)");
      } else {
        console.table(rows);
      }
      return;
    }

    // ✅ Case 2: No state specified → list all states
    const allStates = ["pending", "processing", "completed", "failed", "dead"];
    for (const st of allStates) {
      console.log(`\n📋 State: ${st.toUpperCase()}`);
      const rows = listByState(st);
      if (!rows || rows.length === 0) {
        console.log("(No jobs found)");
      } else {
        console.table(rows);
      }
    }
  });

// =============== dlq ===============
program
  .command("dlq")
  .description("View or retry DLQ jobs")
  .argument("[action]", "list|retry", "list")
  .argument("[id]", "job id for retry")
  .action((action, id) => {
    if (action === "list") {
      console.table(fetchDLQ());
    } else if (action === "retry") {
      if (!id) {
        console.error("Provide job id to retry");
        process.exit(1);
      }
      retryFromDLQ(id);
      console.log("Moved job back to pending:", id);
    }
  });

// =============== config ===============
program
  .command("config")
  .description("Manage configuration (retry, backoff, etc.)")
  .argument("<op>", "get|set")
  .argument("[key]")
  .argument("[value]")
  .action((op, key, value) => {
    if (op === "get") {
      console.log(getAllConfig());
    } else if (op === "set") {
      if (!key || value == null) {
        console.error("Usage: queuectl config set <key> <value>");
        process.exit(1);
      }
      setConfig(key, value);
      console.log("OK");
    }
  });

program.parse();
