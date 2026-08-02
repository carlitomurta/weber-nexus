import net from 'node:net';
import type { WlConfigUploadPlan } from './controller-file-transfer.types';
import { uploadPlanSummary } from './wlconfig-upload-plan';

export class ControllerResponseReader {
  private buffered = '';

  constructor(
    private readonly socket: net.Socket,
    private readonly timeoutMs: number,
  ) {}

  waitForResponse(): Promise<string> {
    return new Promise((resolve, reject) => {
      const bufferedResponse = this.shiftBufferedResponse();

      if (bufferedResponse) {
        resolve(bufferedResponse);
        return;
      }

      const timer = setTimeout(() => {
        cleanup();
        reject(
          new Error('Tempo esgotado ao aguardar resposta do envio do XML'),
        );
      }, this.timeoutMs);
      let idleTimer: NodeJS.Timeout | undefined;

      const cleanup = (): void => {
        clearTimeout(timer);
        if (idleTimer) clearTimeout(idleTimer);
        this.socket.off('data', onData);
        this.socket.off('error', onError);
      };

      const onData = (data: Buffer): void => {
        this.buffered += data.toString('utf8');
        const response = this.shiftBufferedResponse();

        if (!response) {
          if (looksLikeControllerResponse(this.buffered)) {
            if (idleTimer) clearTimeout(idleTimer);
            idleTimer = setTimeout(() => {
              const idleResponse = this.shiftBufferedRemainder();

              if (!idleResponse) return;

              cleanup();
              resolve(idleResponse);
            }, 50);
          }

          return;
        }

        cleanup();
        resolve(response);
      };

      const onError = (error: Error): void => {
        cleanup();
        reject(
          new Error('Erro de conexão durante o envio do XML do controlador', {
            cause: error,
          }),
        );
      };

      this.socket.on('data', onData);
      this.socket.once('error', onError);
    });
  }

  private shiftBufferedResponse(): string | undefined {
    const newlineIndex = this.buffered.indexOf('\n');

    if (newlineIndex < 0) return undefined;

    const response = this.buffered.slice(0, newlineIndex).trim();
    this.buffered = this.buffered.slice(newlineIndex + 1);

    return response || this.shiftBufferedResponse();
  }

  private shiftBufferedRemainder(): string | undefined {
    const response = this.buffered.trim();
    this.buffered = '';

    return response || undefined;
  }
}

export type DownloadChunkResponse = {
  readonly raw: Buffer;
  readonly eof: boolean;
};

export class ControllerDownloadResponseReader {
  private buffered = Buffer.alloc(0);

  constructor(
    private readonly socket: net.Socket,
    private readonly timeoutMs: number,
  ) {}

  waitForChunkResponse(): Promise<DownloadChunkResponse> {
    return new Promise((resolve, reject) => {
      let bufferedResponse: DownloadChunkResponse | undefined;

      try {
        bufferedResponse = this.shiftBufferedChunkResponse();
      } catch (error) {
        reject(toError(error));
        return;
      }

      if (bufferedResponse) {
        resolve(bufferedResponse);
        return;
      }

      const timer = setTimeout(() => {
        cleanup();
        reject(
          new Error('Tempo esgotado ao aguardar fragmento do XML baixado'),
        );
      }, this.timeoutMs);

      const cleanup = (): void => {
        clearTimeout(timer);
        this.socket.off('data', onData);
        this.socket.off('error', onError);
      };

      const onData = (data: Buffer): void => {
        this.buffered = Buffer.concat([this.buffered, data]);
        let response: DownloadChunkResponse | undefined;

        try {
          response = this.shiftBufferedChunkResponse();
        } catch (error) {
          cleanup();
          reject(toError(error));
          return;
        }

        if (!response) return;

        cleanup();
        resolve(response);
      };

      const onError = (error: Error): void => {
        cleanup();
        reject(
          new Error('Erro de conexão durante o download do XML', {
            cause: error,
          }),
        );
      };

      this.socket.on('data', onData);
      this.socket.once('error', onError);
    });
  }

