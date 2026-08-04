import { createHash, timingSafeEqual } from "node:crypto";
import { createReadStream } from "node:fs";

export function calculateBufferSha256(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex");
}

export async function calculateFileSha256(filePath: string): Promise<string> {
  const hash = createHash("sha256");

  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", resolve);
  });

  return hash.digest("hex");
}

export async function validateFileSha256(
  filePath: string,
  expectedSha256: string,
): Promise<void> {
  const actualSha256 = await calculateFileSha256(filePath);

  if (!safeHashEquals(actualSha256, expectedSha256)) {
    throw new Error(
      `Hash SHA-256 inválido. Esperado ${expectedSha256}, obtido ${actualSha256}.`,
    );
  }
}

export function safeHashEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left.toLowerCase(), "utf8");
  const rightBuffer = Buffer.from(right.toLowerCase(), "utf8");

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}
