import { z } from "zod";

export const appBuildChannelSchema = z.enum(["development", "production"]);

export const appBuildInfoSchema = z.object({
  channel: appBuildChannelSchema,
  isPackaged: z.boolean(),
  diagnosticsEnabled: z.boolean(),
});

export const desktopDiagnosticLevelSchema = z.enum([
  "info",
  "warn",
  "error",
  "fatal",
]);

export const desktopDiagnosticSourceSchema = z.enum([
  "api",
  "desktop",
  "renderer",
  "runtime",
]);

export const desktopDiagnosticAudienceSchema = z.enum([
  "developer",
  "operator",
]);

export const desktopDiagnosticSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  level: desktopDiagnosticLevelSchema,
  source: desktopDiagnosticSourceSchema,
  audience: desktopDiagnosticAudienceSchema,
  message: z.string(),
  detail: z.string().optional(),
});

export const rawHoldingRegisterValueSchema = z.object({
  sensorId: z.number(),
  sensorName: z.string(),
  nodeId: z.number(),
  registerName: z.string(),
  registerAddress: z.number(),
  localRegisterNumber: z.number().nullable(),
  rawValue: z.number(),
});

export const rawHoldingRegisterSnapshotSchema = z.object({
  controllerId: z.number(),
  controllerName: z.string(),
  ipAddress: z.string(),
  polledAt: z.string(),
  registers: z.array(rawHoldingRegisterValueSchema),
});

export const rawHoldingRegisterSnapshotsSchema = z.array(
  rawHoldingRegisterSnapshotSchema,
);

export const runtimeHealthResponseSchema = z.object({
  status: z.literal("ready"),
  timestamp: z.string(),
});

export type AppBuildChannel = z.infer<typeof appBuildChannelSchema>;
export type AppBuildInfo = z.infer<typeof appBuildInfoSchema>;
export type DesktopDiagnosticLevel = z.infer<
  typeof desktopDiagnosticLevelSchema
>;
export type DesktopDiagnosticSource = z.infer<
  typeof desktopDiagnosticSourceSchema
>;
export type DesktopDiagnosticAudience = z.infer<
  typeof desktopDiagnosticAudienceSchema
>;
export type DesktopDiagnostic = z.infer<typeof desktopDiagnosticSchema>;
export type DesktopDiagnosticInput = Omit<
  DesktopDiagnostic,
  "id" | "timestamp"
>;
export type RawHoldingRegisterSnapshot = z.infer<
  typeof rawHoldingRegisterSnapshotSchema
>;
export type RawHoldingRegisterValue = z.infer<
  typeof rawHoldingRegisterValueSchema
>;
export type RuntimeHealthResponse = z.infer<typeof runtimeHealthResponseSchema>;
