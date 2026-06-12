import electron from "electron";
import type { IpcRendererEvent } from "electron";
import type { AppBuildInfo, DesktopDiagnostic } from "../src/types/diagnostics";

const { contextBridge, ipcRenderer } = electron;

contextBridge.exposeInMainWorld("electron", {
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
