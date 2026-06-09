import { ForbiddenException, Injectable } from '@nestjs/common';

@Injectable()
export class RuntimeControlService {
  stop(remoteAddress?: string): { stopping: true } {
    if (!isLocalRequest(remoteAddress)) {
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
