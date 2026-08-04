import { spawnSync } from "node:child_process";
import { electronBuilderConfigArgs } from "./build-options.mjs";

const buildResult = spawnSync(
  "yarn",
  [
    "workspace",
    "@weber-nexus/desktop",
    "exec",
    "electron-builder",
    "--linux",
    "AppImage",
    "deb",
    "--x64",
    "--publish",
    "never",
    ...electronBuilderConfigArgs("linux"),
  ],
  {
    stdio: "inherit",
    shell: process.platform === "win32",
  },
);

process.exit(buildResult.status ?? 1);
