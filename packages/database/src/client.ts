import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import path from "path";
import * as schemas from "./schemas";

type DB = ReturnType<typeof drizzle>;

let database: DB;

export function createDatabase(databasePath?: string): DB {
  const sqlite = new Database(
    databasePath ?? path.join(process.cwd(), "db", "nexus.db"),
  );

  sqlite.pragma("journal_mode = WAL");

  database = drizzle(sqlite, {
    schema: schemas,
  });

  return database;
}

export function getDatabase(): DB {
  if (!database) {
    throw new Error("Database not initialized");
  }

  return database;
}

export type Database = typeof database;
