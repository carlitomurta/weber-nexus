import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const runtimePort = process.env.NEXUS_PLAYWRIGHT_RUNTIME_PORT ?? "3330";
const runtimeApiUrl = `http://127.0.0.1:${runtimePort}`;
const env = {
  ...process.env,
  VITE_RUNTIME_API_URL: runtimeApiUrl,
  NEXUS_RUNTIME_API_URL: runtimeApiUrl,
  NEXUS_DISABLE_RUNTIME_SPAWN: "1",
  NEXUS_BUILD_CHANNEL: "development",
};

const child = spawn(
  process.platform === "win32" ? "yarn.cmd" : "yarn",
  ["workspace", "@weber-nexus/desktop", "build:bundle"],
  {
    cwd: workspaceRoot,
    env,
    stdio: "inherit",
    shell: process.platform === "win32",
  },
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
