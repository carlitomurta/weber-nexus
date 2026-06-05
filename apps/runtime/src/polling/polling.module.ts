import { Module } from '@nestjs/common';
import { PollingRuntimeService } from './polling-runtime.service';

@Module({
  providers: [PollingRuntimeService],
  exports: [PollingRuntimeService],
})
export class PollingModule {}
