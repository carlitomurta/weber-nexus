import { Global, Module } from "@nestjs/common";

import { DatabaseProvider } from "./database.provider.js";
import { ControllersRepository } from "./repositories/controllers.repository.js";
import { SensorsRepository } from "./repositories/sensors.repository.js";
import { UsersRepository } from "./repositories/users.repository.js";

@Global()
@Module({
  providers: [
    DatabaseProvider,
    ControllersRepository,
    SensorsRepository,
    UsersRepository,
  ],
  exports: [ControllersRepository, SensorsRepository, UsersRepository],
})
export class RepositoryModule {}
