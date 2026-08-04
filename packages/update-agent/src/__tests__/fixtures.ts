import { calculateBufferSha256 } from "../hash.js";
import type { NexusReleaseManifest } from "../types.js";

const artifactContent = "nexus-artifact";

export function createManifestFixture(
  overrides: Partial<NexusReleaseManifest> = {},
): NexusReleaseManifest {
  const version = overrides.version ?? "1.2.3";

  return {
    version,
    channel: "stable",
    rollout: 100,
    published_at_utc: "2026-08-03T12:00:00.000Z",
    commit_sha: "1234567890abcdef",
    minimum_agent_version: "1.0.0",
    platforms: ["windows", "linux"],
    artifacts: [
      {
        platform: "windows",
        arch: "x64",
        kind: "nsis",
        file_name: `Nexus-win64-${version}.exe`,
        artifact_url: "https://github.com/acme/nexus/releases/download/v1.2.3/Nexus.exe",
        artifact_sha256: calculateBufferSha256(artifactContent),
        artifact_size_bytes: Buffer.byteLength(artifactContent),
      },
      {
        platform: "linux",
        arch: "x64",
        kind: "appimage",
        file_name: `Nexus-linux-${version}.AppImage`,
        artifact_url:
          "https://github.com/acme/nexus/releases/download/v1.2.3/Nexus.AppImage",
        artifact_sha256: calculateBufferSha256(artifactContent),
        artifact_size_bytes: Buffer.byteLength(artifactContent),
      },
    ],
    desktop_version: version,
    runtime_version: version,
    sqlite_schema_version: "11",
    influx_schema_version: "1",
    requires_reboot: false,
    release_notes: "Correções operacionais.",
    ...overrides,
  };
}
