import { Provider } from "@nestjs/common";
import {
  createDatabase,
  defaultMigrationsFolder,
  getDatabase,
  runSqliteMigrations,
  type Database,
} from "@weber-nexus/database";
import path from "path";

import { DB_TOKEN } from "./database.constants.js";

export const DatabaseProvider: Provider<Database> = {
  provide: DB_TOKEN,
  useFactory: async (): Promise<Database> => {
    const dbPath =
      process.env.NEXUS_DATABASE_PATH ??
      path.join(process.cwd(), "db", "nexus.db");
    const database = createDatabase(dbPath);

    await runSqliteMigrations(database, {
      dbPath,
      migrationsFolder:
        process.env.NEXUS_DATABASE_MIGRATIONS_DIR ?? defaultMigrationsFolder(),
      backupDirectory: process.env.NEXUS_DATABASE_BACKUP_DIR,
    });

    return getDatabase();
  },
};
