import { Global, Module } from "@nestjs/common";

import { DatabaseProvider } from "./database.provider.js";
import { ControllersRepository } from "./repositories/controllers.repository.js";
import { EquipmentRepository } from "./repositories/equipment.repository.js";
import { InfluxConfigsRepository } from "./repositories/influx-configs.repository.js";
import { InfluxWriteQueueRepository } from "./repositories/influx-write-queue.repository.js";
import { MigrationHistoryRepository } from "./repositories/migration-history.repository.js";
import { SensorsRepository } from "./repositories/sensors.repository.js";
import { UsersRepository } from "./repositories/users.repository.js";

@Global()
@Module({
  providers: [
    DatabaseProvider,
    ControllersRepository,
    EquipmentRepository,
    InfluxConfigsRepository,
    InfluxWriteQueueRepository,
    MigrationHistoryRepository,
    SensorsRepository,
    UsersRepository,
  ],
  exports: [
    ControllersRepository,
    EquipmentRepository,
    InfluxConfigsRepository,
    InfluxWriteQueueRepository,
    MigrationHistoryRepository,
    SensorsRepository,
    UsersRepository,
  ],
})
export class RepositoryModule {}
