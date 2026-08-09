import type { BrowserWindow as BrowserWindowType } from "electron";
import electron from "electron";
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  AppBuildChannel,
  AppBuildInfo,
  DesktopDiagnostic,
  DesktopDiagnosticInput,
} from "../src/types/diagnostics.type";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { app, BrowserWindow, ipcMain } = electron;

// Keep GPU disabled while UI is lightweight; revisit when charts/views become GPU-heavy.
app.disableHardwareAcceleration();
app.commandLine.appendSwitch("disable-gpu");

process.env.APP_ROOT = path.join(__dirname, "..");

export const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, "public")
  : RENDERER_DIST;

app.setName(appDisplayName());
if (process.platform === "win32") {
  app.setAppUserModelId(appBuildChannel() === "development" ? "com.weber.nexus.dev" : "com.weber.nexus");
}

const windows = new Set<BrowserWindowType>();
const diagnosticHistory: DesktopDiagnostic[] = [];
let runtimeStarted = false;
let ipcHandlersRegistered = false;
let diagnosticSequence = 0;

const MAX_PENDING_DIAGNOSTICS = 100;

type RuntimeProcessConfig = {
  command: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
  stdio: "ignore";
};

type UpdateStatus = {
  status:
    | "idle"
    | "checking"
    | "update_available"
    | "downloading"
    | "downloaded"
    | "ready_to_install"
    | "installing"
    | "healthy"
    | "maintenance"
    | "failed";
  current_version: string;
  available_version: string | null;
  channel: "internal" | "beta" | "stable";
  message: string;
  requires_action: boolean;
  checked_at_utc: string;
};

type UpdateInstallResult = {
  accepted: boolean;
  message: string;
};

const UPDATE_POLL_INTERVAL_MS = 60_000;
const DEFAULT_RUNTIME_API_URL = "http://127.0.0.1:4000";
let updatePollTimer: NodeJS.Timeout | undefined;
let lastUpdateStatus: UpdateStatus | undefined;
let lastNotifiedUpdateVersion: string | null = null;

function registerIpcHandlers() {
  if (ipcHandlersRegistered) {
    return;
  }

  ipcMain.handle("app:get-version", () => {
    return app.getVersion();
  });

  ipcMain.handle("app:get-build-info", () => appBuildInfo());

  ipcMain.handle("app:get-diagnostics", () => {
    return developerDiagnosticsEnabled()
      ? diagnosticHistory.filter((entry) => entry.audience === "developer")
      : diagnosticHistory.filter((entry) => entry.audience === "operator");
  });

  ipcMain.handle("updates:get-status", async () => {
    const status = await readUpdateStatus();
    publishUpdateStatus(status);
    return status;
  });

  ipcMain.handle("updates:install", async () => {
    return requestUpdateInstall();
  });

  ipcMain.on("update-window-title", (event, title) => {
    if (typeof title !== "string") return;

    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      // Truncate to 100 characters to prevent UI layout abuse
      win.setTitle(windowTitle(title));
    }
  });

  ipcHandlersRegistered = true;
}

function startUpdatePolling(): void {
  if (updatePollTimer) return;

  void readUpdateStatus().then(publishUpdateStatus);
  updatePollTimer = setInterval(() => {
    void readUpdateStatus().then(publishUpdateStatus);
  }, UPDATE_POLL_INTERVAL_MS);
  updatePollTimer.unref();
}

