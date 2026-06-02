import { Inject, Injectable } from "@nestjs/common";
import { controllers, type Database } from "@weber-nexus/database";
import { eq } from "drizzle-orm";

import { DB_TOKEN } from "../database.constants.js";

export type Controller = typeof controllers.$inferSelect;

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

  async insertController(
    controller: Omit<Controller, "id">,
  ): Promise<Controller> {
    const [newController] = await this.db
      .insert(controllers)
      .values(controller)
      .returning();
    return newController;
  }

  async updateController(controller: Controller): Promise<Controller> {
    const [newController] = await this.db
      .update(controllers)
      .set(controller)
      .where(eq(controllers.id, controller.id))
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
