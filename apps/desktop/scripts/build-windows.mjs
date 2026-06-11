import { spawnSync } from "node:child_process";

const nativeModules = [
  "better-sqlite3",
  "bcrypt",
  "@serialport/bindings-cpp",
];

const buildResult = run("yarn", [
  "workspace",
  "@weber-nexus/desktop",
  "exec",
  "electron-builder",
  "--win",
  "nsis",
  "--x64",
]);

const rebuildResult = run("yarn", ["rebuild", ...nativeModules]);

if (buildResult.status !== 0) {
  process.exit(buildResult.status ?? 1);
}

if (rebuildResult.status !== 0) {
  process.exit(rebuildResult.status ?? 1);
}

function run(command, args) {
  return spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
}
