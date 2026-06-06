import { createRequire } from "node:module";

type ModbusClient = {
  close(callback?: () => void): void;
  connectTCP(host: string, options: { port: number }): Promise<void>;
  readHoldingRegisters(
    address: number,
    length: number,
  ): Promise<{ data: number[] }>;
  setID(id: number): void;
};

type ModbusConstructor = new () => ModbusClient;

const require = createRequire(import.meta.url);
const Modbus = require("modbus-serial") as ModbusConstructor;

export async function connectTCP(ip: string, port: number, unitId: number) {
  const client = new Modbus();

  try {
    await client.connectTCP(ip, { port });

    client.setID(unitId);
  } catch (err) {
    throw new Error(String(err));
  }

  return client;
}
