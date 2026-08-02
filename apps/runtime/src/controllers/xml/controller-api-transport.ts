import net from 'node:net';
import type { ControllerResponseReader } from './controller-api-response';

export async function connectSocket(
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

export async function writeCommandAndWait(
  reader: ControllerResponseReader,
  socket: net.Socket,
  command: string,
): Promise<string> {
  return writeBufferAndWait(reader, socket, Buffer.from(command, 'utf8'));
}

export async function writeCommand(
  socket: net.Socket,
  command: string,
  timeoutMs: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Tempo esgotado ao enviar comando para o controlador'));
    }, timeoutMs);

    const cleanup = (): void => {
      clearTimeout(timer);
      socket.off('error', onError);
    };

    const onError = (error: Error): void => {
      cleanup();
      reject(
        new Error('Erro de conexão ao enviar comando para o controlador', {
          cause: error,
        }),
      );
    };

    socket.once('error', onError);
    socket.write(command, 'utf8', () => {
      cleanup();
      resolve();
    });
  });
}

export async function writeBufferAndWait(
  reader: ControllerResponseReader,
  socket: net.Socket,
  command: Buffer,
): Promise<string> {
  const response = reader.waitForResponse();
  socket.write(command);
  return response;
}
