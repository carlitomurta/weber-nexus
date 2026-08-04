import { copyFile, mkdir, readdir } from "node:fs/promises";
import path from "node:path";

const tag = readOption("--tag");
const version = readOption("--version") ?? (tag?.startsWith("v") ? tag.slice(1) : tag);
const outputDir = path.resolve(readOption("--output") ?? "release-artifacts");

if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  fail("Informe --version MAJOR.MINOR.PATCH.");
}

const releaseDir = path.resolve("release", version);
const artifactPaths = await findReleaseArtifacts(releaseDir);

if (artifactPaths.length === 0) {
  fail(`Nenhum artefato encontrado em ${releaseDir}.`);
}

await mkdir(outputDir, { recursive: true });

for (const artifactPath of artifactPaths) {
  await copyFile(artifactPath, path.join(outputDir, path.basename(artifactPath)));
}

console.log(
  `Coletados ${artifactPaths.length} artefato(s) em ${path.relative(process.cwd(), outputDir)}.`,
);

async function findReleaseArtifacts(directory) {
  const results = [];

  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      results.push(...(await findReleaseArtifacts(entryPath)));
      continue;
    }

    if (isReleaseArtifact(entry.name)) {
      results.push(entryPath);
    }
  }

  return results.sort();
}

function isReleaseArtifact(fileName) {
  return (
    /\.(exe|AppImage|deb|blockmap)$/i.test(fileName) ||
    /^latest.*\.ya?ml$/i.test(fileName)
  );
}

function readOption(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
