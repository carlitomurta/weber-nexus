import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));

export const workspaceRoot = path.resolve(currentDir, "../../..");
export const desktopRoot = path.join(workspaceRoot, "apps", "desktop");
export const runtimeApiPort = readPort(
  process.env.NEXUS_PLAYWRIGHT_RUNTIME_PORT,
  3330,
);
export const influxdbPort = readPort(
  process.env.NEXUS_PLAYWRIGHT_INFLUXDB_PORT,
  18_000 + (process.pid % 1000),
);
export const runtimeApiUrl = `http://127.0.0.1:${runtimeApiPort}`;
export const influxdbUrl = `http://127.0.0.1:${influxdbPort}`;
export const playwrightDataDir = path.join(workspaceRoot, ".playwright");
export const playwrightRunId =
  process.env.NEXUS_PLAYWRIGHT_RUN_ID ?? `${Date.now()}-${process.pid}`;
export const runtimeDataDir = path.join(
  playwrightDataDir,
  "runtime",
  playwrightRunId,
);
export const sqlitePath = path.join(runtimeDataDir, "sqlite", "nexus.db");
export const influxdbDataDir = path.join(runtimeDataDir, "influxdb");
export const runtimeConfigPath = path.join(
  runtimeDataDir,
  "runtime-config.ini",
);
export const runtimeLogPath = path.join(playwrightDataDir, "runtime.log");
export const influxdbBucket = "nexus_playwright";
export const influxdbToken = "apiv3_cGxheXdyaWdodC10b2tlbg==";
export const influxdbOrg = "playwright";

export function buildRuntimeEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    NODE_ENV: "test",
    PORT: String(runtimeApiPort),
    NEXUS_ENABLE_RUNTIME_STOP: "1",
    NEXUS_SKIP_CONTROLLER_XML_SYNC: "1",
    NEXUS_DATABASE_PATH: sqlitePath,
    NEXUS_DATABASE_MIGRATIONS_DIR: path.join(
      workspaceRoot,
      "packages",
      "database",
      "migrations",
    ),
    NEXUS_RESOURCES_PATH: path.join(workspaceRoot, "resources"),
    NEXUS_APP_INSTALL_DIR: workspaceRoot,
    NEXUS_RUNTIME_CONFIG_PATH: runtimeConfigPath,
    NEXUS_INFLUXDB_URL: influxdbUrl,
    NEXUS_INFLUXDB_HTTP_BIND: `127.0.0.1:${influxdbPort}`,
    NEXUS_INFLUXDB_DATA_DIR: influxdbDataDir,
    NEXUS_INFLUXDB_BUCKET: influxdbBucket,
    NEXUS_INFLUXDB_ORG: influxdbOrg,
    NEXUS_INFLUXDB_TOKEN: influxdbToken,
    INFLUXDB3_AUTH_TOKEN: influxdbToken,
    NEXUS_INFLUXDB_NODE_ID: "nexus-playwright",
  };
}

export function buildElectronEnv(): NodeJS.ProcessEnv {
  const env = {
    ...process.env,
    NODE_ENV: "test",
    VITE_RUNTIME_API_URL: runtimeApiUrl,
    NEXUS_RUNTIME_API_URL: runtimeApiUrl,
    NEXUS_DISABLE_RUNTIME_SPAWN: "1",
    NEXUS_BUILD_CHANNEL: "development",
    NEXUS_DESKTOP_MOCK_UPDATE_AVAILABLE:
      process.env.NEXUS_PLAYWRIGHT_MOCK_UPDATE_AVAILABLE,
    NEXUS_DESKTOP_MOCK_UPDATE_VERSION:
      process.env.NEXUS_PLAYWRIGHT_MOCK_UPDATE_VERSION,
  };

  delete env.ELECTRON_RUN_AS_NODE;
  delete env.ELECTRON_NO_ATTACH_CONSOLE;

  return env;
}

function readPort(value: string | undefined, fallback: number): number {
  const port = Number(value);

  if (Number.isInteger(port) && port > 0 && port <= 65535) {
    return port;
  }

  return fallback;
}
