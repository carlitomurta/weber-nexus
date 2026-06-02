import { text } from "drizzle-orm/sqlite-core";
import { table } from "./base.js";

export const influxConfigs = table("influx_configs", {
  host: text("host").notNull(),
  bucket: text("bucket").notNull(),
  token: text("token").notNull(),
  org: text("org").notNull(),
});

export type InfluxConfig = typeof influxConfigs.$inferSelect;
