import { Inject, Injectable } from "@nestjs/common";
import { controllers, type Database } from "@weber-nexus/database";
import { eq } from "drizzle-orm";

import { DB_TOKEN } from "../database.constants.js";

export type Controller = typeof controllers.$inferSelect;
export type NewController = typeof controllers.$inferInsert;
export type ControllerWrite = Omit<Controller, "createdAt" | "updatedAt">;

@Injectable()
export class ControllersRepository {
  constructor(@Inject(DB_TOKEN) private readonly db: Database) {}

  async findAll(): Promise<Controller[]> {
    return this.db.select().from(controllers);
  }

  async findById(id: number): Promise<Controller> {
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

  async updateController(controller: ControllerWrite): Promise<Controller> {
    const { id, ...controllerData } = controller;
    const [newController] = await this.db
      .update(controllers)
      .set(controllerData)
      .where(eq(controllers.id, id))
      .returning();
    return newController;
  }

  async deleteController(controllerId: number) {
    await this.db
      .delete(controllers)
      .where(eq(controllers.id, controllerId))
      .run();
  }
}
