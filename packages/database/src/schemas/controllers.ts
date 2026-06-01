import { integer, text } from "drizzle-orm/sqlite-core";
import { table } from "./base.js";

export const controllers = table("controllers", {
  name: text("name").notNull(),
  model: text("model").notNull(),
  port: integer("port").notNull().default(0),
  isPerformance: integer("is_performance", { mode: "boolean" }).default(false),
  isMultihop: integer("is_multihop", { mode: "boolean" }).default(false),
  pollingIntervalMs: integer("polling_interval_ms").notNull().default(300000),
});
