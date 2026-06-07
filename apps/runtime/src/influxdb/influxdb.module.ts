import { Module } from '@nestjs/common';
import { InfluxdbRuntimeService } from './influxdb-runtime.service';
import { InfluxdbTelemetryService } from './influxdb-telemetry.service';

@Module({
  providers: [InfluxdbRuntimeService, InfluxdbTelemetryService],
  exports: [InfluxdbRuntimeService, InfluxdbTelemetryService],
})
export class InfluxdbModule {}
