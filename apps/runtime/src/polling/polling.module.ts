import { Module } from '@nestjs/common';
import { RepositoryModule } from '@weber-nexus/repository';
import { InfluxdbModule } from '../influxdb/influxdb.module';
import { PollingRuntimeService } from './polling-runtime.service';

@Module({
  imports: [InfluxdbModule, RepositoryModule],
  providers: [PollingRuntimeService],
  exports: [PollingRuntimeService],
})
export class PollingModule {}
