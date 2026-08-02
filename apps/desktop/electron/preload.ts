import electron from "electron";
import type { IpcRendererEvent } from "electron";
import {
  appBuildInfoSchema,
  desktopDiagnosticSchema,
  type AppBuildInfo,
  type DesktopDiagnostic,
} from "../src/types/diagnostics.type";

const { contextBridge, ipcRenderer } = electron;

contextBridge.exposeInMainWorld("electron", {
  app: {
    getVersion: async () => String(await ipcRenderer.invoke("app:get-version")),
    getBuildInfo: async (): Promise<AppBuildInfo> =>
      appBuildInfoSchema.parse(await ipcRenderer.invoke("app:get-build-info")),
    updateTitle: (title: string) =>
      ipcRenderer.send("update-window-title", title),
  },

  diagnostics: {
    getRecent: async (): Promise<DesktopDiagnostic[]> =>
      desktopDiagnosticSchema
        .array()
        .parse(await ipcRenderer.invoke("app:get-diagnostics")),
    onDiagnostic: (callback: (diagnostic: DesktopDiagnostic) => void) => {
      const handler = (_event: IpcRendererEvent, diagnostic: unknown) => {
        const parsedDiagnostic = desktopDiagnosticSchema.safeParse(diagnostic);

        if (parsedDiagnostic.success) {
          callback(parsedDiagnostic.data);
        }
      };

      ipcRenderer.on("app:diagnostic", handler);

      return () => {
        ipcRenderer.off("app:diagnostic", handler);
      };
    },
  },
});
