import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { Database } from "./client.js";

export type SqliteMigrationRunOptions = {
  dbPath: string;
  migrationsFolder: string;
  backupDirectory?: string;
  backupBeforeMigrate?: boolean;
};

export type SqliteMigrationRunResult = {
  appliedCount: number;
  pendingVersions: string[];
  backupPath: string | null;
  startedAtUtc: string;
  finishedAtUtc: string;
};

type JournalEntry = {
  idx: number;
  when: number;
  tag: string;
};

const DRIZZLE_MIGRATIONS_TABLE = "__drizzle_migrations";

export async function runSqliteMigrations(
  db: Database,
  options: SqliteMigrationRunOptions,
): Promise<SqliteMigrationRunResult> {
  const startedAtUtc = new Date().toISOString();
  ensureMigrationHistoryTable(db);

  const pending = pendingMigrations(db, options.migrationsFolder);
  let backupPath: string | null = null;

  if (pending.length > 0 && options.backupBeforeMigrate !== false) {
    backupPath = await backupSqliteDatabase(db, options);
  }

  try {
    migrate(db, {
      migrationsFolder: options.migrationsFolder,
    });
    recordSuccessfulMigrations(db, options.migrationsFolder);
  } catch (error) {
    recordFailedMigration(db, pending.at(0)?.tag ?? "unknown", error);
    throw error;
  }

  return {
    appliedCount: pending.length,
    pendingVersions: pending.map((entry) => entry.tag),
    backupPath,
    startedAtUtc,
    finishedAtUtc: new Date().toISOString(),
  };
}

export function pendingMigrations(
  db: Database,
  migrationsFolder: string,
): JournalEntry[] {
  const journal = migrationJournal(migrationsFolder);
  const lastApplied = lastAppliedDrizzleMigration(db);

  return journal.entries.filter((entry) => entry.when > lastApplied);
}

async function backupSqliteDatabase(
  db: Database,
  options: SqliteMigrationRunOptions,
): Promise<string> {
  const backupDirectory =
    options.backupDirectory ?? path.join(path.dirname(options.dbPath), "backups");
  const backupPath = path.join(
    backupDirectory,
    `${path.basename(options.dbPath)}.${new Date()
      .toISOString()
      .replace(/[:.]/g, "-")}.backup`,
  );

  await mkdir(backupDirectory, { recursive: true });
  await db.$client.backup(backupPath);

  return backupPath;
}

function ensureMigrationHistoryTable(db: Database): void {
  db.$client
    .prepare(
      `CREATE TABLE IF NOT EXISTS migration_history (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        kind text NOT NULL,
        version text NOT NULL,
        status text NOT NULL,
        started_at_utc text NOT NULL,
        finished_at_utc text,
        checksum text,
        error_message text,
        created_at integer DEFAULT (unixepoch() * 1000),
        updated_at integer DEFAULT (unixepoch() * 1000)
      )`,
    )
    .run();
  db.$client
    .prepare(
      "CREATE UNIQUE INDEX IF NOT EXISTS migration_history_kind_version_idx ON migration_history (kind, version)",
    )
    .run();
}

function recordSuccessfulMigrations(
  db: Database,
  migrationsFolder: string,
): void {
  const now = new Date().toISOString();
  const migrations = readMigrationFiles({ migrationsFolder });
  const journal = migrationJournal(migrationsFolder);
  const migrationByMillis = new Map(
    migrations.map((migration) => [migration.folderMillis, migration]),
  );
  const statement = db.$client.prepare(
    `INSERT INTO migration_history
      (kind, version, status, started_at_utc, finished_at_utc, checksum, error_message)
      VALUES ('sqlite', @version, 'success', @startedAtUtc, @finishedAtUtc, @checksum, NULL)
      ON CONFLICT(kind, version) DO UPDATE SET
        status = excluded.status,
        finished_at_utc = excluded.finished_at_utc,
        checksum = excluded.checksum,
        error_message = NULL,
        updated_at = unixepoch() * 1000
      WHERE migration_history.status != excluded.status
        OR migration_history.checksum IS NOT excluded.checksum
        OR migration_history.error_message IS NOT NULL`,
  );

  for (const entry of journal.entries) {
    const migration = migrationByMillis.get(entry.when);
    statement.run({
      version: entry.tag,
      startedAtUtc: new Date(entry.when).toISOString(),
      finishedAtUtc: now,
      checksum: migration?.hash ?? null,
    });
  }
}

function recordFailedMigration(
  db: Database,
  version: string,
  error: unknown,
): void {
  const now = new Date().toISOString();

  db.$client
    .prepare(
      `INSERT INTO migration_history
        (kind, version, status, started_at_utc, finished_at_utc, checksum, error_message)
        VALUES ('sqlite', @version, 'failed', @startedAtUtc, @finishedAtUtc, NULL, @errorMessage)
        ON CONFLICT(kind, version) DO UPDATE SET
          status = excluded.status,
          finished_at_utc = excluded.finished_at_utc,
          error_message = excluded.error_message,
          updated_at = unixepoch() * 1000`,
    )
    .run({
      version,
      startedAtUtc: now,
      finishedAtUtc: now,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
}

function lastAppliedDrizzleMigration(db: Database): number {
  const tableExists = db.$client
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
    )
    .get(DRIZZLE_MIGRATIONS_TABLE);

  if (!tableExists) return 0;

  const row = db.$client
    .prepare(
      `SELECT created_at AS createdAt
       FROM ${DRIZZLE_MIGRATIONS_TABLE}
       ORDER BY created_at DESC
       LIMIT 1`,
    )
    .get() as { createdAt: number | string | null } | undefined;

  return Number(row?.createdAt ?? 0);
}

function migrationJournal(migrationsFolder: string): { entries: JournalEntry[] } {
  const journal = dbSafeReadJson(
    path.join(migrationsFolder, "meta", "_journal.json"),
  ) as { entries?: JournalEntry[] };

  if (!Array.isArray(journal.entries)) {
    throw new Error("Journal de migrations SQLite inválido.");
  }

  return {
    entries: journal.entries,
  };
}

function dbSafeReadJson(filePath: string): unknown {
  return JSON.parse(dbSafeReadFile(filePath));
}

function dbSafeReadFile(filePath: string): string {
  return readFileSync(filePath, "utf8");
}
