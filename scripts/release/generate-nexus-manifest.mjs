import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const assetsJsonPath = readRequiredOption("--assets-json");
const assetsRoot = path.resolve(readOption("--assets-root") ?? "release-assets");
const outputPath = path.resolve(
  readOption("--output") ?? path.join(assetsRoot, "nexus-update-manifest.json"),
);
const tag = readOption("--tag") ?? process.env.GITHUB_REF_NAME;
const commitSha = readOption("--commit") ?? process.env.GITHUB_SHA;
const channel =
  readOption("--channel") ?? process.env.NEXUS_RELEASE_CHANNEL ?? "internal";
const rollout = Number(
  readOption("--rollout") ?? process.env.NEXUS_RELEASE_ROLLOUT ?? "100",
);
const minimumAgentVersion =
  readOption("--minimum-agent-version") ??
  process.env.NEXUS_MINIMUM_AGENT_VERSION ??
  "1.0.0";

if (!tag || !/^v\d+\.\d+\.\d+$/.test(tag)) {
  fail(`Tag inválida: ${tag ?? "<vazia>"}.`);
}

if (!commitSha || !/^[a-f0-9]{7,40}$/i.test(commitSha)) {
  fail(`Commit SHA inválido: ${commitSha ?? "<vazio>"}.`);
}

if (!["internal", "beta", "stable"].includes(channel)) {
  fail(`Canal inválido: ${channel}.`);
}

if (!Number.isInteger(rollout) || rollout < 0 || rollout > 100) {
  fail("Rollout deve ser inteiro entre 0 e 100.");
}

const version = tag.slice(1);
const [rootPackage, desktopPackage, runtimePackage, journal, assets] =
  await Promise.all([
    readJson("package.json"),
    readJson("apps/desktop/package.json"),
    readJson("apps/runtime/package.json"),
    readJson("packages/database/migrations/meta/_journal.json"),
    readJson(assetsJsonPath),
  ]);

for (const [label, packageJson] of [
  ["root", rootPackage],
  ["desktop", desktopPackage],
  ["runtime", runtimePackage],
]) {
  if (packageJson.version !== version) {
    fail(`Versão ${label} (${packageJson.version}) diverge da tag ${tag}.`);
  }
}

const releaseArtifacts = [];

for (const fileName of await releaseArtifactNames(assetsRoot)) {
  const descriptor = describeArtifact(fileName);
  if (!descriptor) continue;

  const asset = assets.find((candidate) => candidate.name === fileName);
  if (!asset?.url) {
    fail(`Asset ${fileName} não encontrado no draft release.`);
  }

  const filePath = path.join(assetsRoot, fileName);
  const fileStat = await stat(filePath);

  releaseArtifacts.push({
    ...descriptor,
    file_name: fileName,
    artifact_url: asset.url,
    artifact_sha256: await readSha256(`${filePath}.sha256`),
    artifact_size_bytes: asset.size ?? fileStat.size,
  });
}

if (!releaseArtifacts.some((artifact) => artifact.platform === "windows")) {
  fail("Manifesto sem artefato Windows.");
}

if (!releaseArtifacts.some((artifact) => artifact.platform === "linux")) {
  fail("Manifesto sem artefato Linux.");
}

const platforms = [
  ...new Set(releaseArtifacts.map((artifact) => artifact.platform)),
].sort();
const manifest = {
  version,
  channel,
  rollout,
  published_at_utc: new Date().toISOString(),
  commit_sha: commitSha,
  minimum_agent_version: minimumAgentVersion,
  platforms,
  artifacts: releaseArtifacts.sort(compareArtifacts),
  desktop_version: desktopPackage.version,
  runtime_version: runtimePackage.version,
  sqlite_schema_version: latestMigrationVersion(journal),
  influx_schema_version: process.env.NEXUS_INFLUX_SCHEMA_VERSION ?? "1",
  requires_reboot: process.env.NEXUS_RELEASE_REQUIRES_REBOOT === "1",
  release_notes:
    process.env.NEXUS_RELEASE_NOTES ??
    `Release Nexus ${tag} gerada automaticamente pela pipeline.`,
};

await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`Manifesto Nexus gerado em ${path.relative(process.cwd(), outputPath)}.`);

async function releaseArtifactNames(directory) {
  const entries = await import("node:fs/promises").then(({ readdir }) =>
    readdir(directory, { withFileTypes: true }),
  );

  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort();
}

function describeArtifact(fileName) {
  if (/\.exe$/i.test(fileName)) {
    return { platform: "windows", arch: "x64", kind: "nsis" };
  }

  if (/\.AppImage$/i.test(fileName)) {
    return { platform: "linux", arch: "x64", kind: "appimage" };
  }

  if (/\.deb$/i.test(fileName)) {
    return { platform: "linux", arch: "x64", kind: "deb" };
  }

  return undefined;
}

async function readSha256(filePath) {
  const content = await readFile(filePath, "utf8");
  const [sha256] = content.trim().split(/\s+/);

  if (!/^[a-f0-9]{64}$/i.test(sha256)) {
    fail(`SHA-256 inválido em ${filePath}.`);
  }

  return sha256.toLowerCase();
}

function latestMigrationVersion(journal) {
  const latest = journal.entries?.at(-1);

  if (!latest?.tag) {
    fail("Journal de migrations SQLite sem entrada final.");
  }

  return latest.tag;
}

function compareArtifacts(left, right) {
  const platformOrder = { windows: 0, linux: 1 };
  const kindOrder = { nsis: 0, appimage: 1, deb: 2 };

  return (
    platformOrder[left.platform] - platformOrder[right.platform] ||
    kindOrder[left.kind] - kindOrder[right.kind] ||
    left.file_name.localeCompare(right.file_name)
  );
}

async function readJson(filePath) {
  return JSON.parse(await readFile(path.resolve(filePath), "utf8"));
}

function readOption(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function readRequiredOption(name) {
  const value = readOption(name);
  if (!value) fail(`Informe ${name}.`);
  return value;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
