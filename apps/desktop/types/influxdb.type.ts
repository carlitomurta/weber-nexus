import { z } from "zod";

export const influxSensorReadingSchema = z.object({
  time: z.string(),
  controller_id: z.string(),
  sensor_id: z.string(),
  node_id: z.string(),
  register_address: z.string(),
  register_kind: z.enum(["metric", "health"]),
  raw_value: z.number(),
  scaled_value: z.number().nullable().optional(),
  unit: z.string().nullable().optional(),
  health_state_code: z.number().nullable().optional(),
  online: z.boolean().nullable().optional(),
  status_text: z.enum(["ONLINE", "OFFLINE", "UNKNOWN"]).nullable().optional(),
  controller_name: z.string(),
  sensor_name: z.string(),
  register_name: z.string(),
});

export type InfluxSensorReading = z.infer<typeof influxSensorReadingSchema>;
