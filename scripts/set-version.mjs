import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const repoRoot = process.cwd();
const ignoredDirectories = new Set([
  '.git',
  '.turbo',
  '.yarn',
  'db',
  'dist',
  'dist-electron',
  'influxdb-data',
  'node_modules',
  'release',
  'temp',
]);

const args = process.argv.slice(2);
const isCheck = args.includes('--check');
const requestedVersion = args.find((arg) => !arg.startsWith('--')) ?? '1.0.0';

if (!isValidVersion(requestedVersion)) {
  console.error(`Invalid version: ${requestedVersion}`);
  console.error('Expected a semantic version like 1.0.0 or 1.0.0-beta.1');
  process.exit(1);
}

const packagePaths = await findPackageJsonFiles(repoRoot);
const mismatches = [];

for (const packagePath of packagePaths) {
  const rawPackage = await readFile(packagePath, 'utf8');
  let packageJson = JSON.parse(rawPackage);
  const relativePath = path.relative(repoRoot, packagePath);

  if (packageJson.version !== requestedVersion) {
    mismatches.push({
      path: relativePath,
      currentVersion: packageJson.version ?? '<missing>',
    });
  }

  if (!isCheck) {
    packageJson =
      'version' in packageJson
        ? { ...packageJson, version: requestedVersion }
        : addVersionAfterName(packageJson, requestedVersion);
    await writePackageJson(packagePath, packageJson);
  }
}

if (isCheck) {
  if (mismatches.length > 0) {
    console.error(`Version check failed. Expected ${requestedVersion}:`);

    for (const mismatch of mismatches) {
      console.error(`- ${mismatch.path}: ${mismatch.currentVersion}`);
    }

    process.exit(1);
  }

  console.log(`All package versions are ${requestedVersion}.`);
} else {
  console.log(`Set ${packagePaths.length} package version(s) to ${requestedVersion}.`);
}

async function findPackageJsonFiles(rootDir) {
  const packagePaths = [path.join(rootDir, 'package.json')];

  for (const workspaceDir of ['apps', 'packages']) {
    packagePaths.push(...(await findPackageJsonFilesIn(path.join(rootDir, workspaceDir))));
  }

  return [...new Set(packagePaths)].sort();
}

async function findPackageJsonFilesIn(dir) {
  const packagePaths = [];

  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || ignoredDirectories.has(entry.name)) {
      continue;
    }

    const entryPath = path.join(dir, entry.name);
    const packagePath = path.join(entryPath, 'package.json');

    try {
      await readFile(packagePath, 'utf8');
      packagePaths.push(packagePath);
    } catch {
      packagePaths.push(...(await findPackageJsonFilesIn(entryPath)));
    }
  }

  return packagePaths;
}

async function writePackageJson(packagePath, packageJson) {
  await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
}

function addVersionAfterName(packageJson, version) {
  const ordered = {};

  for (const [packageKey, packageValue] of Object.entries(packageJson)) {
    ordered[packageKey] = packageValue;

    if (packageKey === 'name') {
      ordered.version = version;
    }
  }

  if (!('version' in ordered)) {
    ordered.version = version;
  }

  return ordered;
}

function isValidVersion(version) {
  return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(
    version,
  );
}
