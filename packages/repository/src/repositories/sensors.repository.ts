import { Inject, Injectable } from "@nestjs/common";
import { controllers, sensors, type Database } from "@weber-nexus/database";
import { and, eq, isNull, ne } from "drizzle-orm";

import { DB_TOKEN } from "../database.constants.js";

export type Sensor = typeof sensors.$inferSelect;
export type SensorWrite = Omit<Sensor, "createdAt" | "updatedAt">;
export type NewSensor = Omit<SensorWrite, "id">;

@Injectable()
export class SensorsRepository {
  constructor(@Inject(DB_TOKEN) private readonly db: Database) {}

  async findAll(): Promise<Sensor[]> {
    return this.db.select().from(sensors).where(isNull(sensors.deletedAt));
  }

  async findById(id: number): Promise<Sensor | undefined> {
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
      .where(
        and(
          eq(sensors.controllerId, controllerId),
          isNull(sensors.deletedAt),
        ),
      );
  }

  async findConflictingNodeId(
    controllerId: number,
    nodeId: number,
    sensorId?: number,
  ): Promise<Sensor | undefined> {
    const conditions = [
      eq(sensors.controllerId, controllerId),
      eq(sensors.nodeId, nodeId),
      isNull(sensors.deletedAt),
    ];

    if (sensorId !== undefined) {
      conditions.push(ne(sensors.id, sensorId));
    }

    const [sensor] = await this.db
      .select()
      .from(sensors)
      .where(and(...conditions));

    return sensor;
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
      .set({ ...sensorData, updatedAt: new Date() })
      .where(eq(sensors.id, id))
      .returning();
    return updatedSensor;
  }

  async deleteSensor(sensorId: number): Promise<Sensor | undefined> {
    const [sensor] = await this.db
      .update(sensors)
      .set({
        deletedAt: new Date(),
        operationalStatus: "removed",
        updatedAt: new Date(),
      })
      .where(eq(sensors.id, sensorId))
      .returning();

    return sensor;
  }

  async deleteByControllerId(controllerId: number) {
    await this.db
      .update(sensors)
      .set({
        deletedAt: new Date(),
        operationalStatus: "removed",
        updatedAt: new Date(),
      })
      .where(eq(sensors.controllerId, controllerId))
      .run();
  }

  async replaceByControllerId(
    controllerId: number,
    nextSensors: NewSensor[],
  ): Promise<void> {
    await this.db.transaction((tx) => {
      tx.update(sensors)
        .set({
          deletedAt: new Date(),
          operationalStatus: "removed",
          updatedAt: new Date(),
        })
        .where(eq(sensors.controllerId, controllerId))
        .run();

      if (nextSensors.length > 0) {
        tx.insert(sensors).values(nextSensors).run();
      }
    });
  }

  async replaceByControllerIdWithXmlMetadata(
    controllerId: number,
    nextSensors: NewSensor[],
    xmlMetadata: {
      xmlConfig: string | null;
      xmlConfigChecksum: string | null;
      xmlLastSyncedAt: Date | null;
    },
  ): Promise<void> {
    await this.db.transaction((tx) => {
      tx.update(sensors)
        .set({
          deletedAt: new Date(),
          operationalStatus: "removed",
          updatedAt: new Date(),
        })
        .where(eq(sensors.controllerId, controllerId))
        .run();

      if (nextSensors.length > 0) {
        tx.insert(sensors).values(nextSensors).run();
      }

      tx.update(controllers)
        .set({ ...xmlMetadata, updatedAt: new Date() })
        .where(eq(controllers.id, controllerId))
        .run();
    });
  }

  async updateOperationalStatusByControllerId(
    controllerId: number,
    operationalStatus: string,
  ): Promise<void> {
    await this.db
      .update(sensors)
      .set({
        operationalStatus,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(sensors.controllerId, controllerId),
          isNull(sensors.deletedAt),
        ),
      )
      .run();
  }
}
