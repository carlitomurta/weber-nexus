export type NexusSemVer = {
  major: number;
  minor: number;
  patch: number;
};

const SEMVER_PATTERN = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export function parseSemVer(version: string): NexusSemVer {
  const match = SEMVER_PATTERN.exec(version);

  if (!match) {
    throw new Error(
      `Versão inválida: ${version}. Use SemVer no formato vMAJOR.MINOR.PATCH.`,
    );
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

export function normalizeSemVer(version: string): string {
  const parsed = parseSemVer(version);
  return `${parsed.major}.${parsed.minor}.${parsed.patch}`;
}

export function compareSemVer(left: string, right: string): -1 | 0 | 1 {
  const leftVersion = parseSemVer(left);
  const rightVersion = parseSemVer(right);

  for (const key of ["major", "minor", "patch"] as const) {
    if (leftVersion[key] > rightVersion[key]) return 1;
    if (leftVersion[key] < rightVersion[key]) return -1;
  }

  return 0;
}

export function isSemVerUpgrade(candidate: string, installed: string): boolean {
  return compareSemVer(candidate, installed) === 1;
}
