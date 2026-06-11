import { ForbiddenException, Injectable } from '@nestjs/common';

@Injectable()
export class RuntimeControlService {
  health(): { status: 'ready'; timestamp: string } {
    return {
      status: 'ready',
      timestamp: new Date().toISOString(),
    };
  }

  stop(remoteAddress?: string): { stopping: true } {
    if (!isLocalRequest(remoteAddress)) {
      throw new ForbiddenException('Runtime só pode ser parado localmente');
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
