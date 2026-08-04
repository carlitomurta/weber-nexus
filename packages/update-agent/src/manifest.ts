import { compareSemVer, normalizeSemVer } from "./semver.js";
import {
  NEXUS_UPDATE_ARCHITECTURES,
  NEXUS_UPDATE_ARTIFACT_KINDS,
  NEXUS_UPDATE_CHANNELS,
  NEXUS_UPDATE_PLATFORMS,
  type NexusReleaseArtifact,
  type NexusReleaseManifest,
  type NexusUpdateArchitecture,
  type NexusUpdateArtifactKind,
  type NexusUpdateChannel,
  type NexusUpdatePlatform,
} from "./types.js";

const SHA256_PATTERN = /^[a-f0-9]{64}$/i;
const COMMIT_SHA_PATTERN = /^[a-f0-9]{7,40}$/i;

export class NexusManifestValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NexusManifestValidationError";
  }
}

export function parseNexusReleaseManifest(
  input: unknown,
): NexusReleaseManifest {
  const value = parseInput(input);
  const manifest = requireObject(value, "manifesto");

  const version = normalizeSemVer(requireString(manifest, "version"));
  const desktopVersion = normalizeSemVer(
    requireString(manifest, "desktop_version"),
  );
  const runtimeVersion = normalizeSemVer(
    requireString(manifest, "runtime_version"),
  );
  const minimumAgentVersion = normalizeSemVer(
    requireString(manifest, "minimum_agent_version"),
  );
  const channel = requireEnum(
    manifest,
    "channel",
    NEXUS_UPDATE_CHANNELS,
  ) as NexusUpdateChannel;
  const rollout = requireIntegerInRange(manifest, "rollout", 0, 100);
  const publishedAtUtc = requireUtcTimestamp(manifest, "published_at_utc");
  const commitSha = requirePattern(
    manifest,
    "commit_sha",
    COMMIT_SHA_PATTERN,
    "commit SHA inválido.",
  );
  const platforms = requireEnumArray(
    manifest,
    "platforms",
    NEXUS_UPDATE_PLATFORMS,
  ) as NexusUpdatePlatform[];
  const artifacts = requireArtifacts(manifest, platforms);

  if (desktopVersion !== version || runtimeVersion !== version) {
    throw new NexusManifestValidationError(
      "Desktop, Runtime e manifesto devem usar a mesma versão.",
    );
  }

  return {
    version,
    channel,
    rollout,
    published_at_utc: publishedAtUtc,
    commit_sha: commitSha,
    minimum_agent_version: minimumAgentVersion,
    platforms,
    artifacts,
    desktop_version: desktopVersion,
    runtime_version: runtimeVersion,
    sqlite_schema_version: requireNonEmptyString(
      manifest,
      "sqlite_schema_version",
    ),
    influx_schema_version: requireNonEmptyString(
      manifest,
      "influx_schema_version",
    ),
    requires_reboot: requireBoolean(manifest, "requires_reboot"),
    release_notes: requireString(manifest, "release_notes"),
  };
}

export function findManifestArtifact(
  manifest: NexusReleaseManifest,
  platform: NexusUpdatePlatform,
  arch: NexusUpdateArchitecture,
): NexusReleaseArtifact | undefined {
  return manifest.artifacts.find(
    (artifact) => artifact.platform === platform && artifact.arch === arch,
  );
}

export function assertAgentVersionCompatibility(
  manifest: NexusReleaseManifest,
  currentAgentVersion: string,
): void {
  if (compareSemVer(currentAgentVersion, manifest.minimum_agent_version) < 0) {
    throw new NexusManifestValidationError(
      "Versão do Agent incompatível com esta atualização.",
    );
  }
}

function parseInput(input: unknown): unknown {
  if (typeof input !== "string" && !Buffer.isBuffer(input)) {
    return input;
  }

  try {
    return JSON.parse(input.toString());
  } catch {
    throw new NexusManifestValidationError(
      "Manifesto Nexus não contém JSON válido.",
    );
  }
}

function requireObject(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new NexusManifestValidationError(`${label} deve ser um objeto.`);
  }

  return value as Record<string, unknown>;
}

function requireString(
  object: Record<string, unknown>,
  field: string,
): string {
  const value = object[field];

  if (typeof value !== "string") {
    throw new NexusManifestValidationError(`${field} deve ser texto.`);
  }

  return value;
}

function requireNonEmptyString(
  object: Record<string, unknown>,
  field: string,
): string {
  const value = requireString(object, field).trim();

  if (value.length === 0) {
    throw new NexusManifestValidationError(`${field} não pode ficar vazio.`);
  }

  return value;
}

