#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import process from "node:process";

const port = Number.parseInt(process.env.PORT ?? "3333", 10);

if (!Number.isFinite(port) || port <= 0) {
  console.error(`[local-mail-agent] Invalid PORT: ${process.env.PORT ?? ""}`);
  process.exit(1);
}

function findListeningPids(targetPort) {
  try {
    const output = execFileSync("lsof", ["-nP", `-iTCP:${targetPort}`, "-sTCP:LISTEN", "-t"], {
      encoding: "utf8",
    }).trim();

    if (!output) {
      return [];
    }

    return Array.from(
      new Set(
        output
          .split("\n")
          .map((value) => Number.parseInt(value.trim(), 10))
          .filter((value) => Number.isFinite(value) && value > 0 && value !== process.pid)
      )
    );
  } catch {
    return [];
  }
}

function killPids(pids, signal) {
  for (const pid of pids) {
    try {
      process.kill(pid, signal);
    } catch {
      // ignore dead or unauthorized processes
    }
  }
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const listeningPids = findListeningPids(port);

  if (listeningPids.length === 0) {
    return;
  }

  console.log(
    `[local-mail-agent] Freeing port ${port}. Found listener PID(s): ${listeningPids.join(", ")}`
  );

  killPids(listeningPids, "SIGTERM");
  await sleep(300);

  const stillListening = findListeningPids(port);
  if (stillListening.length > 0) {
    killPids(stillListening, "SIGKILL");
    await sleep(200);
  }

  const finalCheck = findListeningPids(port);
  if (finalCheck.length > 0) {
    console.error(
      `[local-mail-agent] Port ${port} is still in use by PID(s): ${finalCheck.join(", ")}`
    );
    process.exit(1);
  }
}

await main();
