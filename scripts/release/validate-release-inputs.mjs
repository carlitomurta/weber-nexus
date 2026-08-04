import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();
const tag = readOption("--tag") ?? process.env.GITHUB_REF_NAME ?? "v1.0.0";

if (!/^v\d+\.\d+\.\d+$/.test(tag)) {
  fail(`Tag de release inválida: ${tag}. Use vMAJOR.MINOR.PATCH.`);
}

const version = tag.slice(1);
const packageFiles = [
  "package.json",
  "apps/desktop/package.json",
  "apps/runtime/package.json",
  "packages/update-agent/package.json",
];

for (const packageFile of packageFiles) {
  const packageJson = await readJson(path.join(repoRoot, packageFile));

  if (packageJson.version !== version) {
    fail(
      `${packageFile} usa versão ${packageJson.version}; esperado ${version}.`,
    );
  }
}

await assertDirectoryHasSqlMigrations(
  path.join(repoRoot, "packages/database/migrations"),
);
await assertFile(
  path.join(repoRoot, "resources/influxdb/3.9.3/windows/influxdb3.exe"),
);
await assertFile(
  path.join(repoRoot, "resources/influxdb/3.9.3/linux/influxdb3"),
);

const electronBuilderConfig = await readFile(
  path.join(repoRoot, "apps/desktop/electron-builder.json5"),
  "utf8",
);

for (const requiredFragment of [
  "database-migrations",
  "../../packages/database/migrations",
  "../../resources/influxdb/3.9.3/windows",
  "../../resources/influxdb/3.9.3/linux",
]) {
  if (!electronBuilderConfig.includes(requiredFragment)) {
    fail(`electron-builder não empacota recurso obrigatório: ${requiredFragment}.`);
  }
}

console.log(`Release ${tag} validada.`);

async function assertDirectoryHasSqlMigrations(directory) {
  const entries = await readdir(directory);
  const migrations = entries.filter((entry) => /^\d+_.+\.sql$/.test(entry));

  if (migrations.length === 0) {
    fail(`Nenhuma migration SQLite encontrada em ${directory}.`);
  }

  await assertFile(path.join(directory, "meta/_journal.json"));
}

async function assertFile(filePath) {
  try {
    await access(filePath);
  } catch {
    fail(`Arquivo obrigatório não encontrado: ${path.relative(repoRoot, filePath)}.`);
  }
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function readOption(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
