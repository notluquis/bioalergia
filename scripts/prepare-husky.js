import { execSync } from "node:child_process";

try {
  require.resolve("husky");
} catch {
  process.exit(0);
}

execSync("husky install", { stdio: "inherit" });
