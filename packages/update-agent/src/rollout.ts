import { createHash, randomUUID } from "node:crypto";

export function calculateRolloutBucket(seed: string): number {
  const normalizedSeed = seed.trim();

  if (normalizedSeed.length === 0) {
    throw new Error("Seed de rollout não pode ficar vazio.");
  }

  const digest = createHash("sha256").update(normalizedSeed).digest();
  return (digest.readUInt32BE(0) % 100) + 1;
}

export function createRolloutSeed(): string {
  return randomUUID();
}

export function isRolloutEligible(bucket: number, rollout: number): boolean {
  if (!Number.isInteger(bucket) || bucket < 1 || bucket > 100) {
    throw new Error("Bucket de rollout deve ficar entre 1 e 100.");
  }

  if (!Number.isInteger(rollout) || rollout < 0 || rollout > 100) {
    throw new Error("Percentual de rollout deve ficar entre 0 e 100.");
  }

  return rollout > 0 && bucket <= rollout;
}
