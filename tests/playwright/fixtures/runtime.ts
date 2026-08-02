import Database from "better-sqlite3";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import {
  buildRuntimeEnv,
  influxdbBucket,
  influxdbOrg,
  influxdbToken,
  influxdbUrl,
  playwrightDataDir,
  runtimeApiUrl,
  runtimeDataDir,
  runtimeLogPath,
  sqlitePath,
  workspaceRoot,
} from "./environment";

export type SeededController = {
  id: number;
  name: string;
  model: string;
  ipAddress: string;
  site: string;
};

export type SeededSensor = {
  id: number;
  controllerId: number;
  nodeId: number;
  name: string;
};

export type PlaywrightSeed = {
  controller: SeededController;
  sensor: SeededSensor;
};

export type RuntimeHarness = {
  env: NodeJS.ProcessEnv;
  seed: PlaywrightSeed;
  stop: () => Promise<void>;
};

type InsertedRow = {
  id: number | bigint;
};

const RUNTIME_START_TIMEOUT_MS = 75_000;

export async function startRuntimeHarness(): Promise<RuntimeHarness> {
  await resetRuntimeData();

  const env = buildRuntimeEnv();
  const runtimeProcess = await spawnRuntime(env);

  await waitForRuntime(runtimeProcess);

  const seed = seedSqlite();
  await seedInfluxdb(seed);

  return {
    env,
    seed,
    stop: () => stopRuntime(runtimeProcess),
  };
}

async function resetRuntimeData(): Promise<void> {
  await rm(runtimeLogPath, { force: true });
  await mkdir(path.dirname(sqlitePath), { recursive: true });
  await mkdir(playwrightDataDir, { recursive: true });
}

async function spawnRuntime(
  env: NodeJS.ProcessEnv,
): Promise<ChildProcessWithoutNullStreams> {
  const mainPath = runtimeMainPath();

  const command = `${quoteShell(process.execPath)} ${quoteShell(mainPath)}`;

  fs.appendFileSync(runtimeLogPath, `Iniciando runtime: ${command}\n`, "utf8");

  const log = fs.createWriteStream(runtimeLogPath, { flags: "a" });
  const runtimeProcess = spawn(
    process.platform === "win32" ? process.execPath : "bash",
    process.platform === "win32" ? [mainPath] : ["-lc", command],
    {
      cwd: workspaceRoot,
      env,
      stdio: "pipe",
      windowsHide: true,
    },
  );

  runtimeProcess.stdout.pipe(log);
  runtimeProcess.stderr.pipe(log);

  runtimeProcess.once("error", (error) => {
    log.write(
      `Falha ao iniciar processo do runtime: ${error.stack ?? error.message}\n`,
    );
  });

  runtimeProcess.once("exit", (code, signal) => {
    log.write(`Processo do runtime encerrou: code=${code} signal=${signal}\n`);
    log.end();
  });

  return runtimeProcess;
}

