import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { RuntimeUpdateGuard } from './runtime-update.guard';
import { RuntimeUpdateService } from './runtime-update.service';

@Controller('runtime/update')
@UseGuards(RuntimeUpdateGuard)
export class RuntimeUpdateController {
  constructor(private readonly runtimeUpdateService: RuntimeUpdateService) {}

  @Get('status')
  status() {
    return this.runtimeUpdateService.currentStatus();
  }

  @Post('prepare')
  prepare() {
    return this.runtimeUpdateService.prepareForUpdate();
  }

  @Post('maintenance')
  maintenance() {
    return this.runtimeUpdateService.enterMaintenance();
  }

  @Post('health-check')
  healthCheck() {
    return this.runtimeUpdateService.runFinalHealthCheck();
  }
}
