import { Module } from '@nestjs/common';
import { IndustrialControllersModule } from './controller/controller.module';
import { SensorsModule } from './sensors/sensors.module';

@Module({
  imports: [IndustrialControllersModule, SensorsModule],
})
export class ControllersModule {}
