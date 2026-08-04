import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { calculateBufferSha256, validateFileSha256 } from "../hash.js";

test("validateFileSha256 accepts matching file hash", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "nexus-update-"));
  const filePath = path.join(directory, "artifact.bin");
  const content = "artifact";

  await writeFile(filePath, content, "utf8");
  await validateFileSha256(filePath, calculateBufferSha256(content));
});

test("validateFileSha256 rejects mismatching file hash", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "nexus-update-"));
  const filePath = path.join(directory, "artifact.bin");

  await writeFile(filePath, "artifact", "utf8");
  await assert.rejects(
    () => validateFileSha256(filePath, calculateBufferSha256("other")),
    /Hash SHA-256 inválido/,
  );
});