async function ensureRuntimeProcess() {
  if (runtimeStarted || process.env.NEXUS_DISABLE_RUNTIME_SPAWN === "1") {
    return;
  }

  const runtimeUrl =
    process.env.VITE_RUNTIME_API_URL ?? process.env.NEXUS_RUNTIME_API_URL;

  if (await isRuntimeReachable(runtimeUrl ?? DEFAULT_RUNTIME_API_URL)) {
    publishDeveloperDiagnostic({
      source: "runtime",
      level: "info",
      audience: "developer",
      message: "Runtime API já está respondendo.",
      detail: runtimeUrl ?? DEFAULT_RUNTIME_API_URL,
    });
    runtimeStarted = true;
    return;
  }

  const runtimeProcess = getRuntimeProcessConfig();

  publishDeveloperDiagnostic({
    source: "runtime",
    level: "info",
    audience: "developer",
    message: "Iniciando processo do runtime.",
    detail: `${runtimeProcess.command} ${runtimeProcess.args.join(" ")}`,
  });

  const child = spawn(runtimeProcess.command, runtimeProcess.args, {
    cwd: runtimeProcess.cwd,
    detached: true,
    env: runtimeProcess.env,
    stdio: runtimeProcess.stdio,
    windowsHide: true,
  });

  child.on("error", (error) => {
    publishDeveloperDiagnostic({
      source: "runtime",
      level: "error",
      audience: "developer",
      message: "Falha ao iniciar processo do runtime.",
      detail: diagnosticDetail(error),
    });
    publishOperatorFatal(
      "Runtime local falhou ao iniciar. Reinicie o aplicativo.",
      "runtime",
    );
  });

  child.on("exit", (code, signal) => {
    publishDeveloperDiagnostic({
      source: "runtime",
      level: code === 0 ? "info" : "error",
      audience: "developer",
      message: "Processo do runtime encerrou.",
      detail: `code=${code ?? "null"} signal=${signal ?? "null"}`,
    });

    if (code !== 0 || signal) {
      publishOperatorFatal(
        "Runtime local foi interrompido. Reinicie o aplicativo.",
        "runtime",
      );
    }
  });

  child.unref();
  runtimeStarted = true;
}

function getRuntimeProcessConfig(): RuntimeProcessConfig {
  const workspaceRoot = path.resolve(process.env.APP_ROOT, "../..");
  const resourcesPath = app.isPackaged
    ? process.resourcesPath
    : path.join(workspaceRoot, "resources");
  const baseEnv = {
    ...process.env,
    NEXUS_ENABLE_RUNTIME_STOP: "1",
    NEXUS_RESOURCES_PATH: resourcesPath,
    NEXUS_APP_INSTALL_DIR: app.isPackaged
      ? path.dirname(process.resourcesPath)
      : workspaceRoot,
  };

  if (!app.isPackaged) {
    return {
      command: process.platform === "win32" ? "yarn.cmd" : "yarn",
      args: ["workspace", "@weber-nexus/runtime", "dev"],
      cwd: workspaceRoot,
      env: baseEnv,
      stdio: "ignore",
    };
  }

  return {
    command: process.execPath,
    args: [runtimeMainPath()],
    cwd: app.getPath("userData"),
    env: {
      ...baseEnv,
      ELECTRON_RUN_AS_NODE: "1",
      NEXUS_DATABASE_MIGRATIONS_DIR: path.join(
        process.env.APP_ROOT,
        "node_modules",
        "@weber-nexus",
        "database",
        "migrations",
      ),
      NODE_ENV: "production",
    },
    stdio: "ignore",
  };
}

function runtimeMainPath(): string {
  const runtimeDistPath = path.join(
    process.env.APP_ROOT,
    "node_modules",
    "@weber-nexus",
    "runtime",
    "dist",
  );
  const bundledRuntimePath = path.join(runtimeDistPath, "main.js");
  const tscRuntimePath = path.join(runtimeDistPath, "src", "main.js");

  return fs.existsSync(bundledRuntimePath) ? bundledRuntimePath : tscRuntimePath;
}

function isRuntimeReachable(runtimeUrl: string): Promise<boolean> {
  return new Promise((resolve) => {
    const request = http.get(runtimeUrl, (response) => {
      response.resume();
      resolve(true);
    });

    request.setTimeout(1000, () => {
      request.destroy();
      resolve(false);
    });

    request.on("error", () => resolve(false));
  });
}

