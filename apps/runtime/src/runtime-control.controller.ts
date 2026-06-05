import { Controller, ForbiddenException, Post, Req } from '@nestjs/common';
import type { Request } from 'express';

@Controller('runtime')
export class RuntimeControlController {
  @Post('stop')
  stop(@Req() request: Request) {
    if (!isLocalRequest(request.socket.remoteAddress)) {
      throw new ForbiddenException('Runtime can only be stopped locally');
    }

    setTimeout(() => {
      process.kill(process.pid, 'SIGTERM');
    }, 50);

    return { stopping: true };
  }
}

function isLocalRequest(address?: string): boolean {
  return (
    address === '127.0.0.1' ||
    address === '::1' ||
    address === '::ffff:127.0.0.1'
  );
}
