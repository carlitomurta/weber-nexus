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

const require = createRequire(import.meta.url);
const ModbusRTU = require("modbus-serial") as ModbusRTUConstructor;
const MODBUS_TCP_PORT = 502;

export type ConnectionProtocol = "modbus-tcp";

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
    default:
      throw new Error(`Unsupported connection protocol: ${config.protocol}`);
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
  }

  async close(): Promise<void> {
    if (!this.connected && !this.client.isOpen) return;

    await new Promise<void>((resolve) => {
      this.client.close(() => resolve());
    });
    this.connected = false;
  }

  async readHoldingRegisters(
    unitId: number,
    registers: number[],
  ): Promise<HoldingRegisterRead[]> {
    await this.connect();
    this.client.setID(unitId);

    const reads: HoldingRegisterRead[] = [];

    for (const address of registers) {
      const result = await this.client.readHoldingRegisters(address, 1);

      reads.push({
        address,
        values: result.data,
      });
    }

    return reads;
  }
}