function createWindow() {
  registerIpcHandlers();

  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    backgroundColor: "#0d1216",
    icon: appIconPath(),
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  windows.add(mainWindow);

  mainWindow.once("ready-to-show", () => {
    if (mainWindow.isDestroyed()) {
      return;
    }

    if (process.platform !== "linux") {
      mainWindow.maximize();
    }

    mainWindow.show();
  });

  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    publishDeveloperDiagnostic({
      source: "desktop",
      level: "error",
      audience: "developer",
      message: "Processo renderer encerrou.",
      detail: diagnosticDetail(details),
    });
  });

  mainWindow.on("unresponsive", () => {
    publishDeveloperDiagnostic({
      source: "desktop",
      level: "warn",
      audience: "developer",
      message: "Janela ficou sem resposta.",
    });
  });

  mainWindow.on("closed", () => {
    windows.delete(mainWindow);
  });

  if (lastUpdateStatus) {
    mainWindow.webContents.once("did-finish-load", () => {
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send("updates:status", lastUpdateStatus);
      }
    });
  }

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL).catch((error) => {
      publishDeveloperDiagnostic({
        source: "desktop",
        level: "error",
        audience: "developer",
        message: "Falha ao carregar URL de desenvolvimento.",
        detail: diagnosticDetail(error),
      });
    });
  } else {
    mainWindow
      .loadFile(path.join(RENDERER_DIST, "index.html"))
      .catch((error) => {
        publishDeveloperDiagnostic({
          source: "desktop",
          level: "error",
          audience: "developer",
          message: "Falha ao carregar arquivo da interface.",
          detail: diagnosticDetail(error),
        });
        publishOperatorFatal(
          "Interface local falhou ao carregar. Reinicie o aplicativo.",
          "desktop",
        );
      });
  }
}

