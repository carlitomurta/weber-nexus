import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Logger } from '@weber-nexus/logger';

type RuntimeErrorResponse = {
  statusCode: number;
  message: string;
  timestamp: string;
  path: string;
};

@Catch()
export class RuntimeExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(
    'runtime/filters/runtime-exception.filter.ts',
  );

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const context = host.switchToHttp();
    const request = context.getRequest();
    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const responseBody: RuntimeErrorResponse = {
      statusCode,
      message: errorMessage(exception),
      timestamp: new Date().toISOString(),
      path: httpAdapter.getRequestUrl(request),
    };

    this.logger.error(
      `Requisição do runtime falhou ${request.method ?? ''} ${responseBody.path}`,
      exception,
    );
    httpAdapter.reply(context.getResponse(), responseBody, statusCode);
  }
}

function errorMessage(exception: unknown): string {
  if (exception instanceof HttpException) {
    const response = exception.getResponse();

    if (typeof response === 'string') {
      return response;
    }

    if (isErrorResponse(response)) {
      const message = response.message;
      return Array.isArray(message) ? message.join(', ') : message;
    }

    return exception.message;
  }

  if (exception instanceof Error) {
    return exception.message;
  }

  return 'Erro inesperado no runtime';
}

function isErrorResponse(
  value: unknown,
): value is { message: string | string[] } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'message' in value &&
    (typeof value.message === 'string' || Array.isArray(value.message))
  );
}
