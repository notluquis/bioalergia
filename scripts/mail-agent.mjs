#!/usr/bin/env node
import { execFileSync, spawn } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const ARTIFACTS_DIR = join(ROOT, "artifacts");
const PID_PATH = join(ARTIFACTS_DIR, "local-mail-agent.pid");
const LOG_PATH = join(ARTIFACTS_DIR, "local-mail-agent.log");
const SERVICE_NAME = "bioalergia-local-mail-agent";

const PORT = process.env.LOCAL_AGENT_PORT ?? "3333";
const BASE_URL = process.env.LOCAL_AGENT_URL ?? `https://127.0.0.1:${PORT}`;
const TLS_KEY_PATH = process.env.LOCAL_AGENT_TLS_KEY_PATH ?? join(ROOT, "127.0.0.1+1-key.pem");
const TLS_CERT_PATH = process.env.LOCAL_AGENT_TLS_CERT_PATH ?? join(ROOT, "127.0.0.1+1.pem");

function ensureArtifacts() {
  if (!existsSync(ARTIFACTS_DIR)) {
    mkdirSync(ARTIFACTS_DIR, { recursive: true });
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readPid() {
  try {
    return Number.parseInt(readFileSync(PID_PATH, "utf8").trim(), 10);
  } catch {
    return null;
  }
}

function isPidRunning(pid) {
  if (!pid || Number.isNaN(pid)) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function readKeychainToken() {
  const value = execFileSync("security", [
    "find-generic-password",
    "-s",
    SERVICE_NAME,
    "-a",
    "agent_token",
    "-w",
  ]);
  return value.toString("utf8").trim();
}

function requestJson(method, path, { headers = {}, body } = {}) {
  const headerArgs = Object.entries(headers).flatMap(([key, value]) => ["-H", `${key}: ${value}`]);
  const dataArgs = body ? ["--data", typeof body === "string" ? body : JSON.stringify(body)] : [];
  const url = new URL(path, BASE_URL).toString();
  const output = execFileSync("curl", [
    "-k",
    "-s",
    "--max-time",
    "3",
    "-X",
    method,
    ...headerArgs,
    ...dataArgs,
    "-w",
    "\\n%{http_code}",
    url,
  ]).toString("utf8");

  const lines = output.trimEnd().split("\\n");
  const statusRaw = lines.pop() ?? "0";
  const raw = lines.join("\\n");
  let parsed = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }
  return { status: Number.parseInt(statusRaw, 10) || 0, body: parsed, raw };
}

async function checkHealth() {
  try {
    const output = execFileSync("curl", [
      "-k",
      "-s",
      "--max-time",
      "3",
      "-o",
      "/dev/null",
      "-w",
      "%{http_code}",
      new URL("/health", BASE_URL).toString(),
    ]).toString("utf8");
    return output.trim() === "200";
  } catch {
    return false;
  }
}

async function cmdStatus() {
  const pid = readPid();
  const health = await checkHealth();
  if (health) {
    const pidSuffix = isPidRunning(pid) ? ` pid=${pid}` : "";
    console.log(`local-mail-agent: running (${BASE_URL})${pidSuffix}`);
    return;
  }
  if (isPidRunning(pid)) {
    console.log(`local-mail-agent: process alive but health check failing (pid=${pid})`);
    return;
  }
  console.log("local-mail-agent: stopped");
}

async function cmdStart() {
  ensureArtifacts();

  if (!existsSync(TLS_KEY_PATH) || !existsSync(TLS_CERT_PATH)) {
    console.error("TLS certs not found. Expected:");
    console.error(`- ${TLS_KEY_PATH}`);
    console.error(`- ${TLS_CERT_PATH}`);
    console.error("Generate with: mkcert -install && mkcert 127.0.0.1 localhost");
    process.exit(1);
  }

  if (await checkHealth()) {
    console.log(`local-mail-agent already running at ${BASE_URL}`);
    return;
  }

  const existingPid = readPid();
  if (isPidRunning(existingPid)) {
    try {
      process.kill(existingPid, "SIGTERM");
    } catch {
      // ignore and continue start attempt
    }
    await delay(400);
  }

  const logStream = createWriteStream(LOG_PATH, { flags: "a" });
  const child = spawn("pnpm", ["--filter", "@finanzas/local-mail-agent", "start"], {
    cwd: ROOT,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      PORT,
      LOCAL_AGENT_TLS_KEY_PATH: TLS_KEY_PATH,
      LOCAL_AGENT_TLS_CERT_PATH: TLS_CERT_PATH,
    },
  });

  child.stdout.pipe(logStream);
  child.stderr.pipe(logStream);
  child.unref();

  writeFileSync(PID_PATH, String(child.pid));

  for (let i = 0; i < 25; i += 1) {
    if (await checkHealth()) {
      console.log(`local-mail-agent started at ${BASE_URL} (pid=${child.pid})`);
      console.log(`logs: ${LOG_PATH}`);
      return;
    }
    await delay(200);
  }

  console.error("local-mail-agent did not become healthy in time.");
  console.error(`Check logs: ${LOG_PATH}`);
  process.exit(1);
}

async function cmdStop() {
  const pid = readPid();

  try {
    const token = readKeychainToken();
    const res = requestJson("POST", "/shutdown", {
      headers: { "X-Local-Agent-Token": token },
    });

    if (res.status === 200) {
      console.log("local-mail-agent shutdown requested");
      await delay(300);
      return;
    }
  } catch {
    // fallback to PID handling below
  }

  if (isPidRunning(pid)) {
    try {
      process.kill(pid, "SIGTERM");
      console.log(`local-mail-agent stopped (pid=${pid})`);
      return;
    } catch {
      // ignore and report below
    }
  }

  console.log("local-mail-agent already stopped");
}

function cmdLogs() {
  ensureArtifacts();
  console.log(`tailing ${LOG_PATH}`);
  const child = spawn("tail", ["-n", "120", "-f", LOG_PATH], {
    stdio: "inherit",
  });
  child.on("exit", (code) => {
    process.exit(code ?? 0);
  });
}

async function main() {
  const command = process.argv[2] ?? "status";

  if (command === "start") {
    await cmdStart();
    return;
  }
  if (command === "stop") {
    await cmdStop();
    return;
  }
  if (command === "status") {
    await cmdStatus();
    return;
  }
  if (command === "logs") {
    cmdLogs();
    return;
  }

  console.error("Usage: pnpm mail:start | pnpm mail:stop | pnpm mail:status | pnpm mail:logs");
  process.exit(1);
}

void main();
