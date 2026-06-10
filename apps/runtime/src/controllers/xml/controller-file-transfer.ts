import net from 'node:net';

const WLCONFIG_FILENAME = 'WLConfig.xml';
const CONTROLLER_API_PORT = 8844;
const MAX_CHUNK_BYTES = 512;
const DEFAULT_TIMEOUT_MS = 10000;

export type ControllerFileTransferOptions = {
  readonly host: string;
  readonly timeoutMs?: number;
};

export type WlConfigUploadPlan = {
  readonly fileSizeBytes: number;
  readonly chunkCount: number;
  readonly chunkSizes: readonly number[];
  readonly totalChunkBytes: number;
};

export async function downloadWlConfigXml(
  options: ControllerFileTransferOptions,
): Promise<string> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
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

    socket.connect(CONTROLLER_API_PORT, options.host, () => {
      socket.write(`CMD1001 ${WLCONFIG_FILENAME},0,0,0\r\n`);
    });
  });
}

export async function uploadWlConfigXml(
  xml: string,
  options: ControllerFileTransferOptions,
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const socket = await connectSocket(options.host, timeoutMs);
  const upload = createWlConfigUpload(xml);

  try {
    const preflightCloseResponse = await writeCommandAndWait(
      socket,
      'CMD1003\r\n',
      timeoutMs,
    );

    if (isApiError(preflightCloseResponse)) {
      // Uma sessão interrompida pode retornar IPC_PARAMS neste fechamento de
      // limpeza. A nova transferência começa com CMD1001 e deve continuar.
    } else {
      assertExpectedResponse(preflightCloseResponse, 'RSP1003');
    }

    const openResponse = await writeCommandAndWait(
      socket,
      `CMD1001 ${WLCONFIG_FILENAME},1,${upload.plan.fileSizeBytes},0\r\n`,
      timeoutMs,
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
        socket,
        Buffer.concat([commandPrefix, chunk, Buffer.from('\r\n', 'utf8')]),
        timeoutMs,
      );

      assertExpectedResponse(
        response,
        'RSP1002',
        upload.plan,
        `fragmento=${index + 1} bytesDoFragmento=${chunk.length}`,
      );
    }

    const closeResponse = await writeCommandAndWait(
      socket,
      'CMD1003\r\n',
      timeoutMs,
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
  let crc = 0xffff;

  for (const byte of buffer) {
    crc ^= byte;

    for (let bit = 0; bit < 8; bit += 1) {
      const carry = crc & 1;
      crc >>= 1;

      if (carry) {
        crc ^= 0xa001;
      }
    }
  }

  return crc & 0xffff;
}

export function formatModbusCrc16(buffer: Buffer): string {
  return modbusCrc16(buffer).toString(16).toUpperCase().padStart(4, '0');
}

async function connectSocket(
  host: string,
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

    socket.connect(CONTROLLER_API_PORT, host, () => {
      clearTimeout(timer);
      socket.removeAllListeners('error');
      socket.on('error', () => undefined);
      resolve(socket);
    });
  });
}

async function writeCommandAndWait(
  socket: net.Socket,
  command: string,
  timeoutMs: number,
): Promise<string> {
  return writeBufferAndWait(socket, Buffer.from(command, 'utf8'), timeoutMs);
}

async function writeBufferAndWait(
  socket: net.Socket,
  command: Buffer,
  timeoutMs: number,
): Promise<string> {
  const response = waitForResponse(socket, timeoutMs);
  socket.write(command);
  return response;
}

async function waitForResponse(
  socket: net.Socket,
  timeoutMs: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Tempo esgotado ao aguardar resposta do envio do XML'));
    }, timeoutMs);

    const cleanup = (): void => {
      clearTimeout(timer);
      socket.off('data', onData);
      socket.off('error', onError);
    };

    const onData = (data: Buffer): void => {
      cleanup();
      const response = data.toString('utf8').trim();
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

    socket.once('data', onData);
    socket.once('error', onError);
  });
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
  return response.includes('IPC_PARAMS') || response.includes('API_NO_MEMORY');
}

function uploadPlanSummary(plan: WlConfigUploadPlan): string {
  return `bytesDeclarados=${plan.fileSizeBytes} totalBytesFragmentos=${plan.totalChunkBytes} quantidadeFragmentos=${plan.chunkCount} tamanhosFragmentos=${plan.chunkSizes.join(',')}`;
}
