import { sql } from "drizzle-orm";
import { integer, sqliteTable } from "drizzle-orm/sqlite-core";

export const id = {
  id: integer("id").primaryKey({ autoIncrement: true }),
};

export const timestamps = {
  createdAt: integer("created_at", {
    mode: "timestamp_ms",
  }).default(sql`(CURRENT_TIMESTAMP)`),

  updatedAt: integer("updated_at", {
    mode: "timestamp_ms",
  }).default(sql`(CURRENT_TIMESTAMP)`),
};

export const table = (name: string, params: any) =>
  sqliteTable(name, {
    ...id,
    ...params,
    ...timestamps,
  });
