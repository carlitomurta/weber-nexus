import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, stat } from "node:fs/promises";
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
