# Demo-Video
https://drive.google.com/file/d/1HQX38uttvq2nbty4zl9C_JYzpecc5LDI/view?usp=sharing

# ⚙️ QueueCTL — Minimal Job Queue CLI (Node.js + SQLite)

**QueueCTL** is a lightweight, persistent job queue built with **Node.js** and **SQLite**.  
It provides a simple yet powerful CLI for managing background jobs with support for **multiple workers**, **retries**, **configurable backoff**, and a **Dead Letter Queue (DLQ)**.

---

## 🚀 Features

- 🧩 Persistent storage using SQLite
- 👷 Multiple worker processes with PID tracking
- 🔁 Retry mechanism with configurable backoff (fixed / linear / exponential)
- 💀 Dead Letter Queue for permanently failed jobs
- 🧠 Configurable via simple CLI commands
- 🧹 Graceful shutdown and reset commands
- 📊 Clear job lifecycle tracking (pending → processing → completed → failed → dead)

---

## 🧰 Prerequisites

- Node.js **v18+**
- npm (comes with Node)
- Git (for cloning the repo)
- macOS, Linux, or Windows with PowerShell / Git Bash

---

## 🧩 Setup Instructions

### 1️⃣ Clone and install

```bash
git clone https://github.com/sarthakmuni04/queue_ctl_sarthak.git 
cd queuectl
npm install
```

### 2️⃣ Configure data directory

To avoid file locks (especially on Windows OneDrive), use a dedicated folder.

**Windows:**

```bash
mkdir C:\queuectl_data
setx QUEUECTL_DATA_DIR "C:\queuectl_data"
```

**macOS/Linux:**

```bash
export QUEUECTL_DATA_DIR=$HOME/.queuectl_data
mkdir -p $QUEUECTL_DATA_DIR
```

---

## ⚙️ Usage Examples

### 🪄 Enqueue a Job

```bash
npm run enqueue -- '{\"id\":\"job1\",\"command\":\"echo Hello from QueueCTL\"}'
npm run enqueue -- '{\"id\":\"job6\",\"command\":\"exit 1\"}'    ->failed job
```

### 👷 Start Workers

```bash
npm run worker --count=2 
```

Starts 2 detached worker processes to handle queued jobs.

### 📋 List Jobs by State

```bash
npm run list                   # list all states
```

### 📊 View System Status

```bash
npm run status
```

Displays summary of jobs and active worker PIDs with CPU/memory usage.

### 🔁 Manage Configuration

```bash
# Set configuration values
npm run config -- set max-retries 3  
npm run config -- set backoff exponential
npm run config -- set backoff-base 1000

# View current configuration
npm run config -- get 
```

### 💀 Dead Letter Queue (DLQ)

Jobs that fail after max retries move to the DLQ.

```bash
# View DLQ jobs
npm run dlq

# Retry a DLQ job
npm run dlq --retry <job-id>

### 🛑 Stop Workers

```bash
npm run stop
```

Stops all running workers gracefully.

---

## 🧠 Architecture Overview

### 🧱 Components

| File              | Role                                            |
| ----------------- | ----------------------------------------------- |
| **src/cli.js**    | Main CLI command definitions                    |
| **src/worker.js** | Executes queued jobs, handles retries and DLQ   |
| **src/db.js**     | Initializes SQLite database and schema          |
| **src/jobs.js**   | Contains enqueue, fetch, and DLQ handling logic |
| **src/config.js** | Manages retry and backoff configuration         |

---

### 🔄 Job Lifecycle

```text
┌──────────────┐
│ enqueue(job) │
└──────┬───────┘
       ▼
  [ pending ]  ──▶ picked by worker
       │
       ▼
 [ processing ] ──▶ success → [ completed ]
       │
       ▼
     failure ──▶ retry (max-retries, backoff)
       │
       ▼
 exhausted ──▶ [ dead / DLQ ]
```

---

### 🧮 Backoff Strategies

| Type            | Behavior           | Example (base=1000ms) |
| --------------- | ------------------ | --------------------- |
| **fixed**       | Constant delay     | 1s → 1s → 1s          |
| **linear**      | Linear increase    | 1s → 2s → 3s          |
| **exponential** | Doubles each retry | 1s → 2s → 4s          |

Formula for exponential:

```
delay = base * (2 ^ (attempt - 1))
```

---

## 🧪 Testing Instructions

### 🔹 Quick Functional Test

```bash
npm run config -- set max-retries 3
npm run config -- set backoff exponential
npm run config -- set backoff-base 1000
npm run worker --count=2
npm run enqueue -- '{\"id\":\"job1\",\"command\":\"echo Hello from QueueCTL\"}'
```

Now run:

```bash
npm run status
npm run dlq
```

You’ll see retries with exponential backoff; after 3 failed attempts, the job moves to DLQ.

---

It performs:

1. Worker startup
2. Enqueue success + failure jobs
3. Check job transitions
4. Retry DLQ
5. Stop workers

---

## 📊 Example Output

```
📂 Using data directory: C:\queuectl_data

Job States:
─────────────────────────────
pending     : 1
processing  : 0
completed   : 4
failed      : 0
dead        : 0
─────────────────────────────
total       : 6

Active Workers:
─────────────────────────────
PID    CPU    Memory
3431   0.4%   28.6MB
─────────────────────────────
```

---

## 🧾 Available npm Scripts

| Command                       | Description               |
| ----------------------------- | ------------------------- |
| `npm run worker -- --count N` | Start N worker processes  |
| `npm run enqueue -- '<json>'` | Enqueue a job             |
| `npm run list`                | List jobs by state        |
| `npm run status`              | Show status summary       |
| `npm run config -- get/set`   | Manage configuration      |
| `npm run dlq`                 | Manage DLQ                |
| `npm run stop`                | Stop all running workers  |

---

## 🧱 Project Structure

```
queuectl/
├── src/
│   ├── cli.js          # CLI definitions
│   ├── worker.js       # Worker logic (process jobs)
│   ├── db.js           # SQLite setup
│   ├── jobs.js         # Job queue operations
│   ├── config.js       # Config storage
│   └── util.js         # Helpers
├── package.json
├── .gitignore
└── README.md
```

---

## 👨‍💻 Author

**Sarthak Muni**  
📧 sarthakmuni71@gmail.com  
🌐 [GitHub](https://github.com/sarthakmuni04)
