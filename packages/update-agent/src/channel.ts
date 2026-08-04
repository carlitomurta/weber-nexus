import type { NexusUpdateChannel } from "./types.js";

export function isChannelEligible(
  candidateChannel: NexusUpdateChannel,
  configuredChannel: NexusUpdateChannel,
): boolean {
  return candidateChannel === configuredChannel;
}
