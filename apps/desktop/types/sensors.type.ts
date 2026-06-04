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
});

export type Sensor = z.infer<typeof sensorSchema>;
