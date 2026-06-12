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
} from "../src/types/diagnostics";

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

async function ensureRuntimeProcess() {
  if (runtimeStarted || process.env.NEXUS_DISABLE_RUNTIME_SPAWN === "1") {
    return;
  }

  const runtimeUrl =
    process.env.VITE_RUNTIME_API_URL ?? process.env.NEXUS_RUNTIME_API_URL;

  if (await isRuntimeReachable(runtimeUrl ?? "http://localhost:3000")) {
    publishDeveloperDiagnostic({
      source: "runtime",
      level: "info",
      audience: "developer",
      message: "Runtime API já está respondendo.",
      detail: runtimeUrl ?? "http://localhost:3000",
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
    NEXUS_ENABLE_RUNTIME_STOP: developerDiagnosticsEnabled() ? "1" : "0",
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
    icon: path.join(process.env.VITE_PUBLIC, "logo_nexus.svg"),
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
});

function appBuildInfo(): AppBuildInfo {
  const channel = appBuildChannel();

  return {
    channel,
    isPackaged: app.isPackaged,
    diagnosticsEnabled: channel === "development",
  };
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
