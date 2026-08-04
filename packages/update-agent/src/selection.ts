import { isChannelEligible } from "./channel.js";
import { findManifestArtifact } from "./manifest.js";
import { compareSemVer, isSemVerUpgrade } from "./semver.js";
import { isRolloutEligible } from "./rollout.js";
import type {
  NexusReleaseArtifact,
  NexusReleaseManifest,
  NexusUpdateArchitecture,
  NexusUpdateChannel,
  NexusUpdatePlatform,
} from "./types.js";

export type NexusUpdateCandidateInput = {
  manifest: NexusReleaseManifest;
  installedVersion: string;
  configuredChannel: NexusUpdateChannel;
  currentAgentVersion: string;
  platform: NexusUpdatePlatform;
  arch: NexusUpdateArchitecture;
  rolloutBucket: number;
};

export type NexusUpdateCandidateSelection =
  | {
      eligible: true;
      artifact: NexusReleaseArtifact;
      reason: "eligible";
    }
  | {
      eligible: false;
      reason:
        | "version_not_newer"
        | "agent_version_incompatible"
        | "channel_not_configured"
        | "rollout_not_selected"
        | "platform_not_available";
      message: string;
    };

export function selectNexusUpdateCandidate(
  input: NexusUpdateCandidateInput,
): NexusUpdateCandidateSelection {
  if (!isSemVerUpgrade(input.manifest.version, input.installedVersion)) {
    return {
      eligible: false,
      reason: "version_not_newer",
      message: "Atualização ignorada porque a versão não é mais nova.",
    };
  }

  if (
    compareSemVer(input.currentAgentVersion, input.manifest.minimum_agent_version) <
    0
  ) {
    return {
      eligible: false,
      reason: "agent_version_incompatible",
      message: "Agent atual não é compatível com esta atualização.",
    };
  }

  if (!isChannelEligible(input.manifest.channel, input.configuredChannel)) {
    return {
      eligible: false,
      reason: "channel_not_configured",
      message: "Atualização ignorada porque pertence a outro canal.",
    };
  }

  if (!isRolloutEligible(input.rolloutBucket, input.manifest.rollout)) {
    return {
      eligible: false,
      reason: "rollout_not_selected",
      message: "Instalação fora do percentual de rollout desta versão.",
    };
  }

  const artifact = findManifestArtifact(
    input.manifest,
    input.platform,
    input.arch,
  );

  if (!artifact) {
    return {
      eligible: false,
      reason: "platform_not_available",
      message: "Atualização não possui artefato compatível com a plataforma.",
    };
  }

  return {
    eligible: true,
    artifact,
    reason: "eligible",
  };
}
