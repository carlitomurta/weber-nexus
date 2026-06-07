import { integer, text } from "drizzle-orm/sqlite-core";
import { table } from "./base.js";

export const influxWriteQueue = table("influx_write_queue", {
  lineProtocol: text("line_protocol").notNull(),
  attemptCount: integer("attempt_count").notNull().default(0),
  lastError: text("last_error"),
  lastAttemptAt: integer("last_attempt_at", { mode: "timestamp_ms" }),
});

export type InfluxWriteQueueItem = typeof influxWriteQueue.$inferSelect;
