import {
  assertExpectedResponse,
  ControllerDownloadResponseReader,
  ControllerResponseReader,
  isApiError,
  parseLocalRegisterResponse,
} from './controller-api-response';
import {
  connectSocket,
  writeBufferAndWait,
  writeCommand,
  writeCommandAndWait,
} from './controller-api-transport';
import {
  CONTROLLER_API_PORT,
  CONTROLLER_RESET_COMMAND,
  DEFAULT_TIMEOUT_MS,
  WLCONFIG_FILENAME,
  type ControllerFileTransferOptions,
  type WlConfigUploadPlan,
} from './controller-file-transfer.types';
import {
  createWlConfigUpload,
  formatModbusCrc16,
} from './wlconfig-upload-plan';

export type { ControllerFileTransferOptions, WlConfigUploadPlan };
export {
  chunkBuffer,
  createWlConfigUploadPlan,
  encodeXmlForController,
  formatModbusCrc16,
  modbusCrc16,
} from './wlconfig-upload-plan';

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
  const socket = await connectSocket(options.host, port, timeoutMs);
  const responseReader = new ControllerResponseReader(socket, timeoutMs);
  const downloadReader = new ControllerDownloadResponseReader(
    socket,
    timeoutMs,
  );
  const rawResponses: Buffer[] = [];

  try {
    const openResponse = await writeCommandAndWait(
      responseReader,
      socket,
      `CMD1001 ${WLCONFIG_FILENAME},0,0,0\r\n`,
    );
    assertExpectedResponse(openResponse, 'RSP1001');

    for (let chunkId = 1; ; chunkId += 1) {
      socket.write(`CMD1002 ${chunkId}\r\n`);

      const chunkResponse = await downloadReader.waitForChunkResponse();
      rawResponses.push(chunkResponse.raw);

      if (chunkResponse.eof) {
        socket.write('CMD1003\r\n');
        return Buffer.concat(rawResponses).toString('utf8');
      }
    }
  } finally {
    socket.end();
  }
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

    if (!isApiError(preflightCloseResponse)) {
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

export async function resetController(
  options: ControllerFileTransferOptions,
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const port = options.port ?? CONTROLLER_API_PORT;
  const socket = await connectSocket(options.host, port, timeoutMs);

  try {
    await writeCommand(socket, CONTROLLER_RESET_COMMAND, timeoutMs);
  } finally {
    socket.end();
  }
}
