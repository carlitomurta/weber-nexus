import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  createUpdateAgentState,
  loadUpdateAgentState,
  parseUpdateAgentState,
  saveUpdateAgentState,
} from "../agent-state.js";

test("createUpdateAgentState creates stable configured defaults", () => {
  const state = createUpdateAgentState({
    installedVersion: "1.0.0",
    rolloutSeed: "installation-a",
  });

  assert.equal(state.configured_channel, "stable");
  assert.equal(state.status, "idle");
  assert.equal(state.rollout_bucket >= 1 && state.rollout_bucket <= 100, true);
});

test("loadUpdateAgentState creates and reloads state file", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "nexus-state-"));
  const statePath = path.join(directory, "state.json");

  const created = await loadUpdateAgentState(statePath, {
    installedVersion: "1.0.0",
    configuredChannel: "internal",
    rolloutSeed: "installation-a",
  });
  created.last_error = "Falha simulada.";
  await saveUpdateAgentState(statePath, created);

  const loaded = await loadUpdateAgentState(statePath, {
    installedVersion: "0.0.1",
  });

  assert.equal(loaded.installed_version, "1.0.0");
  assert.equal(loaded.configured_channel, "internal");
  assert.equal(loaded.last_error, "Falha simulada.");
});

test("parseUpdateAgentState normalizes unsupported status to idle", () => {
  const state = parseUpdateAgentState(
    JSON.stringify({
      installed_version: "1.0.0",
      configured_channel: "stable",
      rollout_bucket: 10,
      status: "unknown",
    }),
  );

  assert.equal(state.status, "idle");
});
