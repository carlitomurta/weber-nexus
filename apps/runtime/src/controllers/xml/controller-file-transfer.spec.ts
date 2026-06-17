import net from 'node:net';
import {
  chunkBuffer,
  createWlConfigUploadPlan,
  downloadWlConfigXml,
  encodeXmlForController,
  formatModbusCrc16,
  readControllerLocalRegister,
  resetController,
  uploadWlConfigXml,
} from './controller-file-transfer';

describe('controller file transfer helpers', () => {
  it('encodes line endings for controller upload', () => {
    expect([...encodeXmlForController('a\r\nb\nc\rd')]).toEqual([
      0x61, 0x1e, 0x1f, 0x62, 0x1f, 0x63, 0x1e, 0x64,
    ]);
  });

  it('chunks buffers by maximum byte size', () => {
    const chunks = chunkBuffer(Buffer.from('abcdef'), 2);

    expect(chunks.map((chunk) => chunk.toString('utf8'))).toEqual([
      'ab',
      'cd',
      'ef',
    ]);
  });

  it('declares the exact encoded XML byte size and chunk totals', () => {
    const plan = createWlConfigUploadPlan('á\r\n'.repeat(260));

    expect(plan.fileSizeBytes).toBe(
      Buffer.byteLength('á\r\n'.repeat(260), 'utf8'),
    );
    expect(plan.totalChunkBytes).toBe(plan.fileSizeBytes);
    expect(plan.chunkSizes.every((size) => size <= 512)).toBe(true);
    expect(plan.chunkSizes).toEqual([512, 512, 16]);
  });

  it('formats Modbus CRC16 as wire-order uppercase hex for CMD1002', () => {
    expect(formatModbusCrc16(Buffer.from('123456789', 'utf8'))).toBe('374B');
  });

  it('calculates CRC after controller newline substitutions', () => {
    expect(formatModbusCrc16(encodeXmlForController('a\r\nb'))).toBe('F607');
  });
});

describe('controller file transfer upload protocol', () => {
  it('uploads WLConfig.xml with encoded bytes and fragmented responses', async () => {
    const received: Buffer[] = [];
    const server = await startUploadServer((command, index, socket) => {
      received.push(command);

      if (index === 0) {
        socket.write('RS');
        socket.write('P1003\r\n');
        return;
      }

      if (index === 1) {
        socket.write('RSP1001\r\n');
        return;
      }

      if (index === 2) {
        socket.write('RSP');
        socket.write('1002\r\n');
        return;
      }

      socket.write('RSP1003\r\n');
    });

    try {
      await uploadWlConfigXml('a\r\nb', {
        host: '127.0.0.1',
        port: server.port,
        timeoutMs: 1000,
      });
    } finally {
      await server.close();
    }

    expect(commandText(received[0])).toBe('CMD1003');
    expect(commandText(received[1])).toBe('CMD1001 WLConfig.xml,1,4,0');
    expect(received[2]).toEqual(
      Buffer.concat([
        Buffer.from('CMD1002 4,F607,1,', 'utf8'),
        Buffer.from([0x61, 0x1e, 0x1f, 0x62]),
      ]),
    );
    expect(commandText(received[3])).toBe('CMD1003');
  });

  it('ignores IPC_PARAMS only during preflight close', async () => {
    const received: Buffer[] = [];
    const server = await startUploadServer((command, index, socket) => {
      received.push(command);

      if (index === 0) {
        socket.write('IPC_PARAMS\r\n');
        return;
      }

      socket.write(
        index === 1
          ? 'RSP1001\r\n'
          : index === 2
            ? 'RSP1002\r\n'
            : 'RSP1003\r\n',
      );
    });

    try {
      await expect(
        uploadWlConfigXml('abc', {
          host: '127.0.0.1',
          port: server.port,
          timeoutMs: 1000,
        }),
      ).resolves.toBeUndefined();
    } finally {
      await server.close();
    }

    expect(received).toHaveLength(4);
  });

  it('accepts controller upload responses without line endings', async () => {
    const server = await startUploadServer((_command, index, socket) => {
      socket.write(
        index === 0
          ? 'RSP1003'
          : index === 1
            ? 'RSP1001'
            : index === 2
              ? 'RSP1002'
              : 'RSP1003',
      );
    });

    try {
      await expect(
        uploadWlConfigXml('abc', {
          host: '127.0.0.1',
          port: server.port,
          timeoutMs: 1000,
        }),
      ).resolves.toBeUndefined();
    } finally {
      await server.close();
    }
  });

  it('fails API_NO_MEMORY returned by file open', async () => {
    const server = await startUploadServer((_command, index, socket) => {
      socket.write(index === 0 ? 'RSP1003\r\n' : 'API_NO_MEMORY\r\n');
    });

    try {
      await expect(
        uploadWlConfigXml('abc', {
          host: '127.0.0.1',
          port: server.port,
          timeoutMs: 1000,
        }),
      ).rejects.toThrow('API_NO_MEMORY');
    } finally {
      await server.close();
    }
  });

  it('fails IPC_PARAMS returned by final close', async () => {
    const server = await startUploadServer((_command, index, socket) => {
      socket.write(
        index === 0
          ? 'RSP1003\r\n'
          : index === 1
            ? 'RSP1001\r\n'
            : index === 2
              ? 'RSP1002\r\n'
              : 'IPC_PARAMS\r\n',
      );
    });

    try {
      await expect(
        uploadWlConfigXml('abc', {
          host: '127.0.0.1',
          port: server.port,
          timeoutMs: 1000,
        }),
      ).rejects.toThrow('IPC_PARAMS');
    } finally {
      await server.close();
    }
  });
});

