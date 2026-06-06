import { connectTCP } from "./tcp.js";

export async function getDXMHoldingRegisters(): Promise<number[]> {
  try {
    const client = await connectTCP("192.168.1.1", 502, 1);

    const result = await client.readHoldingRegisters(0, 10);

    client.close();

    return result.data;
  } catch (error) {
    throw new Error("Erro ao conectar ao DXM", { cause: error });
  }
}