app.on("child-process-gone", (_event, details) => {
  publishDeveloperDiagnostic({
    source: "desktop",
    level: "error",
    audience: "developer",
    message: "Processo filho do Electron encerrou.",
    detail: diagnosticDetail(details),
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.whenReady().then(async () => {
  await ensureRuntimeProcess();
  createWindow();
  startUpdatePolling();
});

app.on("before-quit", () => {
  if (!updatePollTimer) return;

  clearInterval(updatePollTimer);
  updatePollTimer = undefined;
});

function appBuildInfo(): AppBuildInfo {
  const channel = appBuildChannel();

  return {
    channel,
    isPackaged: app.isPackaged,
    diagnosticsEnabled: channel === "development",
  };
}

function appDisplayName(): string {
  return appBuildChannel() === "development" ? "Nexus Dev" : "Nexus";
}

function appIconPath(): string {
  const buildIcon = path.join(process.env.APP_ROOT, "build", "icon.png");

  if (fs.existsSync(buildIcon)) {
    return buildIcon;
  }

  return path.join(process.env.VITE_PUBLIC, "logo_nexus.svg");
}

function appBuildChannel(): AppBuildChannel {
  const requested = process.env.NEXUS_BUILD_CHANNEL?.toLowerCase();

  const requestedChannel = normalizeBuildChannel(requested);
  if (requestedChannel) {
    return requestedChannel;
  }

  if (app.isPackaged) {
    return packageBuildChannel() ?? "production";
  }

  return "development";
}

function developerDiagnosticsEnabled(): boolean {
  return appBuildChannel() === "development";
}

function windowTitle(title: string): string {
  const suffix = developerDiagnosticsEnabled() ? " [DEV]" : "";
  return `${title.substring(0, 100)}${suffix}`;
}

function publishDeveloperDiagnostic(input: DesktopDiagnosticInput): void {
  if (!developerDiagnosticsEnabled()) {
    return;
  }

  publishDiagnostic(input);
}

function publishOperatorFatal(
  message: string,
  source: DesktopDiagnostic["source"],
): void {
  if (developerDiagnosticsEnabled()) {
    return;
  }

  publishDiagnostic({
    source,
    level: "fatal",
    audience: "operator",
    message,
  });
}

function publishDiagnostic(input: DesktopDiagnosticInput): void {
  const diagnostic: DesktopDiagnostic = {
    ...input,
    id: `${Date.now()}-${diagnosticSequence++}`,
    timestamp: new Date().toISOString(),
    message: sanitizeDiagnosticText(input.message),
    detail: input.detail ? sanitizeDiagnosticText(input.detail) : undefined,
  };

  diagnosticHistory.push(diagnostic);
  diagnosticHistory.splice(
    0,
    diagnosticHistory.length - MAX_PENDING_DIAGNOSTICS,
  );

  for (const win of windows) {
    if (!win.isDestroyed()) {
      win.webContents.send("app:diagnostic", diagnostic);
    }
  }
}

async function readUpdateStatus(): Promise<UpdateStatus> {
  const simulated = simulatedUpdateStatus();
  if (simulated) {
    return simulated;
  }

  const agentUrl = process.env.NEXUS_UPDATE_AGENT_URL;
  if (agentUrl) {
    try {
      const agentStatus = await fetchJson<Partial<UpdateStatus>>(
        new URL("/update/status", normalizeUrl(agentUrl)).toString(),
        process.env.NEXUS_UPDATE_AGENT_TOKEN,
      );

      return normalizeUpdateStatus(agentStatus, "Status do Agent recebido.");
    } catch {
      return {
        status: "idle",
        current_version: app.getVersion(),
        available_version: null,
        channel: configuredUpdateChannel(),
        message: "Nexus Update Agent não está disponível.",
        requires_action: false,
        checked_at_utc: new Date().toISOString(),
      };
    }
  }

  try {
    const runtimeUrl =
      process.env.VITE_RUNTIME_API_URL ??
      process.env.NEXUS_RUNTIME_API_URL ??
      DEFAULT_RUNTIME_API_URL;
    const runtimeStatus = await fetchJson<{ status?: string }>(
      new URL("/runtime/update/status", normalizeUrl(runtimeUrl)).toString(),
      process.env.NEXUS_UPDATE_AGENT_TOKEN,
    );

    return {
      status: runtimeStatus.status === "maintenance" ? "maintenance" : "idle",
      current_version: app.getVersion(),
      available_version: null,
      channel: configuredUpdateChannel(),
      message: "Nenhuma atualização disponível.",
      requires_action: false,
      checked_at_utc: new Date().toISOString(),
    };
  } catch {
    return {
      status: "idle",
      current_version: app.getVersion(),
      available_version: null,
      channel: configuredUpdateChannel(),
      message: "Nexus Update Agent não está disponível.",
      requires_action: false,
      checked_at_utc: new Date().toISOString(),
    };
  }
}

async function requestUpdateInstall(): Promise<UpdateInstallResult> {
  const agentUrl = process.env.NEXUS_UPDATE_AGENT_URL;
  if (!agentUrl) {
    return {
      accepted: false,
      message: "Nexus Update Agent não está configurado nesta instalação.",
    };
  }

  try {
    const result = await fetchJson<Partial<UpdateInstallResult>>(
      new URL("/update/install", normalizeUrl(agentUrl)).toString(),
      process.env.NEXUS_UPDATE_AGENT_TOKEN,
      { method: "POST" },
    );

    return {
      accepted: result.accepted === true,
      message:
        typeof result.message === "string"
          ? result.message
          : "Solicitação enviada ao Nexus Update Agent.",
    };
  } catch (error) {
    return {
      accepted: false,
      message:
        error instanceof Error
          ? `Falha ao solicitar atualização: ${error.message}`
          : "Falha ao solicitar atualização.",
    };
  }
}

function publishUpdateStatus(status: UpdateStatus): void {
  lastUpdateStatus = status;

  for (const win of windows) {
    if (!win.isDestroyed()) {
      win.webContents.send("updates:status", status);
    }
  }

  if (
    status.requires_action &&
    status.available_version &&
    lastNotifiedUpdateVersion !== status.available_version
  ) {
    lastNotifiedUpdateVersion = status.available_version;
    showUpdateNotification(status);
  }
}

function showUpdateNotification(status: UpdateStatus): void {
  if (!electron.Notification.isSupported()) return;

  new electron.Notification({
    title: "Atualização do Nexus disponível",
    body: status.message,
    silent: false,
  }).show();
}

async function fetchJson<TValue>(
  url: string,
  token?: string,
  init: RequestInit = {},
): Promise<TValue> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  const headers = new Headers(init.headers);

  headers.set("Accept", "application/json");

  if (token) {
    headers.set("x-nexus-agent-token", token);
  }

  try {
    const response = await fetch(url, {
      ...init,
      headers,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return (await response.json()) as TValue;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeUpdateStatus(
  input: Partial<UpdateStatus>,
  fallbackMessage: string,
): UpdateStatus {
  return {
    status: isUpdateStatus(input.status) ? input.status : "idle",
    current_version:
      typeof input.current_version === "string"
        ? input.current_version
        : app.getVersion(),
    available_version:
      typeof input.available_version === "string"
        ? input.available_version
        : null,
    channel: isUpdateChannel(input.channel)
      ? input.channel
      : configuredUpdateChannel(),
    message:
      typeof input.message === "string" ? input.message : fallbackMessage,
    requires_action: input.requires_action === true,
    checked_at_utc:
      typeof input.checked_at_utc === "string"
        ? input.checked_at_utc
        : new Date().toISOString(),
  };
}

function simulatedUpdateStatus(): UpdateStatus | undefined {
  if (process.env.NEXUS_DESKTOP_MOCK_UPDATE_AVAILABLE !== "1") {
    return undefined;
  }

  return {
    status: "update_available",
    current_version: app.getVersion(),
    available_version:
      process.env.NEXUS_DESKTOP_MOCK_UPDATE_VERSION ?? "1.0.1",
    channel: configuredUpdateChannel(),
    message: "Atualização disponível para instalação.",
    requires_action: true,
    checked_at_utc: new Date().toISOString(),
  };
}

function configuredUpdateChannel(): UpdateStatus["channel"] {
  const channel = process.env.NEXUS_RELEASE_CHANNEL;

  return isUpdateChannel(channel) ? channel : "stable";
}

function normalizeUrl(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function isUpdateStatus(value: unknown): value is UpdateStatus["status"] {
  return (
    value === "idle" ||
    value === "checking" ||
    value === "update_available" ||
    value === "downloading" ||
    value === "downloaded" ||
    value === "ready_to_install" ||
    value === "installing" ||
    value === "healthy" ||
    value === "maintenance" ||
    value === "failed"
  );
}

function isUpdateChannel(value: unknown): value is UpdateStatus["channel"] {
  return value === "internal" || value === "beta" || value === "stable";
}

function diagnosticDetail(value: unknown): string {
  if (value instanceof Error) {
    return value.stack ?? value.message;
  }

  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function sanitizeDiagnosticText(message: string): string {
  return [...message]
    .map((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127 ? " " : character;
    })
    .join("")
    .trim();
}

function packageBuildChannel(): AppBuildChannel | undefined {
  try {
    const packageJsonPath = path.join(app.getAppPath(), "package.json");
    const packageJson = JSON.parse(
      fs.readFileSync(packageJsonPath, "utf8"),
    ) as {
      nexusBuildChannel?: unknown;
    };

    return normalizeBuildChannel(packageJson.nexusBuildChannel);
  } catch {
    return undefined;
  }
}

function normalizeBuildChannel(value: unknown): AppBuildChannel | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.toLowerCase();

  if (normalized === "development" || normalized === "dev") {
    return "development";
  }

  if (normalized === "production" || normalized === "prod") {
    return "production";
  }

  return undefined;
}
