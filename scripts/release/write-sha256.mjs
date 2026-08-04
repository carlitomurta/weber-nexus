import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const targetDir = path.resolve(process.argv[2] ?? "release-artifacts");
const files = await findFiles(targetDir);
let written = 0;

for (const filePath of files) {
  if (filePath.endsWith(".sha256")) continue;

  const sha256 = await calculateFileSha256(filePath);
  const checksumPath = `${filePath}.sha256`;

  await writeFile(
    checksumPath,
    `${sha256}  ${path.basename(filePath)}\n`,
    "utf8",
  );
  written += 1;
}

console.log(`Gerados ${written} hash(es) SHA-256.`);

async function findFiles(directory) {
  const results = [];

  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      results.push(...(await findFiles(entryPath)));
      continue;
    }

    results.push(entryPath);
  }

  return results.sort();
}

async function calculateFileSha256(filePath) {
  const hash = createHash("sha256");

  await new Promise((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", resolve);
  });

  return hash.digest("hex");
}
