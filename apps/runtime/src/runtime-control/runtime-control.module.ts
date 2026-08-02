import { Module } from '@nestjs/common';
import { RuntimeConfigModule } from '../config/runtime-config.module';
import { RuntimeControlController } from './runtime-control.controller';
import { RuntimeControlService } from './runtime-control.service';

@Module({
  imports: [RuntimeConfigModule],
  controllers: [RuntimeControlController],
  providers: [RuntimeControlService],
})
export class RuntimeControlModule {}
