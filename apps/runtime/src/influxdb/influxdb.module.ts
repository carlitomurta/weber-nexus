import { Module } from '@nestjs/common';
import { InfluxdbController } from './influxdb.controller';
import { InfluxdbRuntimeService } from './influxdb-runtime.service';
import { InfluxdbTelemetryService } from './influxdb-telemetry.service';

@Module({
  controllers: [InfluxdbController],
  providers: [InfluxdbRuntimeService, InfluxdbTelemetryService],
  exports: [InfluxdbRuntimeService, InfluxdbTelemetryService],
})
export class InfluxdbModule {}