function quoteShell(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function runtimeMainPath(): string {
  const bundledPath = path.join(
    workspaceRoot,
    "apps",
    "runtime",
    "dist",
    "main.js",
  );
  const tscPath = path.join(
    workspaceRoot,
    "apps",
    "runtime",
    "dist",
    "src",
    "main.js",
  );

  return fs.existsSync(bundledPath) ? bundledPath : tscPath;
}

async function waitForRuntime(
  runtimeProcess: ChildProcessWithoutNullStreams,
): Promise<void> {
  const startedAt = Date.now();
  let nextLogAt = startedAt;

  while (Date.now() - startedAt < RUNTIME_START_TIMEOUT_MS) {
    try {
      const response = await fetch(`${runtimeApiUrl}/runtime/health`);

      if (response.ok) {
        appendRuntimeLog(`Runtime pronto: ${response.status}\n`);
        return;
      }

      if (Date.now() >= nextLogAt) {
        appendRuntimeLog(`Health respondeu status ${response.status}\n`);
        nextLogAt = Date.now() + 5_000;
      }
    } catch {
      if (Date.now() >= nextLogAt) {
        appendRuntimeLog("Health ainda indisponível.\n");
        nextLogAt = Date.now() + 5_000;
      }
    }

    await sleep(500);
  }

  const exitCode = runtimeProcess.exitCode ?? "pendente";

  throw new Error(
    `Runtime não respondeu em ${runtimeApiUrl}. Processo wrapper saiu com código ${exitCode}. Veja ${runtimeLogPath}.`,
  );
}

function appendRuntimeLog(message: string): void {
  fs.appendFileSync(runtimeLogPath, message, "utf8");
}

function seedSqlite(): PlaywrightSeed {
  const db = new Database(sqlitePath);

  db.pragma("busy_timeout = 5000");

  try {
    return db.transaction(() => {
      db.prepare("DELETE FROM sensors").run();
      db.prepare("DELETE FROM controllers").run();

      const controller = db
        .prepare(
          [
            "INSERT INTO controllers",
            "(name, model, ipAddress, site, port, is_multihop, operational_status, polling_interval_ms)",
            "VALUES (@name, @model, @ipAddress, @site, @port, @isMultihop, @operationalStatus, @pollingIntervalMs)",
            "RETURNING id",
          ].join(" "),
        )
        .get({
          name: "DXM Playwright Norte",
          model: "DXM1200",
          ipAddress: "127.0.0.1",
          site: "Linha Playwright",
          port: 0,
          isMultihop: 0,
          operationalStatus: "active",
          pollingIntervalMs: 60_000,
        }) as InsertedRow;
      const controllerId = Number(controller.id);

      const sensor = db
        .prepare(
          [
            "INSERT INTO sensors",
            "(controller_id, node_id, name, description, model, location, operational_status, registers)",
            "VALUES (@controllerId, @nodeId, @name, @description, @model, @location, @operationalStatus, @registers)",
            "RETURNING id",
          ].join(" "),
        )
        .get({
          controllerId,
          nodeId: 3,
          name: "Bomba Playwright 01",
          description: "Vibração e temperatura",
          model: "QM30VT2",
          location: "Mancal superior",
          operationalStatus: "active",
          registers: JSON.stringify([
            {
              name: "Status",
              address: 49,
              unit: "",
              isHealthCheck: true,
            },
            {
              name: "Vibração",
              address: 50,
              scaleType: "multiply",
              scaleFactor: 0.1,
              unit: "mm/s",
            },
            {
              name: "Temperatura",
              address: 51,
              unit: "°C",
            },
          ]),
        }) as InsertedRow;

      return {
        controller: {
          id: controllerId,
          name: "DXM Playwright Norte",
          model: "DXM1200",
          ipAddress: "127.0.0.1",
          site: "Linha Playwright",
        },
        sensor: {
          id: Number(sensor.id),
          controllerId,
          nodeId: 3,
          name: "Bomba Playwright 01",
        },
      };
    })();
  } finally {
    db.close();
  }
}

async function seedInfluxdb(seed: PlaywrightSeed): Promise<void> {
  const timestamp = BigInt(Date.now() - 60_000) * 1_000_000n;
  const lineProtocol = [
    [
      sensorReadingTags(seed, 49, "health"),
      'raw_value=128i,controller_name="DXM Playwright Norte",sensor_name="Bomba Playwright 01",register_name="Status",health_state_code=128i,status_text="ONLINE",online=true',
      timestamp.toString(),
    ].join(" "),
    [
      sensorReadingTags(seed, 50, "metric"),
      'raw_value=123i,controller_name="DXM Playwright Norte",sensor_name="Bomba Playwright 01",register_name="Vibração",scaled_value=12.3,unit="mm/s"',
      timestamp.toString(),
    ].join(" "),
    [
      sensorReadingTags(seed, 51, "metric"),
      'raw_value=42i,controller_name="DXM Playwright Norte",sensor_name="Bomba Playwright 01",register_name="Temperatura",scaled_value=42,unit="°C"',
      timestamp.toString(),
    ].join(" "),
  ].join("\n");
  const writeUrl = new URL("/api/v2/write", influxdbUrl);

  writeUrl.searchParams.set("org", influxdbOrg);
  writeUrl.searchParams.set("bucket", influxdbBucket);
  writeUrl.searchParams.set("precision", "ns");

  const response = await fetch(writeUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${influxdbToken}`,
      "Content-Type": "text/plain; charset=utf-8",
    },
    body: lineProtocol,
  });

  if (response.status !== 204) {
    throw new Error(
      `Seed do InfluxDB falhou com status ${response.status}: ${await response.text()}`,
    );
  }
}

function sensorReadingTags(
  seed: PlaywrightSeed,
  registerAddress: number,
  registerKind: "health" | "metric",
): string {
  return [
    "sensor_readings",
    `controller_id=${seed.controller.id}`,
    `sensor_id=${seed.sensor.id}`,
    "node_id=3",
    `register_address=${registerAddress}`,
    `register_kind=${registerKind}`,
  ].join(",");
}

async function stopRuntime(
  runtimeProcess: ChildProcessWithoutNullStreams,
): Promise<void> {
  try {
    await fetch(`${runtimeApiUrl}/runtime/stop`, { method: "POST" });
  } catch {
    // O processo pode encerrar antes de responder.
  }

  if (runtimeProcess.exitCode === null) {
    killProcessTree(runtimeProcess);
  }
}

function killProcessTree(runtimeProcess: ChildProcessWithoutNullStreams): void {
  runtimeProcess.kill("SIGTERM");
}

function sleep(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}
