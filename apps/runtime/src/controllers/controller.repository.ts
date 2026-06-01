import { Inject, Injectable } from '@nestjs/common';
import type { Database } from '@weber-nexus/database';
import { DB_TOKEN } from '../core/database.constants';

@Injectable()
export class ControllerRepository {
  constructor(
    @Inject(DB_TOKEN)
    private readonly db: Database,
  ) {}

  async findAll() {
    return await this.db;
  }

  // async findById(id: string) {
  //   const [controller] = await this.db
  //     .select()
  //     .from(controllers)
  //     .where(eq(controllers.id, id));

  //   return controller;
  // }
}
