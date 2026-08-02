import { Provider } from "@nestjs/common";
import {
  createDatabase,
  getDatabase,
  type Database,
} from "@weber-nexus/database";
import path from "path";

import { DB_TOKEN } from "./database.constants.js";

export const DatabaseProvider: Provider<Database> = {
  provide: DB_TOKEN,
  useFactory: (): Database => {
    createDatabase(
      process.env.NEXUS_DATABASE_PATH ??
        path.join(process.cwd(), "db", "nexus.db"),
    );
    return getDatabase();
  },
};
