import { z } from "zod";

export const sensorRegisterSchema = z.object({
  name: z.string(),
  address: z.number(),
  scaleType: z.enum(["multiply", "divide"]),
  scaleFactor: z.number(),
  unit: z.string(),
});

const sensorSchema = z.object({
  id: z.number(),
  controllerId: z.number(),
  nodeId: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  model: z.string().nullable(),
  location: z.string().nullable(),
  registers: z.array(sensorRegisterSchema),
  createdAt: z.date().nullish(),
  updatedAt: z.date().nullish(),
});

export type SensorRegister = z.infer<typeof sensorRegisterSchema>;
export type Sensor = z.infer<typeof sensorSchema>;
export type SensorWrite = Omit<Sensor, "createdAt" | "updatedAt">;
export type CreateSensorInput = Omit<SensorWrite, "id">;
