import { Module } from '@nestjs/common';
import { InfluxdbModule } from '../influxdb/influxdb.module';
import { PollingRuntimeService } from './polling-runtime.service';

@Module({
  imports: [InfluxdbModule],
  providers: [PollingRuntimeService],
  exports: [PollingRuntimeService],
})
export class PollingModule {}
