import { Module } from '@nestjs/common';
import { PollingModule } from '../../polling/polling.module';
import { ControllerXmlConfigModule } from '../xml/controller-xml-config.module';
import { SensorsController } from './sensors.controller';
import { SensorsService } from './sensors.service';

@Module({
  imports: [PollingModule, ControllerXmlConfigModule],
  controllers: [SensorsController],
  providers: [SensorsService],
})
export class SensorsModule {}
