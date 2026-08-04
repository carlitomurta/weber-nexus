import type {
  AppBuildInfo,
  DesktopDiagnostic,
} from "../src/types/diagnostics.type";
import type {
  UpdateInstallResult,
  UpdateStatus,
} from "../src/types/update.type";

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

  updates: {
    getStatus(): Promise<UpdateStatus>;
    install(): Promise<UpdateInstallResult>;
    onStatus(callback: (status: UpdateStatus) => void): () => void;
  };
};
