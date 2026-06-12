import { sql } from "drizzle-orm";
import { integer, text } from "drizzle-orm/sqlite-core";
import { table } from "./base.js";
import { controllers } from "./controllers.js";

export type SensorRegister = {
  name: string;
  address: number;
  localRegisterNumber?: number;
  scaleType?: "multiply" | "divide";
  scaleFactor?: number;
  unit: string;
  isHealthCheck?: boolean;
};

export const sensors = table("sensors", {
  controllerId: integer("controller_id")
    .references(() => controllers.id)
    .notNull(),
  nodeId: integer("node_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  model: text("model"),
  location: text("location"),
  operationalStatus: text("operational_status").notNull().default("active"),
  registers: text("registers", { mode: "json" })
    .notNull()
    .$type<SensorRegister[]>()
    .default(sql`'[]'`),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
});
