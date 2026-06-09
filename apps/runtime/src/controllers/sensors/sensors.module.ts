import { Module } from '@nestjs/common';
import { PollingModule } from '../../polling/polling.module';
import { SensorsController } from './sensors.controller';
import { SensorsService } from './sensors.service';

@Module({
  imports: [PollingModule],
  controllers: [SensorsController],
  providers: [SensorsService],
})
export class SensorsModule {}
