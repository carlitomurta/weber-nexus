import { Module } from '@nestjs/common';
import { RuntimeControlController } from './runtime-control.controller';
import { RuntimeControlService } from './runtime-control.service';

@Module({
  controllers: [RuntimeControlController],
  providers: [RuntimeControlService],
})
export class RuntimeControlModule {}
