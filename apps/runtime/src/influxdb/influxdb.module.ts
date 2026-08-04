import { Module } from '@nestjs/common';
import { RepositoryModule } from '@weber-nexus/repository';
import { RuntimeConfigModule } from '../config/runtime-config.module';
import { InfluxdbController } from './influxdb.controller';
import { InfluxdbRuntimePathsService } from './influxdb-runtime-paths.service';
import { InfluxdbRuntimeService } from './influxdb-runtime.service';
import { InfluxdbSchemaMigrationService } from './influxdb-schema-migration.service';
import { InfluxdbTelemetryRepository } from './influxdb-telemetry.repository';
import { InfluxdbTelemetryService } from './influxdb-telemetry.service';
import { InfluxReadingsRangePipe } from './pipes/influx-readings-range.pipe';

@Module({
  imports: [RuntimeConfigModule, RepositoryModule],
  controllers: [InfluxdbController],
  providers: [
    InfluxdbRuntimeService,
    InfluxdbRuntimePathsService,
    InfluxdbSchemaMigrationService,
    InfluxdbTelemetryRepository,
    InfluxdbTelemetryService,
    InfluxReadingsRangePipe,
  ],
  exports: [
    InfluxdbRuntimeService,
    InfluxdbSchemaMigrationService,
    InfluxdbTelemetryService,
  ],
})
export class InfluxdbModule {}
