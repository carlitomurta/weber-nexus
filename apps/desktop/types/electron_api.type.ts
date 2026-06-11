import type {
  AppBuildInfo,
  DesktopDiagnostic,
} from "../src/types/diagnostics";

export type ElectronApi = {
  app: {
    getVersion(): Promise<string>;
    getBuildInfo(): Promise<AppBuildInfo>;
    updateTitle(title: string): void;
  };

  diagnostics: {
    getRecent(): Promise<DesktopDiagnostic[]>;
    onDiagnostic(callback: (diagnostic: DesktopDiagnostic) => void): () => void;
  };

  ipc: {
    send(channel: string, data?: unknown): void;

    on(channel: string, callback: (...args: unknown[]) => void): void;

    off(channel: string, callback: (...args: unknown[]) => void): void;

    invoke(channel: string, data?: unknown): Promise<unknown>;
  };
};
