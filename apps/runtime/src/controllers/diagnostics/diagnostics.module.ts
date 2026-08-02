import { Module } from '@nestjs/common';
import { PollingModule } from '../../polling/polling.module';
import { DiagnosticsController } from './diagnostics.controller';

@Module({
  imports: [PollingModule],
  controllers: [DiagnosticsController],
})
export class DiagnosticsModule {}
