#!/usr/bin/env node

/**
 * Electron App Scaffolder
 *
 * Generates an electron-vite project structure with best-practice defaults.
 * Includes secure BrowserWindow configuration and typed IPC setup.
 *
 * Usage:
 *   tsx scripts/scaffold-electron-app.ts --name <name> [options]
 *
 * Options:
 *   --name <name>   App name (required)
 *   --path <path>   Target directory (default: current directory)
 *   --with-react    Include React 18 setup (default: true)
 *   --with-trpc     Include electron-trpc setup
 *   --with-tests    Include Playwright test setup
 *   -h, --help      Show help
 */

import { mkdir, writeFile } from "fs/promises";
import path from "path";

const VERSION = "1.0.0";
const SCRIPT_NAME = "scaffold-electron-app";

interface ScaffoldOptions {
  name: string;
  path: string;
  withReact: boolean;
  withTrpc: boolean;
  withTests: boolean;
}

interface GeneratedFile {
  path: string;
  content: string;
}

// mantenha aqui todos os seus templates exatamente iguais:
// getMainIndexTs, getMainIpcHandlersTs, getPreloadIndexTs, etc.

async function ensureDir(targetPath: string): Promise<void> {
  await mkdir(targetPath, { recursive: true });
}

async function writeFiles(files: GeneratedFile[]): Promise<void> {
  for (const file of files) {
    const dir = path.dirname(file.path);
    await ensureDir(dir);
    await writeFile(file.path, file.content, "utf8");
  }
}

async function scaffold(options: ScaffoldOptions): Promise<GeneratedFile[]> {
  await ensureDir(path.join(options.path, "resources"));

  const files = generateFiles(options);
  await writeFiles(files);

  return files;
}

function formatHumanOutput(
  options: ScaffoldOptions,
  files: GeneratedFile[],
): void {
  console.log("\nELECTRON APP SCAFFOLDED");
  console.log("=======================\n");
  console.log(`App name: ${options.name}`);
  console.log(`Location: ${options.path}`);
  console.log(`React:    ${options.withReact ? "yes" : "no"}`);
  console.log(`tRPC:     ${options.withTrpc ? "yes" : "no"}`);
  console.log(`Tests:    ${options.withTests ? "yes" : "no"}`);
  console.log();

  console.log("FILES CREATED:");
  console.log();

  for (const file of files) {
    const relativePath = path.relative(options.path, file.path);
    console.log(`  ${relativePath}`);
  }

  console.log();
  console.log("NEXT STEPS:");
  console.log(`  cd ${options.path}`);
  console.log("  npm install");
  console.log("  npm run dev");
  console.log();
}

function printHelp(): void {
  console.log(`
${SCRIPT_NAME} v${VERSION} - Electron App Scaffolder

Usage:
  node scripts/scaffold-electron-app.js --name <name> [options]

Options:
  --name <name>   App name (required)
  --path <path>   Target directory (default: current directory)
  --with-react    Include React 18 setup (default: true)
  --with-trpc     Include electron-trpc setup
  --with-tests    Include Playwright test setup
  --json          Output JSON report
  -h, --help      Show this help
`);
}

function parseArgs(args: string[]): ScaffoldOptions | null {
  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    return null;
  }

  const options: ScaffoldOptions = {
    name: "",
    path: ".",
    withReact: true,
    withTrpc: false,
    withTests: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--name" && i + 1 < args.length) {
      options.name = args[++i];
    } else if (arg === "--path" && i + 1 < args.length) {
      options.path = args[++i];
    } else if (arg === "--with-react") {
      options.withReact = true;
    } else if (arg === "--with-trpc") {
      options.withTrpc = true;
    } else if (arg === "--with-tests") {
      options.withTests = true;
    }
  }

  if (!options.name) {
    console.error("Error: --name is required");
    return null;
  }

  return options;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  if (!options) {
    printHelp();
    process.exit(0);
  }

  const files = await scaffold(options);

  if (args.includes("--json")) {
    console.log(
      JSON.stringify(
        {
          name: options.name,
          path: options.path,
          withReact: options.withReact,
          withTrpc: options.withTrpc,
          withTests: options.withTests,
          filesCreated: files.map((file) => file.path),
        },
        null,
        2,
      ),
    );
  } else {
    formatHumanOutput(options, files);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
