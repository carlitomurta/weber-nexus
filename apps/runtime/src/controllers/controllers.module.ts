import { Module } from '@nestjs/common';
import { PollingModule } from '../polling/polling.module';
import { ControllersController } from './controller/controller.controller';
import { ControllersService } from './controller/controller.service';
import { SensorsController } from './sensors/sensors.controller';
import { SensorsService } from './sensors/sensors.service';

@Module({
  imports: [PollingModule],
  controllers: [SensorsController, ControllersController],
  providers: [SensorsService, ControllersService],
})
export class ControllersModule {}
