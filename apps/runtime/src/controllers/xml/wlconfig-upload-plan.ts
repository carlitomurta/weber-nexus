import { crc16modbus } from 'crc';
import {
  MAX_CHUNK_BYTES,
  type WlConfigUploadPlan,
} from './controller-file-transfer.types';

export function createWlConfigUploadPlan(xml: string): WlConfigUploadPlan {
  return createWlConfigUpload(xml).plan;
}

export function createWlConfigUpload(xml: string): {
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

export function uploadPlanSummary(plan: WlConfigUploadPlan): string {
  return `bytesDeclarados=${plan.fileSizeBytes} totalBytesFragmentos=${plan.totalChunkBytes} quantidadeFragmentos=${plan.chunkCount} tamanhosFragmentos=${plan.chunkSizes.join(',')}`;
}
