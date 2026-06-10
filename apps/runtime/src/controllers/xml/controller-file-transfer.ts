import net from 'node:net';

const WLCONFIG_FILENAME = 'WLConfig.xml';
const CONTROLLER_API_PORT = 8844;
const MAX_CHUNK_BYTES = 512;
const DEFAULT_TIMEOUT_MS = 10000;

export type ControllerFileTransferOptions = {
  readonly host: string;
  readonly timeoutMs?: number;
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
      fail(new Error('Controller XML download timed out'));
    });

    socket.on('error', (error) => {
      fail(new Error('Controller XML download connection error', { cause: error }));
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
          fail(new Error(`Unexpected controller XML open response: ${trimmed}`));
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
  const encodedXml = encodeXmlForController(xml);
  const chunks = chunkBuffer(encodedXml, MAX_CHUNK_BYTES);

  try {
    await writeCommandAndWait(socket, 'CMD1003\r\n', timeoutMs);

    const openResponse = await writeCommandAndWait(
      socket,
      `CMD1001 ${WLCONFIG_FILENAME},1,${encodedXml.length},0\r\n`,
      timeoutMs,
    );
    assertExpectedResponse(openResponse, 'RSP1001');

    for (let index = 0; index < chunks.length; index += 1) {
      const chunk = chunks[index];
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

      assertExpectedResponse(response, 'RSP1002');
    }

    const closeResponse = await writeCommandAndWait(socket, 'CMD1003\r\n', timeoutMs);
    assertExpectedResponse(closeResponse, 'RSP1003');
  } finally {
    socket.end();
  }
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

async function connectSocket(host: string, timeoutMs: number): Promise<net.Socket> {
  const socket = new net.Socket();

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error('Controller XML upload connection timed out'));
    }, timeoutMs);

    socket.once('error', (error) => {
      clearTimeout(timer);
      reject(new Error('Controller XML upload connection error', { cause: error }));
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
      reject(new Error('Controller XML upload response timed out'));
    }, timeoutMs);

    const cleanup = (): void => {
      clearTimeout(timer);
      socket.off('data', onData);
      socket.off('error', onError);
    };

    const onData = (data: Buffer): void => {
      cleanup();
      const response = data.toString('utf8').trim();
      rejectApiError(response);
      resolve(response);
    };

    const onError = (error: Error): void => {
      cleanup();
      reject(new Error('Controller XML upload connection error', { cause: error }));
    };

    socket.once('data', onData);
    socket.once('error', onError);
  });
}

function assertExpectedResponse(response: string, expectedPrefix: string): void {
  rejectApiError(response);

  if (!response.startsWith(expectedPrefix)) {
    throw new Error(`Unexpected controller response: ${response}`);
  }
}

function rejectApiError(response: string): void {
  if (response.includes('IPC_PARAMS') || response.includes('API_NO_MEMORY')) {
    throw new Error(`Controller rejected XML transfer: ${response}`);
  }
}
