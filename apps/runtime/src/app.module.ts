import { Module } from '@nestjs/common';
import { RepositoryModule } from '@weber-nexus/repository';
import { AuthModule } from './auth/auth.module';
import { RuntimeConfigModule } from './config/runtime-config.module';
import { ControllersModule } from './controllers/controllers.module';
import { DiagnosticsModule } from './diagnostics/diagnostics.module';
import { EquipmentModule } from './equipment/equipment.module';
import { InfluxdbModule } from './influxdb/influxdb.module';
import { RuntimeControlModule } from './runtime-control/runtime-control.module';
import { RuntimeUpdateModule } from './runtime-update/runtime-update.module';

@Module({
  imports: [
    RuntimeConfigModule,
    RepositoryModule,
    RuntimeControlModule,
    InfluxdbModule,
    AuthModule,
    ControllersModule,
    EquipmentModule,
    DiagnosticsModule,
    RuntimeUpdateModule,
  ],
})
export class AppModule {}
