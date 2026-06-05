import { z } from "zod";

const sensorSchema = z.object({
  id: z.number(),
  controllerId: z.number(),
  modbusId: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  model: z.string().nullable(),
  location: z.string().nullable(),
  registers: z.array(z.number()),
  createdAt: z.date().nullish(),
  updatedAt: z.date().nullish(),
});

export type Sensor = z.infer<typeof sensorSchema>;
export type SensorWrite = Omit<Sensor, "createdAt" | "updatedAt">;
export type CreateSensorInput = Omit<SensorWrite, "id">;
