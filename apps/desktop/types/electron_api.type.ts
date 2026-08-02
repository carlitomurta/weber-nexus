import type {
  AppBuildInfo,
  DesktopDiagnostic,
} from "../src/types/diagnostics.type";

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
};
