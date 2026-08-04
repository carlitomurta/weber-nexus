import test from "node:test";
import assert from "node:assert/strict";
import {
  NexusManifestValidationError,
  parseNexusReleaseManifest,
} from "../manifest.js";
import { createManifestFixture } from "./fixtures.js";

test("parseNexusReleaseManifest normalizes valid manifest versions", () => {
  const manifest = parseNexusReleaseManifest({
    ...createManifestFixture({ version: "v1.2.3" }),
    desktop_version: "1.2.3",
    runtime_version: "1.2.3",
  });

  assert.equal(manifest.version, "1.2.3");
  assert.equal(manifest.published_at_utc, "2026-08-03T12:00:00.000Z");
});

test("parseNexusReleaseManifest rejects mismatched desktop/runtime versions", () => {
  assert.throws(
    () =>
      parseNexusReleaseManifest(
        createManifestFixture({ desktop_version: "1.2.4" }),
      ),
    NexusManifestValidationError,
  );
});

test("parseNexusReleaseManifest rejects unsupported channels", () => {
  assert.throws(
    () =>
      parseNexusReleaseManifest({
        ...createManifestFixture(),
        channel: "canary",
      }),
    /channel possui valor não suportado/,
  );
});

test("parseNexusReleaseManifest rejects artifacts without valid sha256", () => {
  const manifest = createManifestFixture();
  assert.throws(
    () =>
      parseNexusReleaseManifest({
        ...manifest,
        artifacts: [
          {
            ...manifest.artifacts[0],
            artifact_sha256: "abc",
          },
        ],
      }),
    /hash SHA-256 inválido/,
  );
});
