import { integer, text } from "drizzle-orm/sqlite-core";
import { table } from "./base.js";

export const controllers = table("controllers", {
  name: text("name").notNull(),
  model: text("model").notNull(),
  ipAddress: text("ipAddress").notNull(),
  site: text("site"),
  port: integer("port").default(0),
  isMultihop: integer("is_multihop", { mode: "boolean" }).default(false),
  pollingIntervalMs: integer("polling_interval_ms").notNull().default(300000),
});
