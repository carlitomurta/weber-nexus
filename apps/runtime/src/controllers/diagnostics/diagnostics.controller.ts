import { Controller, Get } from '@nestjs/common';
import { PollingRuntimeService } from '../polling/polling-runtime.service';

@Controller('diagnostics')
export class DiagnosticsController {
  constructor(private readonly pollingRuntimeService: PollingRuntimeService) {}

  @Get('holding-registers/latest')
  getLatestHoldingRegisters() {
    return this.pollingRuntimeService.getLatestRawHoldingRegisterSnapshots();
  }
}
