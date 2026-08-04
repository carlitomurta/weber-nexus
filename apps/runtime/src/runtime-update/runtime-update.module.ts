import { Module } from '@nestjs/common';
import { RepositoryModule } from '@weber-nexus/repository';
import { InfluxdbModule } from '../influxdb/influxdb.module';
import { PollingModule } from '../polling/polling.module';
import { RuntimeUpdateController } from './runtime-update.controller';
import { RuntimeUpdateGuard } from './runtime-update.guard';
import { RuntimeUpdateService } from './runtime-update.service';

@Module({
  imports: [InfluxdbModule, PollingModule, RepositoryModule],
  controllers: [RuntimeUpdateController],
  providers: [RuntimeUpdateGuard, RuntimeUpdateService],
  exports: [RuntimeUpdateService],
})
export class RuntimeUpdateModule {}
