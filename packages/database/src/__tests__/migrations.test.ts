import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  createDatabase,
  defaultMigrationsFolder,
  pendingMigrations,
  runSqliteMigrations,
} from "../index.js";

test("runSqliteMigrations applies migrations once and records history", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "nexus-db-"));
  const dbPath = path.join(directory, "nexus.db");
  const backupDirectory = path.join(directory, "backups");
  const migrationsFolder = defaultMigrationsFolder();
  const db = createDatabase(dbPath);

  try {
    const firstRun = await runSqliteMigrations(db, {
      dbPath,
      migrationsFolder,
      backupDirectory,
    });
    const secondRun = await runSqliteMigrations(db, {
      dbPath,
      migrationsFolder,
      backupDirectory,
    });

    assert.equal(firstRun.appliedCount > 0, true);
    assert.equal(secondRun.appliedCount, 0);
    assert.equal(secondRun.backupPath, null);
    assert.deepEqual(pendingMigrations(db, migrationsFolder), []);

    if (!firstRun.backupPath) {
      assert.fail("Primeira execução deve gerar backup SQLite.");
    }

    await stat(firstRun.backupPath);

    const migrationHistory = db.$client
      .prepare(
        "SELECT version, status FROM migration_history WHERE kind = 'sqlite' ORDER BY version",
      )
      .all() as { version: string; status: string }[];
    const versions = new Set(migrationHistory.map((entry) => entry.version));

    assert.equal(migrationHistory.length, versions.size);
    assert.equal(migrationHistory.every((entry) => entry.status === "success"), true);
  } finally {
    db.$client.close();
  }
});

test("runSqliteMigrations records failed migration with UTC timestamps", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "nexus-db-fail-"));
  const dbPath = path.join(directory, "nexus.db");
  const backupDirectory = path.join(directory, "backups");
  const migrationsFolder = path.join(directory, "migrations");
  const migrationTag = "0000_broken_update";
  const db = createDatabase(dbPath);

  await mkdir(path.join(migrationsFolder, "meta"), { recursive: true });
  await writeFile(
    path.join(migrationsFolder, `${migrationTag}.sql`),
    "CREATE TABLE broken_update (id integer;\n",
    "utf8",
  );
  await writeFile(
    path.join(migrationsFolder, "meta", "_journal.json"),
    JSON.stringify({
      version: "7",
      dialect: "sqlite",
      entries: [
        {
          idx: 0,
          version: "6",
          when: Date.UTC(2026, 7, 3, 12, 0, 0),
          tag: migrationTag,
          breakpoints: true,
        },
      ],
    }),
    "utf8",
  );

  try {
    await assert.rejects(
      runSqliteMigrations(db, {
        dbPath,
        migrationsFolder,
        backupDirectory,
      }),
    );

    const migrationHistory = db.$client
      .prepare(
        "SELECT version, status, started_at_utc, finished_at_utc, error_message FROM migration_history WHERE kind = 'sqlite'",
      )
      .get() as
      | {
          version: string;
          status: string;
          started_at_utc: string;
          finished_at_utc: string;
          error_message: string;
        }
      | undefined;

    assert.equal(migrationHistory?.version, migrationTag);
    assert.equal(migrationHistory?.status, "failed");
    assert.equal(migrationHistory?.started_at_utc.endsWith("Z"), true);
    assert.equal(migrationHistory?.finished_at_utc.endsWith("Z"), true);
    assert.equal(Number.isNaN(Date.parse(migrationHistory?.started_at_utc ?? "")), false);
    assert.equal(Number.isNaN(Date.parse(migrationHistory?.finished_at_utc ?? "")), false);
    assert.equal(Boolean(migrationHistory?.error_message), true);
  } finally {
    db.$client.close();
  }
});
