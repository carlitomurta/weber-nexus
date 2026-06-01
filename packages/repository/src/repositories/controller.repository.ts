import { Injectable } from "@nestjs/common";
import { controllers, type Database } from "@weber-nexus/database";
import { eq } from "drizzle-orm";

@Injectable()
export class ControllerRepository {
  constructor(private readonly db: Database) {}

  async findAll() {
    return this.db.select().from(controllers);
  }

  async findById(id: number) {
    const [controller] = await this.db
      .select()
      .from(controllers)
      .where(eq(controllers.id, id));

    return controller;
  }
}
