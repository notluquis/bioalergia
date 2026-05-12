#!/usr/bin/env node
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const appDir = resolve(__dirname, "..");
const repoRoot = resolve(appDir, "../..");

const isStartMode = process.argv[2] === "start";

const defaultKeyPath = join(repoRoot, "127.0.0.1+1-key.pem");
const defaultCertPath = join(repoRoot, "127.0.0.1+1.pem");

const env = {
  ...process.env,
  PORT: process.env.PORT ?? "3333",
  LOCAL_AGENT_ALLOWED_ORIGINS:
    process.env.LOCAL_AGENT_ALLOWED_ORIGINS ??
    "https://intranet.bioalergia.cl,http://localhost,https://localhost,http://127.0.0.1,https://127.0.0.1",
};

const hasKeyPath = Boolean(env.LOCAL_AGENT_TLS_KEY_PATH);
const hasCertPath = Boolean(env.LOCAL_AGENT_TLS_CERT_PATH);
if (hasKeyPath !== hasCertPath) {
  console.error(
    "[local-mail-agent] Invalid TLS config: LOCAL_AGENT_TLS_KEY_PATH and LOCAL_AGENT_TLS_CERT_PATH must be set together."
  );
  process.exit(1);
}

if (!env.LOCAL_AGENT_TLS_KEY_PATH && !env.LOCAL_AGENT_TLS_CERT_PATH) {
  if (existsSync(defaultKeyPath) && existsSync(defaultCertPath)) {
    env.LOCAL_AGENT_TLS_KEY_PATH = defaultKeyPath;
    env.LOCAL_AGENT_TLS_CERT_PATH = defaultCertPath;
  }
}

const tlsEnabled = Boolean(env.LOCAL_AGENT_TLS_KEY_PATH && env.LOCAL_AGENT_TLS_CERT_PATH);
console.log(
  `[local-mail-agent] mode=${isStartMode ? "start" : "watch"} port=${env.PORT} tls=${tlsEnabled ? "on" : "off"}`
);
if (tlsEnabled) {
  console.log(`[local-mail-agent] tls key=${env.LOCAL_AGENT_TLS_KEY_PATH}`);
  console.log(`[local-mail-agent] tls cert=${env.LOCAL_AGENT_TLS_CERT_PATH}`);
}

// Node 26 strips TypeScript natively; no tsx needed. Watch mode uses
// node --watch.
const nodeArgs = isStartMode ? ["src/index.ts"] : ["--watch", "src/index.ts"];
const child = spawn("node", nodeArgs, {
  cwd: appDir,
  stdio: "inherit",
  env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
