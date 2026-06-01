import { Module } from '@nestjs/common';
import { RepositoryModule } from '@weber-nexus/repository';

@Module({
  imports: [RepositoryModule],
  exports: [RepositoryModule],
})
export class ControllerModule {}
