import { Global, Module } from "@nestjs/common";

import { DatabaseProvider } from "./database.provider.js";
import { ControllerRepository } from "./repositories/controller.repository.js";

@Global()
@Module({
  providers: [DatabaseProvider, ControllerRepository],
  exports: [ControllerRepository],
})
export class RepositoryModule {}
