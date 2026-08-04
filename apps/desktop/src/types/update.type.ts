import { z } from "zod";

export const updateStatusSchema = z.object({
  status: z.enum([
    "idle",
    "checking",
    "update_available",
    "downloading",
    "downloaded",
    "ready_to_install",
    "installing",
    "healthy",
    "maintenance",
    "failed",
  ]),
  current_version: z.string(),
  available_version: z.string().nullable(),
  channel: z.enum(["internal", "beta", "stable"]),
  message: z.string(),
  requires_action: z.boolean(),
  checked_at_utc: z.string(),
});

export const updateInstallResultSchema = z.object({
  accepted: z.boolean(),
  message: z.string(),
});

export type UpdateStatus = z.infer<typeof updateStatusSchema>;
export type UpdateInstallResult = z.infer<typeof updateInstallResultSchema>;
