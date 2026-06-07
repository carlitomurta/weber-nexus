import { Module } from '@nestjs/common';
import { InfluxdbRuntimeService } from './influxdb-runtime.service';

@Module({
  providers: [InfluxdbRuntimeService],
  exports: [InfluxdbRuntimeService],
})
export class InfluxdbModule {}
