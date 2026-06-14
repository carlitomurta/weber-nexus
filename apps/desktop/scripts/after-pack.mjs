import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export default async function afterPack(context) {
  if (context.electronPlatformName !== "win32") {
    return;
  }

  const productName = context.packager.appInfo.productName;
  const executableName = `${context.packager.appInfo.productFilename}.exe`;
  const executablePath = path.join(context.appOutDir, executableName);

  if (!fs.existsSync(executablePath)) {
    throw new Error(`Executavel nao encontrado: ${executablePath}`);
  }

  const iconPath = createIcon(context);
  const args = [
    executablePath,
    "--set-version-string",
    "FileDescription",
    productName,
    "--set-version-string",
    "ProductName",
    productName,
    "--set-version-string",
    "InternalName",
    executableName,
    "--set-version-string",
    "OriginalFilename",
    executableName,
    "--set-version-string",
    "CompanyName",
    "Webercom",
    "--set-file-version",
    context.packager.appInfo.shortVersion ??
      context.packager.appInfo.buildVersion,
    "--set-product-version",
    context.packager.appInfo.shortVersionWindows ??
      context.packager.appInfo.getVersionInWeirdWindowsForm(),
    "--set-icon",
    iconPath,
  ];

  runRcedit(context, args);
}

function createIcon(context) {
  const iconSource = path.join(context.packager.projectDir, "build", "icon.png");
  const iconOutDir = path.join(context.outDir, ".icon-ico");
  const iconPath = path.join(iconOutDir, "icon.ico");

  if (fs.existsSync(iconPath)) {
    return iconPath;
  }

  fs.mkdirSync(iconOutDir, { recursive: true });
  runAppBuilder(context, [
    "icon",
    "--format",
    "ico",
    "--out",
    iconOutDir,
    "--input",
    iconSource,
  ]);

  return iconPath;
}

function runAppBuilder(context, args) {
  const appBuilderPath = findAppBuilder(context.packager.info.projectDir);

  const result = spawnSync(appBuilderPath, args, {
    encoding: "utf8",
    windowsHide: true,
  });

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }

  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`app-builder falhou: ${args[0]}`);
  }
}

function runRcedit(context, args) {
  const rceditPath = ensureRcedit(context);
  const result = spawnSync(rceditPath, args, {
    encoding: "utf8",
    windowsHide: true,
  });

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }

  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error("rcedit falhou");
  }
}

function ensureRcedit(context) {
  const outDir = path.join(context.outDir, ".rcedit");
  const rceditPath = path.join(outDir, "rcedit-x64.exe");

  if (fs.existsSync(rceditPath)) {
    return rceditPath;
  }

  fs.mkdirSync(outDir, { recursive: true });

  const archivePath = findWinCodeSignArchive();
  const sevenZipPath = findSevenZip(context.packager.info.projectDir);
  const result = spawnSync(
    sevenZipPath,
    ["e", archivePath, "rcedit-x64.exe", `-o${outDir}`, "-y"],
    {
      encoding: "utf8",
      windowsHide: true,
    },
  );

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }

  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0 || !fs.existsSync(rceditPath)) {
    throw new Error("Nao foi possivel preparar rcedit");
  }

  return rceditPath;
}

function findWinCodeSignArchive() {
  const cacheDirs = [
    path.join(
      process.env.USERPROFILE ?? "",
      ".cache",
      "electron-builder",
      "winCodeSign",
    ),
    path.join(
      process.env.LOCALAPPDATA ?? "",
      "electron-builder",
      "Cache",
      "winCodeSign",
    ),
  ];

  for (const cacheDir of cacheDirs) {
    if (!cacheDir || !fs.existsSync(cacheDir)) {
      continue;
    }

    const archive = fs
      .readdirSync(cacheDir)
      .find((entry) => entry.toLowerCase().endsWith(".7z"));

    if (archive) {
      return path.join(cacheDir, archive);
    }
  }

  throw new Error("Cache winCodeSign nao encontrado");
}

function findSevenZip(startDir) {
  let currentDir = startDir;

  while (true) {
    const candidate = path.join(
      currentDir,
      "node_modules",
      "7zip-bin",
      "win",
      "x64",
      "7za.exe",
    );

    if (fs.existsSync(candidate)) {
      return candidate;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      throw new Error("7za nao encontrado");
    }

    currentDir = parentDir;
  }
}

function findAppBuilder(startDir) {
  let currentDir = startDir;

  while (true) {
    const candidate = path.join(
      currentDir,
      "node_modules",
      "app-builder-bin",
      process.platform === "win32" ? "win" : process.platform,
      process.arch === "x64" ? "x64" : process.arch,
      process.platform === "win32" ? "app-builder.exe" : "app-builder",
    );

    if (fs.existsSync(candidate)) {
      return candidate;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      throw new Error("app-builder nao encontrado");
    }

    currentDir = parentDir;
  }
}