  private shiftBufferedChunkResponse(): DownloadChunkResponse | undefined {
    const responseStart = this.buffered.indexOf('RSP1002');

    if (responseStart < 0) return undefined;

    if (responseStart > 0) {
      this.buffered = this.buffered.subarray(responseStart);
    }

    const header = readChunkHeader(this.buffered);

    if (!header) return undefined;

    const responseEnd = header.dataStart + header.length;
    const eofEnd = header.dataStart + 3;

    if (header.length === 0 && this.buffered.length >= eofEnd) {
      const payload = this.buffered
        .subarray(header.dataStart, eofEnd)
        .toString('utf8');

      if (payload !== 'EOF') {
        throw new Error(
          `Resposta inesperada ao finalizar download do XML: ${payload}`,
        );
      }

      const raw = this.buffered.subarray(0, eofEnd);
      this.buffered = this.buffered.subarray(eofEnd);

      return {
        raw,
        eof: true,
      };
    }

    if (this.buffered.length < responseEnd) return undefined;

    const raw = this.buffered.subarray(0, responseEnd);
    this.buffered = this.buffered.subarray(responseEnd);

    return {
      raw,
      eof: false,
    };
  }
}

type DownloadChunkHeader = {
  readonly length: number;
  readonly dataStart: number;
};

export function assertExpectedResponse(
  response: string,
  expectedPrefix: string,
  uploadPlan?: WlConfigUploadPlan,
  context?: string,
): void {
  if (isApiError(response)) {
    throw new Error(
      [
        `Controlador rejeitou a transferência do XML: ${response}`,
        context,
        uploadPlan ? uploadPlanSummary(uploadPlan) : undefined,
      ]
        .filter(Boolean)
        .join(' | '),
    );
  }

  if (!response.startsWith(expectedPrefix)) {
    throw new Error(
      [
        `Resposta inesperada do controlador: ${response}`,
        context,
        uploadPlan ? uploadPlanSummary(uploadPlan) : undefined,
      ]
        .filter(Boolean)
        .join(' | '),
    );
  }
}

export function isApiError(response: string): boolean {
  return (
    response.includes('IPC_PARAMS') ||
    response.includes('API_NO_MEMORY') ||
    /\bAPI_[A-Z_]+\b/.test(response)
  );
}

export function parseLocalRegisterResponse(
  response: string,
  address: number,
): number {
  if (isApiError(response)) {
    throw new Error(
      `Controlador rejeitou a leitura do registrador: ${response}`,
    );
  }

  const match = response.match(/^RSP0001\s*(\d+)\s*,\s*(-?\d+)/);

  if (!match) {
    throw new Error(`Resposta inesperada ao ler registrador: ${response}`);
  }

  const responseAddress = Number(match[1]);
  const value = Number(match[2]);

  if (responseAddress !== address || !Number.isFinite(value)) {
    throw new Error(`Resposta inválida ao ler registrador: ${response}`);
  }

  return value;
}

function readChunkHeader(buffer: Buffer): DownloadChunkHeader | undefined {
  const headerMatch = buffer
    .subarray(0, Math.min(buffer.length, 64))
    .toString('ascii')
    .match(/^RSP1002(\d+),([a-fA-F0-9]+),/);

  if (!headerMatch) return undefined;

  const length = Number(headerMatch[1]);

  if (!Number.isInteger(length) || length < 0) {
    throw new Error(`Tamanho inválido do fragmento XML: ${headerMatch[1]}`);
  }

  return {
    length,
    dataStart: headerMatch[0].length,
  };
}

function looksLikeControllerResponse(response: string): boolean {
  const trimmed = response.trim();

  return (
    /^RSP\d{4}/.test(trimmed) ||
    trimmed.includes('IPC_PARAMS') ||
    trimmed.includes('API_NO_MEMORY')
  );
}

function toError(error: unknown): Error {
  return error instanceof Error
    ? error
    : new Error(`Erro inesperado na transferência XML: ${String(error)}`);
}
