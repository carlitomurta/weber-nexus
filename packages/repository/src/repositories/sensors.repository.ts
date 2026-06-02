import { Inject, Injectable } from "@nestjs/common";
import { sensors, type Database } from "@weber-nexus/database";
import { eq } from "drizzle-orm";

import { DB_TOKEN } from "../database.constants.js";

export type Sensor = typeof sensors.$inferSelect;

@Injectable()
export class SensorsRepository {
  constructor(@Inject(DB_TOKEN) private readonly db: Database) {}

  async findAll() {
    return this.db.select().from(sensors);
  }

  async findById(id: number) {
    const [controller] = await this.db
      .select()
      .from(sensors)
      .where(eq(sensors.id, id));

    return controller;
  }
}
