import { integer, text } from "drizzle-orm/sqlite-core";
import { table } from "./base.js";

export const updateHistory = table("update_history", {
  fromVersion: text("from_version").notNull(),
  toVersion: text("to_version").notNull(),
  channel: text("channel").notNull(),
  status: text("status").notNull(),
  startedAtUtc: text("started_at_utc").notNull(),
  finishedAtUtc: text("finished_at_utc"),
  manifestSha256: text("manifest_sha256"),
  artifactSha256: text("artifact_sha256"),
  errorMessage: text("error_message"),
});

export const migrationHistory = table("migration_history", {
  kind: text("kind").notNull(),
  version: text("version").notNull(),
  status: text("status").notNull(),
  startedAtUtc: text("started_at_utc").notNull(),
  finishedAtUtc: text("finished_at_utc"),
  checksum: text("checksum"),
  errorMessage: text("error_message"),
});

export type UpdateHistory = typeof updateHistory.$inferSelect;
export type MigrationHistory = typeof migrationHistory.$inferSelect;
