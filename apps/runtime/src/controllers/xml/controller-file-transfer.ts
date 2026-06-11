import net from 'node:net';
import { crc16modbus } from 'crc';

const WLCONFIG_FILENAME = 'WLConfig.xml';
const CONTROLLER_API_PORT = 8844;
const MAX_CHUNK_BYTES = 512;
const DEFAULT_TIMEOUT_MS = 10000;

export type ControllerFileTransferOptions = {
  readonly host: string;
  readonly port?: number;
  readonly timeoutMs?: number;
};

export type WlConfigUploadPlan = {
  readonly fileSizeBytes: number;
  readonly chunkCount: number;
  readonly chunkSizes: readonly number[];
  readonly totalChunkBytes: number;
};

export async function readControllerLocalRegister(
  address: number,
  options: ControllerFileTransferOptions,
): Promise<number> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const port = options.port ?? CONTROLLER_API_PORT;
  const socket = await connectSocket(options.host, port, timeoutMs);
  const reader = new ControllerResponseReader(socket, timeoutMs);

  try {
    const response = await writeCommandAndWait(
      reader,
      socket,
      `CMD0001 ${address},1,0,0,0\r\n`,
    );

    return parseLocalRegisterResponse(response, address);
  } finally {
    socket.end();
  }
}

export async function downloadWlConfigXml(
  options: ControllerFileTransferOptions,
): Promise<string> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const port = options.port ?? CONTROLLER_API_PORT;
  const socket = new net.Socket();

  return new Promise((resolve, reject) => {
    let chunkId = 1;
    let finished = false;
    let started = false;
    let rawResponse = '';

    const fail = (error: Error): void => {
      if (finished) return;
      finished = true;
      socket.destroy();
      reject(error);
    };

    socket.setTimeout(timeoutMs, () => {
      fail(new Error('Tempo esgotado ao baixar o XML do controlador'));
    });

    socket.on('error', (error) => {
      fail(
        new Error('Erro de conexão ao baixar o XML do controlador', {
          cause: error,
        }),
      );
    });

    socket.on('data', (data: Buffer) => {
      if (finished) return;

      rawResponse += data.toString('utf8');

      if (!started) {
        const trimmed = rawResponse.trimStart();

        if (trimmed.startsWith('RSP1001')) {
          started = true;
          socket.write(`CMD1002 ${chunkId}\r\n`);
          return;
        }

        if (rawResponse.includes('\n')) {
          fail(
            new Error(
              `Resposta inesperada ao abrir o XML do controlador: ${trimmed}`,
            ),
          );
        }

        return;
      }

      if (rawResponse.includes('EOF')) {
        finished = true;
        socket.write('CMD1003\r\n');
        socket.end();
        resolve(rawResponse);
        return;
      }

      chunkId += 1;
      socket.write(`CMD1002 ${chunkId}\r\n`);
    });

    socket.connect(port, options.host, () => {
      socket.write(`CMD1001 ${WLCONFIG_FILENAME},0,0,0\r\n`);
    });
  });
}

export async function uploadWlConfigXml(
  xml: string,
  options: ControllerFileTransferOptions,
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const port = options.port ?? CONTROLLER_API_PORT;
  const socket = await connectSocket(options.host, port, timeoutMs);
  const reader = new ControllerResponseReader(socket, timeoutMs);
  const upload = createWlConfigUpload(xml);

  try {
    const preflightCloseResponse = await writeCommandAndWait(
      reader,
      socket,
      'CMD1003\r\n',
    );

    if (isApiError(preflightCloseResponse)) {
      // Uma sessão interrompida pode retornar IPC_PARAMS neste fechamento de
      // limpeza. A nova transferência começa com CMD1001 e deve continuar.
    } else {
      assertExpectedResponse(preflightCloseResponse, 'RSP1003');
    }

    const openResponse = await writeCommandAndWait(
      reader,
      socket,
      `CMD1001 ${WLCONFIG_FILENAME},1,${upload.plan.fileSizeBytes},0\r\n`,
    );
    assertExpectedResponse(openResponse, 'RSP1001', upload.plan);

    for (let index = 0; index < upload.chunks.length; index += 1) {
      const chunk = upload.chunks[index];
      const crc = formatModbusCrc16(chunk);
      const commandPrefix = Buffer.from(
        `CMD1002 ${chunk.length},${crc},${index + 1},`,
        'utf8',
      );
      const response = await writeBufferAndWait(
        reader,
        socket,
        Buffer.concat([commandPrefix, chunk, Buffer.from('\r\n', 'utf8')]),
      );

      assertExpectedResponse(
        response,
        'RSP1002',
        upload.plan,
        `fragmento=${index + 1} bytesDoFragmento=${chunk.length}`,
      );
    }

    const closeResponse = await writeCommandAndWait(
      reader,
      socket,
      'CMD1003\r\n',
    );
    assertExpectedResponse(
      closeResponse,
      'RSP1003',
      upload.plan,
      'fechamento final',
    );
  } finally {
    socket.end();
  }
}

