import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { calculateRolloutBucket, createRolloutSeed } from "./rollout.js";
import {
  NEXUS_UPDATE_CHANNELS,
  NEXUS_UPDATE_STATE_NAMES,
  type NexusUpdateChannel,
  type NexusUpdateStateName,
} from "./types.js";

export type NexusUpdateAgentState = {
  installed_version: string;
  configured_channel: NexusUpdateChannel;
  last_check_at_utc: string | null;
  last_available_version: string | null;
  last_downloaded_version: string | null;
  last_error: string | null;
  pending_install: boolean;
  rollout_bucket: number;
  status: NexusUpdateStateName;
};

export type CreateUpdateAgentStateInput = {
  installedVersion: string;
  configuredChannel?: NexusUpdateChannel;
  rolloutSeed?: string;
};

export function createUpdateAgentState(
  input: CreateUpdateAgentStateInput,
): NexusUpdateAgentState {
  return {
    installed_version: input.installedVersion,
    configured_channel: input.configuredChannel ?? "stable",
    last_check_at_utc: null,
    last_available_version: null,
    last_downloaded_version: null,
    last_error: null,
    pending_install: false,
    rollout_bucket: calculateRolloutBucket(input.rolloutSeed ?? createRolloutSeed()),
    status: "idle",
  };
}

export async function loadUpdateAgentState(
  statePath: string,
  fallback: CreateUpdateAgentStateInput,
): Promise<NexusUpdateAgentState> {
  try {
    return parseUpdateAgentState(await readFile(statePath, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      const state = createUpdateAgentState(fallback);
      await saveUpdateAgentState(statePath, state);
      return state;
    }

    throw error;
  }
}

export async function saveUpdateAgentState(
  statePath: string,
  state: NexusUpdateAgentState,
): Promise<void> {
  const directory = path.dirname(statePath);
  const temporaryPath = path.join(
    directory,
    `.nexus-update-state-${process.pid}.tmp`,
  );

  await mkdir(directory, { recursive: true });
  await writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  await rename(temporaryPath, statePath);
}

export function parseUpdateAgentState(input: string): NexusUpdateAgentState {
  const value = JSON.parse(input) as Partial<NexusUpdateAgentState>;

  if (
    typeof value.installed_version !== "string" ||
    !NEXUS_UPDATE_CHANNELS.includes(value.configured_channel as NexusUpdateChannel) ||
    typeof value.rollout_bucket !== "number" ||
    !Number.isInteger(value.rollout_bucket) ||
    value.rollout_bucket < 1 ||
    value.rollout_bucket > 100
  ) {
    throw new Error("Estado local do Agent está inválido.");
  }

  const status =
    typeof value.status === "string" &&
    NEXUS_UPDATE_STATE_NAMES.includes(value.status as NexusUpdateStateName)
      ? (value.status as NexusUpdateStateName)
      : "idle";

  return {
    installed_version: value.installed_version,
    configured_channel: value.configured_channel as NexusUpdateChannel,
    last_check_at_utc: nullableString(value.last_check_at_utc),
    last_available_version: nullableString(value.last_available_version),
    last_downloaded_version: nullableString(value.last_downloaded_version),
    last_error: nullableString(value.last_error),
    pending_install: value.pending_install === true,
    rollout_bucket: value.rollout_bucket,
    status,
  };
}

export function utcNowIso(): string {
  return new Date().toISOString();
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}
