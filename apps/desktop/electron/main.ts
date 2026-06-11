import type { BrowserWindow as BrowserWindowType } from "electron";
import electron from "electron";
import { spawn } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
let runtimeStarted = false;
let ipcHandlersRegistered = false;

type RuntimeProcessConfig = {
  command: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
  stdio: "ignore" | "inherit";
};

function registerIpcHandlers() {
  if (ipcHandlersRegistered) {
    return;
  }

  ipcMain.handle("app:get-version", () => {
    return app.getVersion();
  });

  ipcMain.on("update-window-title", (event, title) => {
    if (typeof title !== "string") return;

    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      // Truncate to 100 characters to prevent UI layout abuse
      win.setTitle(title.substring(0, 100));
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
    console.info("[Nexus Runtime] Runtime API is already reachable.");
    runtimeStarted = true;
    return;
  }

  const runtimeProcess = getRuntimeProcessConfig();

  console.info("[Nexus Runtime] Starting background runtime process...");

  const child = spawn(runtimeProcess.command, runtimeProcess.args, {
    cwd: runtimeProcess.cwd,
    detached: true,
    env: runtimeProcess.env,
    stdio: runtimeProcess.stdio,
    windowsHide: true,
  });

  child.on("error", (error) => {
    console.error("[Nexus Runtime] Failed to start runtime process", error);
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
      stdio: VITE_DEV_SERVER_URL ? "inherit" : "ignore",
    };
  }

  return {
    command: process.execPath,
    args: [
      path.join(
        process.env.APP_ROOT,
        "node_modules",
        "@weber-nexus",
        "runtime",
        "dist",
        "src",
        "main.js",
      ),
    ],
    cwd: app.getPath("userData"),
    env: {
      ...baseEnv,
      ELECTRON_RUN_AS_NODE: "1",
      NODE_ENV: "production",
    },
    stdio: "ignore",
  };
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
    console.error("[Nexus Desktop] Renderer process exited", details);
  });

  mainWindow.on("unresponsive", () => {
    console.error("[Nexus Desktop] Window became unresponsive.");
  });

  mainWindow.on("closed", () => {
    windows.delete(mainWindow);
  });

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL).catch((error) => {
      console.error("[Nexus Desktop] Failed to load dev URL.", error);
    });
  } else {
    mainWindow
      .loadFile(path.join(RENDERER_DIST, "index.html"))
      .catch((error) => {
        console.error("[Nexus Desktop] Failed to load index file.", error);
      });
  }
}

app.on("child-process-gone", (_event, details) => {
  console.error("[Nexus Desktop] Child process exited", details);
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
