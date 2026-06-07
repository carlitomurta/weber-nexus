import { Inject, Injectable } from "@nestjs/common";
import { influxConfigs, type Database } from "@weber-nexus/database";
import { desc } from "drizzle-orm";

import { DB_TOKEN } from "../database.constants.js";

export type InfluxConfig = typeof influxConfigs.$inferSelect;

@Injectable()
export class InfluxConfigsRepository {
  constructor(@Inject(DB_TOKEN) private readonly db: Database) {}

  async findActive(): Promise<InfluxConfig | undefined> {
    const [config] = await this.db
      .select()
      .from(influxConfigs)
      .orderBy(desc(influxConfigs.id))
      .limit(1);

    return config;
  }
}
