import { sql } from "drizzle-orm";
import { integer, text } from "drizzle-orm/sqlite-core";
import { table } from "./base.js";
import { controllers } from "./controllers.js";

export const sensors = table("sensors", {
  controllerId: integer("controller_id")
    .references(() => controllers.id)
    .notNull(),
  modbusId: integer("modbus_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  model: text("model"),
  location: text("location"),
  operationalStatus: text("operational_status").notNull().default("active"),
  registers: text("registers", { mode: "json" })
    .notNull()
    .$type<number[]>()
    .default(sql`'[]'`),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
});
