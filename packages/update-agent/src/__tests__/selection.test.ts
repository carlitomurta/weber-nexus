import test from "node:test";
import assert from "node:assert/strict";
import { selectNexusUpdateCandidate } from "../selection.js";
import { createManifestFixture } from "./fixtures.js";

test("selectNexusUpdateCandidate accepts newer version in configured channel", () => {
  const selection = selectNexusUpdateCandidate({
    manifest: createManifestFixture(),
    installedVersion: "1.2.2",
    configuredChannel: "stable",
    currentAgentVersion: "1.0.0",
    platform: "windows",
    arch: "x64",
    rolloutBucket: 100,
  });

  assert.equal(selection.eligible, true);
  assert.equal(selection.reason, "eligible");
});

test("selectNexusUpdateCandidate rejects downgrade or same version", () => {
  const selection = selectNexusUpdateCandidate({
    manifest: createManifestFixture(),
    installedVersion: "1.2.3",
    configuredChannel: "stable",
    currentAgentVersion: "1.0.0",
    platform: "windows",
    arch: "x64",
    rolloutBucket: 1,
  });

  assert.equal(selection.eligible, false);
  assert.equal(selection.reason, "version_not_newer");
});

test("selectNexusUpdateCandidate rejects channel mismatch", () => {
  const selection = selectNexusUpdateCandidate({
    manifest: createManifestFixture({ channel: "beta" }),
    installedVersion: "1.2.2",
    configuredChannel: "stable",
    currentAgentVersion: "1.0.0",
    platform: "windows",
    arch: "x64",
    rolloutBucket: 1,
  });

  assert.equal(selection.eligible, false);
  assert.equal(selection.reason, "channel_not_configured");
});
