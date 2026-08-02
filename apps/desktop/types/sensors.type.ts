import { z } from "zod";

export const sensorRegisterSchema = z.object({
  name: z.string(),
  address: z.number(),
  localRegisterNumber: z.number().optional(),
  scaleType: z.enum(["multiply", "divide"]).optional(),
  scaleFactor: z.number().optional(),
  unit: z.string(),
  isHealthCheck: z.boolean().optional(),
});

export const sensorSchema = z.object({
  id: z.number(),
  controllerId: z.number(),
  nodeId: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  model: z.string().nullable(),
  location: z.string().nullable(),
  registers: z.array(sensorRegisterSchema),
  createdAt: z.coerce.date().nullish(),
  updatedAt: z.coerce.date().nullish(),
});

export const sensorsSchema = z.array(sensorSchema);

export type SensorRegister = z.infer<typeof sensorRegisterSchema>;
export type Sensor = z.infer<typeof sensorSchema>;
export type SensorWrite = Omit<Sensor, "createdAt" | "updatedAt">;
export type CreateSensorInput = Omit<SensorWrite, "id">;