export function createWlConfigUploadPlan(xml: string): WlConfigUploadPlan {
  return createWlConfigUpload(xml).plan;
}

function createWlConfigUpload(xml: string): {
  readonly encodedXml: Buffer;
  readonly chunks: Buffer[];
  readonly plan: WlConfigUploadPlan;
} {
  const encodedXml = encodeXmlForController(xml);
  const chunks = chunkBuffer(encodedXml, MAX_CHUNK_BYTES);
  const chunkSizes = chunks.map((chunk) => chunk.length);
  const totalChunkBytes = chunkSizes.reduce((total, size) => total + size, 0);
  const plan = {
    fileSizeBytes: encodedXml.length,
    chunkCount: chunks.length,
    chunkSizes,
    totalChunkBytes,
  };

  if (plan.fileSizeBytes !== plan.totalChunkBytes) {
    throw new Error(
      `Plano de bytes inválido para envio do WLConfig: ${uploadPlanSummary(plan)}`,
    );
  }

  return {
    encodedXml,
    chunks,
    plan,
  };
}

export function encodeXmlForController(xml: string): Buffer {
  return Buffer.from(
    Buffer.from(xml, 'utf8').map((byte) => {
      if (byte === 0x0d) return 0x1e;
      if (byte === 0x0a) return 0x1f;
      return byte;
    }),
  );
}

export function chunkBuffer(
  buffer: Buffer,
  maxChunkBytes = MAX_CHUNK_BYTES,
): Buffer[] {
  const chunks: Buffer[] = [];

  for (let offset = 0; offset < buffer.length; offset += maxChunkBytes) {
    chunks.push(buffer.subarray(offset, offset + maxChunkBytes));
  }

  return chunks;
}

export function modbusCrc16(buffer: Buffer): number {
  return crc16modbus(buffer);
}

export function formatModbusCrc16(buffer: Buffer): string {
  const crc = modbusCrc16(buffer);
  const wireOrderCrc = ((crc & 0xff) << 8) | (crc >> 8);

  return wireOrderCrc.toString(16).toUpperCase().padStart(4, '0');
}

async function connectSocket(
  host: string,
  port: number,
  timeoutMs: number,
): Promise<net.Socket> {
  const socket = new net.Socket();

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.destroy();
      reject(
        new Error(
          'Tempo esgotado ao conectar para enviar o XML do controlador',
        ),
      );
    }, timeoutMs);

    socket.once('error', (error) => {
      clearTimeout(timer);
      reject(
        new Error('Erro de conexão ao enviar o XML do controlador', {
          cause: error,
        }),
      );
    });

    socket.connect(port, host, () => {
      clearTimeout(timer);
      socket.removeAllListeners('error');
      socket.on('error', () => undefined);
      resolve(socket);
    });
  });
}

async function writeCommandAndWait(
  reader: ControllerResponseReader,
  socket: net.Socket,
  command: string,
): Promise<string> {
  return writeBufferAndWait(reader, socket, Buffer.from(command, 'utf8'));
}

async function writeBufferAndWait(
  reader: ControllerResponseReader,
  socket: net.Socket,
  command: Buffer,
): Promise<string> {
  const response = reader.waitForResponse();
  socket.write(command);
  return response;
}

class ControllerResponseReader {
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

function looksLikeControllerResponse(response: string): boolean {
  const trimmed = response.trim();

  return (
    /^RSP\d{4}/.test(trimmed) ||
    trimmed.includes('IPC_PARAMS') ||
    trimmed.includes('API_NO_MEMORY')
  );
}

function assertExpectedResponse(
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

function isApiError(response: string): boolean {
  return (
    response.includes('IPC_PARAMS') ||
    response.includes('API_NO_MEMORY') ||
    /\bAPI_[A-Z_]+\b/.test(response)
  );
}

function uploadPlanSummary(plan: WlConfigUploadPlan): string {
  return `bytesDeclarados=${plan.fileSizeBytes} totalBytesFragmentos=${plan.totalChunkBytes} quantidadeFragmentos=${plan.chunkCount} tamanhosFragmentos=${plan.chunkSizes.join(',')}`;
}

function parseLocalRegisterResponse(response: string, address: number): number {
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
