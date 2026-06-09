import { Controller, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { RuntimeControlService } from './runtime-control.service';

@Controller('runtime')
export class RuntimeControlController {
  constructor(private readonly runtimeControlService: RuntimeControlService) {}

  @Post('stop')
  stop(@Req() request: Request) {
    return this.runtimeControlService.stop(request.socket.remoteAddress);
  }
}
