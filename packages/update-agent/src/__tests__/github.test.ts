import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { calculateBufferSha256 } from "../hash.js";
import {
  downloadAndValidateArtifact,
  fetchGitHubReleaseManifests,
} from "../github.js";
import { createManifestFixture } from "./fixtures.js";

test("fetchGitHubReleaseManifests reads manifests from private release assets", async () => {
  const manifest = createManifestFixture();
  const fetchImpl: typeof fetch = async (url) => {
    if (String(url).endsWith("/releases")) {
      return jsonResponse([
        {
          tag_name: "v1.2.3",
          draft: false,
          prerelease: false,
          assets: [
            {
              name: "nexus-update-manifest.json",
              url: "https://api.github.com/assets/1",
              size: 100,
            },
          ],
        },
      ]);
    }

    return new Response(JSON.stringify(manifest), { status: 200 });
  };

  const manifests = await fetchGitHubReleaseManifests({
    owner: "weber",
    repo: "nexus",
    token: "token",
    fetchImpl,
  });

  assert.equal(manifests.length, 1);
  assert.equal(manifests[0].version, "1.2.3");
});

test("downloadAndValidateArtifact writes artifact and validates sha256", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "nexus-download-"));
  const content = "nexus-artifact";
  const artifact = {
    ...createManifestFixture().artifacts[0],
    artifact_sha256: calculateBufferSha256(content),
    artifact_size_bytes: Buffer.byteLength(content),
  };

  const filePath = await downloadAndValidateArtifact({
    artifact,
    destinationDirectory: directory,
    token: "token",
    fetchImpl: async () => new Response(content, { status: 200 }),
  });

  assert.equal(await readFile(filePath, "utf8"), content);
});

test("downloadAndValidateArtifact rejects invalid downloaded hash", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "nexus-download-"));
  const artifact = {
    ...createManifestFixture().artifacts[0],
    artifact_sha256: calculateBufferSha256("expected"),
    artifact_size_bytes: Buffer.byteLength("actual"),
  };

  await assert.rejects(
    () =>
      downloadAndValidateArtifact({
        artifact,
        destinationDirectory: directory,
        token: "token",
        fetchImpl: async () => new Response("actual", { status: 200 }),
      }),
    /Hash SHA-256 inválido/,
  );
});

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: {
      "content-type": "application/json",
    },
  });
}