describe('controller reset protocol', () => {
  it('sends controller reset command without waiting for a response', async () => {
    const received: Buffer[] = [];
    let resolveReceived: () => void = () => undefined;
    const receivedCommand = new Promise<void>((resolve) => {
      resolveReceived = resolve;
    });
    const server = await startUploadServer((command, _index, socket) => {
      received.push(command);
      resolveReceived();
      socket.destroy();
    });

    try {
      await expect(
        resetController({
          host: '127.0.0.1',
          port: server.port,
          timeoutMs: 1000,
        }),
      ).resolves.toBeUndefined();
      await receivedCommand;
    } finally {
      await server.close();
    }

    expect(commandText(received[0])).toBe('CMD0200');
  });
});

describe('controller file transfer download protocol', () => {
  it('waits for a full chunk before requesting the next chunk', async () => {
    const received: Buffer[] = [];
    const server = await startUploadServer((command, index, socket) => {
      received.push(command);

      if (index === 0) {
        socket.write('RSP10015');
        return;
      }

      if (index === 1) {
        socket.write('RSP10025,ABCD,he');
        setTimeout(() => {
          socket.write('llo');
        }, 20);
        return;
      }

      if (index === 2) {
        socket.write('RSP10020,ffff,EOF');
        return;
      }

      socket.write('RSP1003');
    });

    try {
      await expect(
        downloadWlConfigXml({
          host: '127.0.0.1',
          port: server.port,
          timeoutMs: 1000,
        }),
      ).resolves.toBe('RSP10025,ABCD,helloRSP10020,ffff,EOF');
    } finally {
      await server.close();
    }

    expect(received.map(commandText)).toEqual([
      'CMD1001 WLConfig.xml,0,0,0',
      'CMD1002 1',
      'CMD1002 2',
    ]);
  });

  it('rejects malformed EOF responses as Error instances', async () => {
    const server = await startUploadServer((_command, index, socket) => {
      if (index === 0) {
        socket.write('RSP10015\r\n');
        return;
      }

      socket.write('RSP10020,ffff,BAD');
    });

    try {
      await expect(
        downloadWlConfigXml({
          host: '127.0.0.1',
          port: server.port,
          timeoutMs: 1000,
        }),
      ).rejects.toThrow(Error);
    } finally {
      await server.close();
    }
  });
});

describe('controller host API register reads', () => {
  it('reads virtual register 10101 through CMD0001', async () => {
    const received: Buffer[] = [];
    const server = await startUploadServer((command, _index, socket) => {
      received.push(command);
      socket.write('RSP000110101,42,\r\n');
    });

    try {
      await expect(
        readControllerLocalRegister(10101, {
          host: '127.0.0.1',
          port: server.port,
          timeoutMs: 1000,
        }),
      ).resolves.toBe(42);
    } finally {
      await server.close();
    }

    expect(commandText(received[0])).toBe('CMD0001 10101,1,0,0,0');
  });

  it('rejects host API register read errors', async () => {
    const server = await startUploadServer((_command, _index, socket) => {
      socket.write('API_BAD_SYNTAX\r\n');
    });

    try {
      await expect(
        readControllerLocalRegister(10101, {
          host: '127.0.0.1',
          port: server.port,
          timeoutMs: 1000,
        }),
      ).rejects.toThrow('API_BAD_SYNTAX');
    } finally {
      await server.close();
    }
  });
});

type UploadServer = {
  readonly port: number;
  close(): Promise<void>;
};

type UploadCommandHandler = (
  command: Buffer,
  index: number,
  socket: net.Socket,
) => void;

async function startUploadServer(
  onCommand: UploadCommandHandler,
): Promise<UploadServer> {
  const sockets = new Set<net.Socket>();
  const server = net.createServer((socket) => {
    sockets.add(socket);
    let buffer = Buffer.alloc(0);
    let index = 0;

    socket.on('data', (data) => {
      buffer = Buffer.concat([buffer, data]);

      for (;;) {
        const newlineIndex = buffer.indexOf(0x0a);

        if (newlineIndex < 0) return;

        const rawCommand = buffer.subarray(0, newlineIndex);
        buffer = buffer.subarray(newlineIndex + 1);
        const command =
          rawCommand.at(-1) === 0x0d
            ? rawCommand.subarray(0, rawCommand.length - 1)
            : rawCommand;

        onCommand(command, index, socket);
        index += 1;
      }
    });

    socket.on('close', () => {
      sockets.delete(socket);
    });
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();

  if (!address || typeof address === 'string') {
    throw new Error('Servidor TCP de teste não iniciou com porta válida');
  }

  return {
    port: address.port,
    async close(): Promise<void> {
      for (const socket of sockets) {
        socket.destroy();
      }

      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    },
  };
}

function commandText(command: Buffer | undefined): string {
  if (!command) return '';

  return command.toString('utf8');
}
