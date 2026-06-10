import { integer, text } from "drizzle-orm/sqlite-core";
import { table } from "./base.js";

export const controllers = table("controllers", {
  name: text("name").notNull(),
  model: text("model").notNull(),
  ipAddress: text("ipAddress").notNull(),
  site: text("site"),
  port: integer("port").default(0),
  isMultihop: integer("is_multihop", { mode: "boolean" }).default(false),
  operationalStatus: text("operational_status").notNull().default("active"),
  pollingIntervalMs: integer("polling_interval_ms").notNull().default(300000),
  xmlConfig: text("xml_config"),
  xmlConfigChecksum: text("xml_config_checksum"),
  xmlLastSyncedAt: integer("xml_last_synced_at", { mode: "timestamp_ms" }),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
});
