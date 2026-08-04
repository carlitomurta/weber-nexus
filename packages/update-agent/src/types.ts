export const NEXUS_UPDATE_CHANNELS = ["internal", "beta", "stable"] as const;
export const NEXUS_UPDATE_PLATFORMS = ["windows", "linux"] as const;
export const NEXUS_UPDATE_ARCHITECTURES = ["x64", "arm64"] as const;
export const NEXUS_UPDATE_ARTIFACT_KINDS = [
  "nsis",
  "appimage",
  "deb",
] as const;
export const NEXUS_UPDATE_STATE_NAMES = [
  "idle",
  "checking",
  "update_available",
  "downloading",
  "downloaded",
  "validating",
  "ready_to_install",
  "preparing_runtime",
  "stopping_services",
  "installing",
  "starting_runtime",
  "migrating_sqlite",
  "migrating_influx",
  "health_check",
  "healthy",
  "maintenance",
  "failed",
] as const;

export type NexusUpdateChannel = (typeof NEXUS_UPDATE_CHANNELS)[number];
export type NexusUpdatePlatform = (typeof NEXUS_UPDATE_PLATFORMS)[number];
export type NexusUpdateArchitecture =
  (typeof NEXUS_UPDATE_ARCHITECTURES)[number];
export type NexusUpdateArtifactKind =
  (typeof NEXUS_UPDATE_ARTIFACT_KINDS)[number];

export type NexusReleaseArtifact = {
  platform: NexusUpdatePlatform;
  arch: NexusUpdateArchitecture;
  kind: NexusUpdateArtifactKind;
  file_name: string;
  artifact_url: string;
  artifact_sha256: string;
  artifact_size_bytes: number;
};

export type NexusReleaseManifest = {
  version: string;
  channel: NexusUpdateChannel;
  rollout: number;
  published_at_utc: string;
  commit_sha: string;
  minimum_agent_version: string;
  platforms: NexusUpdatePlatform[];
  artifacts: NexusReleaseArtifact[];
  desktop_version: string;
  runtime_version: string;
  sqlite_schema_version: string;
  influx_schema_version: string;
  requires_reboot: boolean;
  release_notes: string;
};

export type NexusUpdateStateName = (typeof NEXUS_UPDATE_STATE_NAMES)[number];
