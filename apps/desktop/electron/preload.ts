import electron from "electron";
import type { IpcRendererEvent } from "electron";
import type { AppBuildInfo, DesktopDiagnostic } from "../src/types/diagnostics";

const { contextBridge, ipcRenderer } = electron;

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld("electron", {
  ipc: {
    on(...args: Parameters<typeof ipcRenderer.on>) {
      const [channel, listener] = args;
      return ipcRenderer.on(channel, (event, ...args) =>
        listener(event, ...args),
      );
    },
    off(...args: Parameters<typeof ipcRenderer.off>) {
      const [channel, ...omit] = args;
      return ipcRenderer.off(channel, ...omit);
    },
    send(...args: Parameters<typeof ipcRenderer.send>) {
      const [channel, ...omit] = args;
      return ipcRenderer.send(channel, ...omit);
    },
    invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
      const [channel, ...omit] = args;
      return ipcRenderer.invoke(channel, ...omit);
    },
  },

  app: {
    getVersion: () => ipcRenderer.invoke("app:get-version"),
    getBuildInfo: (): Promise<AppBuildInfo> =>
      ipcRenderer.invoke("app:get-build-info"),
    updateTitle: (title: string) =>
      ipcRenderer.send("update-window-title", title),
  },

  diagnostics: {
    getRecent: (): Promise<DesktopDiagnostic[]> =>
      ipcRenderer.invoke("app:get-diagnostics"),
    onDiagnostic: (callback: (diagnostic: DesktopDiagnostic) => void) => {
      const handler = (_event: IpcRendererEvent, diagnostic: unknown) => {
        callback(diagnostic as DesktopDiagnostic);
      };

      ipcRenderer.on("app:diagnostic", handler);

      return () => {
        ipcRenderer.off("app:diagnostic", handler);
      };
    },
  },
});
