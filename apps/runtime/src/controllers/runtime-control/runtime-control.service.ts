import { ForbiddenException, Injectable } from '@nestjs/common';
import { RuntimeEnvService } from '../../config/runtime-env.service';

@Injectable()
export class RuntimeControlService {
  constructor(private readonly runtimeEnv: RuntimeEnvService) {}

  health(): { status: 'ready'; timestamp: string } {
    return {
      status: 'ready',
      timestamp: new Date().toISOString(),
    };
  }

  stop(remoteAddress?: string): { stopping: true } {
    if (!this.runtimeEnv.isRuntimeStopEnabled()) {
      throw new ForbiddenException(
        'Runtime só pode ser parado em desenvolvimento local',
      );
    }

    if (!isLocalRequest(remoteAddress)) {
      throw new ForbiddenException('Runtime só pode ser parado localmente');
    }

    const shutdownTimer = setTimeout(() => {
      process.kill(process.pid, 'SIGTERM');
    }, 250);
    shutdownTimer.unref();

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
