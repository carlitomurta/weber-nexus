import { sql } from "drizzle-orm";
import {
  integer,
  sqliteTable,
  type SQLiteColumnBuilderBase,
} from "drizzle-orm/sqlite-core";

export const id = {
  id: integer("id").primaryKey({ autoIncrement: true }),
};

export const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp_ms" }).default(
    sql`(unixepoch() * 1000)`,
  ),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).default(
    sql`(unixepoch() * 1000)`,
  ),
};

export const table = <
  TName extends string,
  TColumns extends Record<string, SQLiteColumnBuilderBase>,
>(
  name: TName,
  params: TColumns,
) =>
  sqliteTable(name, {
    ...id,
    ...params,
    ...timestamps,
  });
