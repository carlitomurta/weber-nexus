import { app, BrowserWindow, ipcMain } from "electron";
import { spawn } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

let win: BrowserWindow | null;
let runtimeStarted = false;
let ipcHandlersRegistered = false;

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

  const workspaceRoot = path.resolve(process.env.APP_ROOT, "../..");
  const command = process.platform === "win32" ? "yarn.cmd" : "yarn";
  const stdio = VITE_DEV_SERVER_URL ? "inherit" : "ignore";

  console.info("[Nexus Runtime] Starting background runtime process...");

  const child = spawn(command, ["workspace", "@weber-nexus/runtime", "dev"], {
    cwd: workspaceRoot,
    detached: true,
    env: {
      ...process.env,
      NEXUS_RESOURCES_PATH: app.isPackaged
        ? process.resourcesPath
        : path.join(workspaceRoot, "resources"),
    },
    stdio,
    windowsHide: true,
  });

  child.on("error", (error) => {
    console.error("[Nexus Runtime] Failed to start runtime process", error);
  });

  child.unref();
  runtimeStarted = true;
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
    backgroundColor: "#15191f",
    icon: path.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
    },
  });
  win = mainWindow;

  mainWindow.once("ready-to-show", () => {
    if (mainWindow.isDestroyed()) {
      return;
    }

    mainWindow.maximize();
    mainWindow.show();
  });

  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    console.error("[Nexus Desktop] Renderer process exited", details);
  });

  mainWindow.on("unresponsive", () => {
    console.error("[Nexus Desktop] Window became unresponsive.");
  });

  mainWindow.on("closed", () => {
    if (win === mainWindow) {
      win = null;
    }
  });

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
  } else {
    // win.loadFile('dist/index.html')
    mainWindow.loadFile(path.join(RENDERER_DIST, "index.html"));
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
    win = null;
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
