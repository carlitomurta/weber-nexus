import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, "..");
const nativeModules = ["better-sqlite3"];

if (canOpenBetterSqlite()) {
  process.exit(0);
}

console.warn(
  "[native] Recompilando módulos nativos para a versão atual do Node.js...",
);

const result = spawnSync("yarn", ["rebuild", ...nativeModules], {
  cwd: workspaceRoot,
  env: nodeRuntimeEnv(),
  shell: process.platform === "win32",
  stdio: "inherit",
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

if (!canOpenBetterSqlite()) {
  console.error(
    "[native] Falha ao validar better-sqlite3 após recompilação.",
  );
  process.exit(1);
}

function canOpenBetterSqlite() {
  try {
    const require = createRequire(import.meta.url);
    const Database = require("better-sqlite3");
    const database = new Database(":memory:");
    database.close();
    return true;
  } catch (error) {
    if (isNativeAbiError(error)) {
      return false;
    }

    throw error;
  }
}

function isNativeAbiError(error) {
  return (
    error instanceof Error &&
    (error.code === "ERR_DLOPEN_FAILED" ||
      error.message.includes("NODE_MODULE_VERSION"))
  );
}

function nodeRuntimeEnv() {
  const env = { ...process.env };

  delete env.ELECTRON_RUN_AS_NODE;
  delete env.npm_config_runtime;
  delete env.npm_config_target;
  delete env.npm_config_disturl;
  delete env.NPM_CONFIG_RUNTIME;
  delete env.NPM_CONFIG_TARGET;
  delete env.NPM_CONFIG_DISTURL;

  return env;
}
