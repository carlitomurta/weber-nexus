import { Module } from '@nestjs/common';
import { RepositoryModule } from '@weber-nexus/repository';
import { AuthModule } from './auth/auth.module';
import { RuntimeConfigModule } from './config/runtime-config.module';
import { ControllersModule } from './controllers/controllers.module';
import { DiagnosticsModule } from './controllers/diagnostics/diagnostics.module';
import { InfluxdbModule } from './influxdb/influxdb.module';
import { RuntimeControlModule } from './controllers/runtime-control/runtime-control.module';

@Module({
  imports: [
    RuntimeConfigModule,
    RepositoryModule,
    RuntimeControlModule,
    InfluxdbModule,
    AuthModule,
    ControllersModule,
    DiagnosticsModule,
  ],
})
export class AppModule {}
