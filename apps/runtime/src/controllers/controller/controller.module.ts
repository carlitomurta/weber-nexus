import { Module } from '@nestjs/common';
import { PollingModule } from '../../polling/polling.module';
import { ControllerXmlConfigModule } from '../xml/controller-xml-config.module';
import { ControllersController } from './controller.controller';
import { ControllersService } from './controller.service';

@Module({
  imports: [PollingModule, ControllerXmlConfigModule],
  controllers: [ControllersController],
  providers: [ControllersService],
})
export class IndustrialControllersModule {}
