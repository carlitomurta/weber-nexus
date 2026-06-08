import { Inject, Injectable } from "@nestjs/common";
import { influxConfigs, type Database } from "@weber-nexus/database";
import { desc, eq } from "drizzle-orm";

import { DB_TOKEN } from "../database.constants.js";

export type InfluxConfig = typeof influxConfigs.$inferSelect;
export type NewInfluxConfig = typeof influxConfigs.$inferInsert;

export const DEFAULT_INFLUXDB_AUTH_TOKEN =
  "apiv3_YWRtaW4tZGV2LXRva2VuLTEyMzQ1Ng==";

const defaultInfluxConfig: NewInfluxConfig = {
  host: process.env.NEXUS_INFLUXDB_URL ?? "http://127.0.0.1:8181",
  bucket: process.env.NEXUS_INFLUXDB_BUCKET ?? "nexus",
  token: process.env.NEXUS_INFLUXDB_TOKEN ?? DEFAULT_INFLUXDB_AUTH_TOKEN,
  org: process.env.NEXUS_INFLUXDB_ORG ?? "admin",
};

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

  async ensureDefault(): Promise<InfluxConfig> {
    const activeConfig = await this.findActive();
    if (activeConfig) {
      if (activeConfig.token === "admin") {
        return this.updateLegacyDefaultToken(activeConfig);
      }

      return activeConfig;
    }

    const [config] = await this.db
      .insert(influxConfigs)
      .values(defaultInfluxConfig)
      .returning();

    return config;
  }

  private async updateLegacyDefaultToken(
    config: InfluxConfig,
  ): Promise<InfluxConfig> {
    const [updatedConfig] = await this.db
      .update(influxConfigs)
      .set({
        token: defaultInfluxConfig.token,
        updatedAt: new Date(),
      })
      .where(eq(influxConfigs.id, config.id))
      .returning();

    return updatedConfig;
  }
}
