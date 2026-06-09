import { Module } from '@nestjs/common';
import { PollingModule } from '../../polling/polling.module';
import { ControllersController } from './controller.controller';
import { ControllersService } from './controller.service';

@Module({
  imports: [PollingModule],
  controllers: [ControllersController],
  providers: [ControllersService],
})
export class IndustrialControllersModule {}
