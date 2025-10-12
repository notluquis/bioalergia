#!/usr/bin/env node
import { execSync } from "node:child_process";

function run(command) {
  try {
    execSync(command, { stdio: "ignore" });
  } catch {
    // Ignoramos procesos inexistentes.
  }
}

function killByName(pattern) {
  run(`pkill -f "${pattern}"`);
}

function killByPort(port) {
  try {
    const output = execSync(`lsof -ti tcp:${port}`, { encoding: "utf8" }).trim();
    if (!output) return;
    const pids = output.split(/\s+/).filter(Boolean);
    for (const pid of pids) {
      run(`kill -9 ${pid}`);
    }
  } catch {
    // No processes on that port.
  }
}

console.log("[reset-dev] Limpiando procesos previos de desarrollo...");

killByName("tsx watch --tsconfig tsconfig.server.json server/index.ts");
killByName("node .*\\.bin/vite");
killByName("npm run server");
killByPort(4000);
killByPort(5173);
killByPort(5174);

console.log("[reset-dev] Procesos cerrados. Ambiente listo.");
