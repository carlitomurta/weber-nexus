export type AppBuildChannel = "development" | "production";

export type AppBuildInfo = {
  channel: AppBuildChannel;
  isPackaged: boolean;
  diagnosticsEnabled: boolean;
};

export type DesktopDiagnosticLevel = "info" | "warn" | "error" | "fatal";

export type DesktopDiagnosticSource =
  | "api"
  | "desktop"
  | "renderer"
  | "runtime";

export type DesktopDiagnosticAudience = "developer" | "operator";

export type DesktopDiagnostic = {
  id: string;
  timestamp: string;
  level: DesktopDiagnosticLevel;
  source: DesktopDiagnosticSource;
  audience: DesktopDiagnosticAudience;
  message: string;
  detail?: string;
};

export type DesktopDiagnosticInput = Omit<
  DesktopDiagnostic,
  "id" | "timestamp"
>;

export type RawHoldingRegisterSnapshot = {
  controllerId: number;
  controllerName: string;
  ipAddress: string;
  polledAt: string;
  registers: RawHoldingRegisterValue[];
};

export type RawHoldingRegisterValue = {
  sensorId: number;
  sensorName: string;
  nodeId: number;
  registerName: string;
  registerAddress: number;
  localRegisterNumber: number | null;
  rawValue: number;
};
