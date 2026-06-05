import { z } from "zod";

export const controllerSchema = z.object({
  id: z.number(),
  name: z.string(),
  model: z.string(),
  port: z.number().nullable(),
  ipAddress: z.string(),
  site: z.string(),
  isMultihop: z.boolean().nullish(),
  pollingIntervalMs: z.number(),
  createdAt: z.date().nullish(),
  updatedAt: z.date().nullish(),
});

export const controllersSchema = z.array(controllerSchema);

export const createControllerRequestSchema = controllerSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Controller = z.infer<typeof controllerSchema>;
export type ControllerWrite = Omit<Controller, "createdAt" | "updatedAt">;
export type CreateControllerInput = Omit<ControllerWrite, "id">;
