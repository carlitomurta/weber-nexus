import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { RuntimeEnvService } from '../config/runtime-env.service';

@Injectable()
export class RuntimeUpdateGuard implements CanActivate {
  constructor(private readonly runtimeEnv: RuntimeEnvService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    if (!isLocalRequest(request.socket.remoteAddress)) {
      throw new ForbiddenException(
        'Canal administrativo de atualização aceita apenas conexões locais.',
      );
    }

    const configuredToken = this.runtimeEnv.updateAgentToken();
    const requestToken = request.header('x-nexus-agent-token');

    if (configuredToken) {
      if (requestToken !== configuredToken) {
        throw new ForbiddenException('Token do Nexus Update Agent inválido.');
      }

      return true;
    }

    if (this.runtimeEnv.isProduction()) {
      throw new ForbiddenException(
        'Token do Nexus Update Agent deve ser configurado em produção.',
      );
    }

    return true;
  }
}

function isLocalRequest(address?: string): boolean {
  return (
    address === '127.0.0.1' ||
    address === '::1' ||
    address === '::ffff:127.0.0.1'
  );
}
