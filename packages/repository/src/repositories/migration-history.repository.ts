import { Inject, Injectable } from "@nestjs/common";
import { migrationHistory, type Database } from "@weber-nexus/database";
import { and, eq } from "drizzle-orm";

import { DB_TOKEN } from "../database.constants.js";

export type MigrationHistoryRecord = typeof migrationHistory.$inferSelect;
export type MigrationHistoryStatus = "success" | "failed";

@Injectable()
export class MigrationHistoryRepository {
  constructor(@Inject(DB_TOKEN) private readonly db: Database) {}

  async findByKindAndVersion(
    kind: string,
    version: string,
  ): Promise<MigrationHistoryRecord | undefined> {
    const [record] = await this.db
      .select()
      .from(migrationHistory)
      .where(
        and(
          eq(migrationHistory.kind, kind),
          eq(migrationHistory.version, version),
        ),
      )
      .limit(1);

    return record;
  }

  async recordResult(input: {
    kind: string;
    version: string;
    status: MigrationHistoryStatus;
    startedAtUtc: string;
    finishedAtUtc: string;
    checksum?: string | null;
    errorMessage?: string | null;
  }): Promise<void> {
    await this.db
      .insert(migrationHistory)
      .values({
        kind: input.kind,
        version: input.version,
        status: input.status,
        startedAtUtc: input.startedAtUtc,
        finishedAtUtc: input.finishedAtUtc,
        checksum: input.checksum ?? null,
        errorMessage: input.errorMessage ?? null,
      })
      .onConflictDoUpdate({
        target: [migrationHistory.kind, migrationHistory.version],
        set: {
          status: input.status,
          finishedAtUtc: input.finishedAtUtc,
          checksum: input.checksum ?? null,
          errorMessage: input.errorMessage ?? null,
          updatedAt: new Date(),
        },
      })
      .run();
  }
}
