import { Inject, Injectable } from "@nestjs/common";
import { sensors, type Database } from "@weber-nexus/database";
import { eq } from "drizzle-orm";

import { DB_TOKEN } from "../database.constants.js";

export type Sensor = typeof sensors.$inferSelect;
export type SensorWrite = Omit<Sensor, "createdAt" | "updatedAt">;
export type NewSensor = Omit<SensorWrite, "id">;

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

  async findByControllerId(controllerId: number): Promise<Sensor[]> {
    return this.db
      .select()
      .from(sensors)
      .where(eq(sensors.controllerId, controllerId));
  }

  async insertSensor(sensor: NewSensor): Promise<Sensor> {
    const [newSensor] = await this.db
      .insert(sensors)
      .values(sensor)
      .returning();
    return newSensor;
  }

  async updateSensor(sensor: SensorWrite): Promise<Sensor> {
    const { id, ...sensorData } = sensor;
    const [updatedSensor] = await this.db
      .update(sensors)
      .set(sensorData)
      .where(eq(sensors.id, id))
      .returning();
    return updatedSensor;
  }

  async deleteSensor(sensorId: number) {
    await this.db.delete(sensors).where(eq(sensors.id, sensorId)).run();
  }

  async deleteByControllerId(controllerId: number) {
    await this.db
      .delete(sensors)
      .where(eq(sensors.controllerId, controllerId))
      .run();
  }
}
