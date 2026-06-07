import { Inject, Injectable } from "@nestjs/common";
import { influxWriteQueue, type Database } from "@weber-nexus/database";
import { asc, eq } from "drizzle-orm";

import { DB_TOKEN } from "../database.constants.js";

export type InfluxWriteQueueItem = typeof influxWriteQueue.$inferSelect;

@Injectable()
export class InfluxWriteQueueRepository {
  constructor(@Inject(DB_TOKEN) private readonly db: Database) {}

  async enqueue(lineProtocol: string, error: string): Promise<void> {
    await this.db
      .insert(influxWriteQueue)
      .values({
        lineProtocol,
        attemptCount: 0,
        lastError: error,
        lastAttemptAt: new Date(),
      })
      .run();
  }

  async findPending(limit = 25): Promise<InfluxWriteQueueItem[]> {
    return this.db
      .select()
      .from(influxWriteQueue)
      .orderBy(asc(influxWriteQueue.id))
      .limit(limit);
  }

  async markAttempt(id: number, attemptCount: number, error: string) {
    await this.db
      .update(influxWriteQueue)
      .set({
        attemptCount,
        lastError: error,
        lastAttemptAt: new Date(),
      })
      .where(eq(influxWriteQueue.id, id))
      .run();
  }

  async delete(id: number): Promise<void> {
    await this.db
      .delete(influxWriteQueue)
      .where(eq(influxWriteQueue.id, id))
      .run();
  }
}
