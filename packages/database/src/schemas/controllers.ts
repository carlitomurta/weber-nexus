import { integer, text } from "drizzle-orm/sqlite-core";
import { table } from "./base";

export const controllers = table("controllers", {
  name: text("name").notNull(),

  model: text("model").notNull(),
  port: integer("port").notNull().default(0),

  isPerformance: integer("isPerformance", { mode: "boolean" }),
  isMultihop: integer("isMultihop", { mode: "boolean" }),

  pollingIntervalMs: integer("polling_interval_ms").notNull().default(300000),
});
