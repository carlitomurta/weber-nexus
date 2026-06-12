import { Logger } from "@weber-nexus/logger";
import net from "node:net";
import { createRequire } from "node:module";

type ModbusRTUConstructor = new () => ModbusRTUClient;
type ModbusRTUClient = {
  readonly isOpen: boolean;
  close(callback?: () => void): void;
  connectTCP(host: string, options: { port: number }): Promise<void>;
  readHoldingRegisters(
    address: number,
    length: number,
  ): Promise<{ data: number[] }>;
  setID(id: number): void;
  setTimeout(duration: number): void;
};

const logger = new Logger("modbus");

const require = createRequire(import.meta.url);
const ModbusRTU = require("modbus-serial") as ModbusRTUConstructor;
const MODBUS_TCP_PORT = 502;
const HOST_API_PORT = 8844;

export type ConnectionProtocol = "modbus-tcp" | "host-api";

export type ControllerConnectionConfig = {
  protocol?: ConnectionProtocol;
  host: string;
  unitId?: number;
  timeoutMs?: number;
};

export type HoldingRegisterRead = {
  address: number;
  values: number[];
};

export interface ControllerConnection {
  readonly protocol: ConnectionProtocol;
  connect(): Promise<void>;
  close(): Promise<void>;
  readHoldingRegisters(
    unitId: number,
    registers: number[],
  ): Promise<HoldingRegisterRead[]>;
}

export function createControllerConnection(
  config: ControllerConnectionConfig,
): ControllerConnection {
  switch (config.protocol ?? "modbus-tcp") {
    case "modbus-tcp":
      return new ModbusTcpConnection(config);
    case "host-api":
      return new HostApiConnection(config);
    default:
      throw new Error(`Protocolo de conexão não suportado: ${config.protocol}`);
  }
}

export class ModbusTcpConnection implements ControllerConnection {
  readonly protocol = "modbus-tcp";

  private readonly client = new ModbusRTU();
  private connected = false;

  constructor(private readonly config: ControllerConnectionConfig) {}

  async connect(): Promise<void> {
    if (this.connected && this.client.isOpen) return;

    this.client.setTimeout(this.config.timeoutMs ?? 5000);
    await this.client.connectTCP(this.config.host, { port: MODBUS_TCP_PORT });
    this.connected = true;
    logger.info(`Controlador conectado IP:${this.config.host}`);
  }

  async close(): Promise<void> {
    if (!this.connected && !this.client.isOpen) return;

    await new Promise<void>((resolve) => {
      this.client.close(() => resolve());
    });
    this.connected = false;
    logger.info(`Conexão do controlador encerrada IP:${this.config.host}`);
  }

  async readHoldingRegisters(
    unitId: number,
    registers: number[],
  ): Promise<HoldingRegisterRead[]> {
    await this.connect();
    this.client.setID(unitId);

    if (registers.length === 0) return [];

    const readLength = Math.max(...registers);

    logger.info(
      `Lendo controlador IP:${this.config.host} ${registers.length} registradores holding locais até ${readLength}`,
    );
    const result = await this.client.readHoldingRegisters(0, readLength);

    if (result.data.length < readLength) {
      throw new Error(
        `Esperados ${readLength} valores de registrador holding, recebidos ${result.data.length}`,
      );
    }

    return registers.map((address) => ({
      address,
      values: [result.data[address - 1]],
    }));
  }
}

export class HostApiConnection implements ControllerConnection {
  readonly protocol = "host-api";

  private socket?: net.Socket;
  private buffered = "";

  constructor(private readonly config: ControllerConnectionConfig) {}

  async connect(): Promise<void> {
    if (this.socket && !this.socket.destroyed) return;

    this.socket = await connectHostApiSocket(
      this.config.host,
      this.config.timeoutMs ?? 5000,
    );
    this.socket.on("data", (data) => {
      this.buffered += data.toString("utf8");
    });
    logger.info(`Controlador conectado IP:${this.config.host} via Host API`);
  }

  async close(): Promise<void> {
    const socket = this.socket;
    this.socket = undefined;
    this.buffered = "";

    if (!socket || socket.destroyed) return;

    socket.end();
    logger.info(
      `Conexão Host API do controlador encerrada IP:${this.config.host}`,
    );
  }

  async readHoldingRegisters(
    _unitId: number,
    registers: number[],
  ): Promise<HoldingRegisterRead[]> {
    await this.connect();

    if (registers.length === 0) return [];

    const socket = this.socket;

    if (!socket || socket.destroyed) {
      throw new Error(
        `Conexão Host API indisponível para ${this.config.host}`,
      );
    }

    logger.info(
      `Lendo controlador IP:${this.config.host} ${registers.length} registradores locais via Host API`,
    );

    const readLength = Math.max(...registers);
    const values = await this.readLocalRegisterRange(socket, readLength);

    return registers.map((address) => ({
      address,
      values: [values[address - 1]],
    }));
  }

  private readLocalRegisterRange(
    socket: net.Socket,
    length: number,
  ): Promise<number[]> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(
          new Error(
            `Tempo esgotado ao ler registradores locais via Host API em ${this.config.host}`,
          ),
        );
      }, this.config.timeoutMs ?? 5000);

      const cleanup = (): void => {
        clearTimeout(timeout);
        socket.off("data", onData);
        socket.off("error", onError);
      };

      const tryResolve = (): void => {
        let values: number[] | undefined;

        try {
          values = parseHostApiLocalRegisterResponse(this.buffered, length);
        } catch (error) {
          cleanup();
          reject(error);
          return;
        }

        if (!values) return;

        this.buffered = "";
        cleanup();
        resolve(values);
      };

      const onData = (): void => {
        tryResolve();
      };

      const onError = (error: Error): void => {
        cleanup();
        reject(
          new Error(
            `Erro de conexão durante leitura Host API em ${this.config.host}`,
            { cause: error },
          ),
        );
      };

      socket.on("data", onData);
      socket.once("error", onError);
      socket.write(`CMD0001 1,${length},0,0,0\r\n`);
      tryResolve();
    });
  }
}

async function connectHostApiSocket(
  host: string,
  timeoutMs: number,
): Promise<net.Socket> {
  const socket = new net.Socket();

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error(`Tempo esgotado ao conectar Host API em ${host}`));
    }, timeoutMs);

    socket.once("error", (error) => {
      clearTimeout(timeout);
      reject(
        new Error(`Erro ao conectar Host API em ${host}`, { cause: error }),
      );
    });

    socket.connect(HOST_API_PORT, host, () => {
      clearTimeout(timeout);
      socket.removeAllListeners("error");
      socket.on("error", () => undefined);
      resolve(socket);
    });
  });
}

function parseHostApiLocalRegisterResponse(
  response: string,
  length: number,
): number[] | undefined {
  if (response.includes("IPC_PARAMS") || response.includes("API_")) {
    throw new Error(`Controlador rejeitou leitura Host API: ${response}`);
  }

  const match = response.trim().match(/^RSP0001\s*(\d+),(.+)$/s);

  if (!match) return undefined;

  const startAddress = Number(match[1]);

  if (startAddress !== 1) {
    throw new Error(`Resposta Host API iniciou no registrador ${startAddress}`);
  }

  const values = match[2]
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map(Number);

  if (values.length < length) return undefined;

  if (values.some((value) => !Number.isFinite(value))) {
    throw new Error(`Resposta Host API contém valor inválido: ${response}`);
  }

  return values.slice(0, length);
}
