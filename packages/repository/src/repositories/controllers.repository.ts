import { Inject, Injectable } from "@nestjs/common";
import { controllers, sensors, type Database } from "@weber-nexus/database";
import { eq, isNull } from "drizzle-orm";

import { DB_TOKEN } from "../database.constants.js";
import type { NewSensor } from "./sensors.repository.js";

export type Controller = typeof controllers.$inferSelect;
export type NewController = typeof controllers.$inferInsert;
export type ControllerXmlSyncMetadata = {
  xmlConfig: string | null;
  xmlConfigChecksum: string | null;
  xmlLastSyncedAt: Date | null;
};
export type ControllerWrite = Omit<
  Controller,
  "createdAt" | "updatedAt" | keyof ControllerXmlSyncMetadata
> &
  Partial<ControllerXmlSyncMetadata>;
export type ImportedSensor = Omit<NewSensor, "controllerId">;

@Injectable()
export class ControllersRepository {
  constructor(@Inject(DB_TOKEN) private readonly db: Database) {}

  async findAll(): Promise<Controller[]> {
    return this.db
      .select()
      .from(controllers)
      .where(isNull(controllers.deletedAt));
  }

  async findById(id: number): Promise<Controller | undefined> {
    const [controller] = await this.db
      .select()
      .from(controllers)
      .where(eq(controllers.id, id));

    return controller;
  }

  async insertController(controller: NewController): Promise<Controller> {
    const [newController] = await this.db
      .insert(controllers)
      .values(controller)
      .returning();
    return newController;
  }

  async insertControllerWithSensors(
    controller: NewController,
    importedSensors: ImportedSensor[],
    xmlMetadata: ControllerXmlSyncMetadata,
  ): Promise<Controller> {
    return this.db.transaction((tx) => {
      const newController = tx
        .insert(controllers)
        .values({
          ...controller,
          ...xmlMetadata,
        })
        .returning()
        .get();

      if (importedSensors.length > 0) {
        tx.insert(sensors)
          .values(
            importedSensors.map((sensor) => ({
              ...sensor,
              controllerId: newController.id,
            })),
          )
          .run();
      }

      return newController;
    });
  }

  async updateController(controller: ControllerWrite): Promise<Controller> {
    const { id, ...controllerData } = controller;
    const [newController] = await this.db
      .update(controllers)
      .set({ ...controllerData, updatedAt: new Date() })
      .where(eq(controllers.id, id))
      .returning();
    return newController;
  }

  async updateControllerWithSensors(
    controller: ControllerWrite,
    nextSensors: ImportedSensor[],
  ): Promise<Controller> {
    return this.db.transaction((tx) => {
      const { id, ...controllerData } = controller;
      const updatedController = tx
        .update(controllers)
        .set({ ...controllerData, updatedAt: new Date() })
        .where(eq(controllers.id, id))
        .returning()
        .get();

      if (!updatedController) {
        throw new Error(`Controller ${id} was not found`);
      }

      tx.update(sensors)
        .set({
          deletedAt: new Date(),
          operationalStatus: "removed",
          updatedAt: new Date(),
        })
        .where(eq(sensors.controllerId, updatedController.id))
        .run();

      if (nextSensors.length > 0) {
        tx.insert(sensors)
          .values(
            nextSensors.map((sensor) => ({
              ...sensor,
              controllerId: updatedController.id,
            })),
          )
          .run();
      }

      return updatedController;
    });
  }

  async deleteController(
    controllerId: number,
  ): Promise<Controller | undefined> {
    const [controller] = await this.db
      .update(controllers)
      .set({
        deletedAt: new Date(),
        operationalStatus: "removed",
        updatedAt: new Date(),
      })
      .where(eq(controllers.id, controllerId))
      .returning();

    return controller;
  }

  async updateXmlSyncMetadata(
    controllerId: number,
    xmlMetadata: ControllerXmlSyncMetadata,
  ): Promise<Controller | undefined> {
    const [controller] = await this.db
      .update(controllers)
      .set({ ...xmlMetadata, updatedAt: new Date() })
      .where(eq(controllers.id, controllerId))
      .returning();

    return controller;
  }

  async updateOperationalStatus(
    controllerId: number,
    operationalStatus: string,
  ): Promise<void> {
    await this.db
      .update(controllers)
      .set({
        operationalStatus,
        updatedAt: new Date(),
      })
      .where(eq(controllers.id, controllerId))
      .run();
  }
}