function requireBoolean(
  object: Record<string, unknown>,
  field: string,
): boolean {
  const value = object[field];

  if (typeof value !== "boolean") {
    throw new NexusManifestValidationError(`${field} deve ser booleano.`);
  }

  return value;
}

function requireIntegerInRange(
  object: Record<string, unknown>,
  field: string,
  min: number,
  max: number,
): number {
  const value = object[field];

  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < min ||
    value > max
  ) {
    throw new NexusManifestValidationError(
      `${field} deve ser inteiro entre ${min} e ${max}.`,
    );
  }

  return value;
}

function requirePattern(
  object: Record<string, unknown>,
  field: string,
  pattern: RegExp,
  message: string,
): string {
  const value = requireNonEmptyString(object, field);

  if (!pattern.test(value)) {
    throw new NexusManifestValidationError(`${field}: ${message}`);
  }

  return value;
}

function requireUtcTimestamp(
  object: Record<string, unknown>,
  field: string,
): string {
  const value = requireNonEmptyString(object, field);
  const parsed = Date.parse(value);

  if (Number.isNaN(parsed) || !value.endsWith("Z")) {
    throw new NexusManifestValidationError(
      `${field} deve ser timestamp UTC ISO-8601.`,
    );
  }

  return new Date(parsed).toISOString();
}

function requireEnum<TValue extends string>(
  object: Record<string, unknown>,
  field: string,
  allowedValues: readonly TValue[],
): TValue {
  const value = requireNonEmptyString(object, field);

  if (!allowedValues.includes(value as TValue)) {
    throw new NexusManifestValidationError(
      `${field} possui valor não suportado: ${value}.`,
    );
  }

  return value as TValue;
}

function requireEnumArray<TValue extends string>(
  object: Record<string, unknown>,
  field: string,
  allowedValues: readonly TValue[],
): TValue[] {
  const value = object[field];

  if (!Array.isArray(value) || value.length === 0) {
    throw new NexusManifestValidationError(`${field} deve ser lista não vazia.`);
  }

  return value.map((item) => {
    if (typeof item !== "string" || !allowedValues.includes(item as TValue)) {
      throw new NexusManifestValidationError(
        `${field} possui item não suportado: ${String(item)}.`,
      );
    }

    return item as TValue;
  });
}

function requireArtifacts(
  object: Record<string, unknown>,
  platforms: NexusUpdatePlatform[],
): NexusReleaseArtifact[] {
  const value = object.artifacts;

  if (!Array.isArray(value) || value.length === 0) {
    throw new NexusManifestValidationError(
      "artifacts deve ser lista não vazia.",
    );
  }

  return value.map((item, index) => {
    const artifact = requireObject(item, `artifacts[${index}]`);
    const platform = requireEnum(
      artifact,
      "platform",
      NEXUS_UPDATE_PLATFORMS,
    ) as NexusUpdatePlatform;
    const arch = requireEnum(
      artifact,
      "arch",
      NEXUS_UPDATE_ARCHITECTURES,
    ) as NexusUpdateArchitecture;
    const kind = requireEnum(
      artifact,
      "kind",
      NEXUS_UPDATE_ARTIFACT_KINDS,
    ) as NexusUpdateArtifactKind;

    if (!platforms.includes(platform)) {
      throw new NexusManifestValidationError(
        `Artefato usa plataforma não listada no manifesto: ${platform}.`,
      );
    }

    const artifactUrl = requireUrl(artifact, "artifact_url");
    const artifactSha256 = requirePattern(
      artifact,
      "artifact_sha256",
      SHA256_PATTERN,
      "hash SHA-256 inválido.",
    ).toLowerCase();

    return {
      platform,
      arch,
      kind,
      file_name: requireNonEmptyString(artifact, "file_name"),
      artifact_url: artifactUrl,
      artifact_sha256: artifactSha256,
      artifact_size_bytes: requireIntegerInRange(
        artifact,
        "artifact_size_bytes",
        1,
        Number.MAX_SAFE_INTEGER,
      ),
    };
  });
}

function requireUrl(object: Record<string, unknown>, field: string): string {
  const value = requireNonEmptyString(object, field);

  try {
    const url = new URL(value);
    if (url.protocol !== "https:") {
      throw new Error("invalid protocol");
    }
  } catch {
    throw new NexusManifestValidationError(
      `${field} deve ser uma URL HTTPS válida.`,
    );
  }

  return value;
}
