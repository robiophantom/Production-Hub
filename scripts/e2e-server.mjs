import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import path from "node:path";

// A fresh embedded database per E2E run keeps specs deterministic.
await rm(path.join(process.cwd(), ".data", "e2e-pgdata"), { recursive: true, force: true });

const child = spawn("npx next dev --port 3100", {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

function shutdown(signal) {
  child.kill(signal);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
child.on("exit", (code) => process.exit(code ?? 0));
