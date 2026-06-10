import SqliteDatabase, {
  type Database as SqliteDatabaseClient,
} from "better-sqlite3";
import {
  drizzle,
  type BetterSQLite3Database,
} from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as schema from "./schemas/index.js";

export type Database = BetterSQLite3Database<typeof schema> & {
  $client: SqliteDatabaseClient;
};

let database: Database | undefined;

export function createDatabase(dbPath: string): Database {
  const dir = path.dirname(dbPath);

  fs.mkdirSync(dir, { recursive: true });

  const sqlite = new SqliteDatabase(dbPath);

  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  database = drizzle(sqlite, { schema });
  migrate(database, {
    migrationsFolder: path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "..",
      "migrations",
    ),
  });

  return database;
}

export function getDatabase(): Database {
  if (!database) {
    throw new Error("Banco de dados não inicializado");
  }

  return database;
}
