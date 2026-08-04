import { Module } from '@nestjs/common';
import { RepositoryModule } from '@weber-nexus/repository';
import { RuntimeConfigModule } from '../config/runtime-config.module';
import { InfluxdbController } from './influxdb.controller';
import { InfluxdbRuntimePathsService } from './influxdb-runtime-paths.service';
import { InfluxdbRuntimeService } from './influxdb-runtime.service';
import { InfluxdbTelemetryRepository } from './influxdb-telemetry.repository';
import { InfluxdbTelemetryService } from './influxdb-telemetry.service';
import { InfluxReadingsRangePipe } from './pipes/influx-readings-range.pipe';

@Module({
  imports: [RuntimeConfigModule, RepositoryModule],
  controllers: [InfluxdbController],
  providers: [
    InfluxdbRuntimeService,
    InfluxdbRuntimePathsService,
    InfluxdbTelemetryRepository,
    InfluxdbTelemetryService,
    InfluxReadingsRangePipe,
  ],
  exports: [InfluxdbRuntimeService, InfluxdbTelemetryService],
})
export class InfluxdbModule {}
