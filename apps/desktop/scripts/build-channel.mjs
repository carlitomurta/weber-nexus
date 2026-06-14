import { spawnSync } from "node:child_process";

const requestedChannel = process.argv[2] ?? process.env.NEXUS_BUILD_CHANNEL;
if (requestedChannel === "--help" || requestedChannel === "-h") {
  console.log("Uso: node scripts/build-channel.mjs [production|development]");
  process.exit(0);
}

const channel =
  requestedChannel === "development" ? "development" : "production";
const env = {
  ...process.env,
  NEXUS_BUILD_CHANNEL: channel,
};

for (const script of buildScripts(channel)) {
  const result = spawnSync(
    "yarn",
    ["workspace", "@weber-nexus/desktop", script],
    {
      env,
      stdio: "inherit",
      shell: process.platform === "win32",
    },
  );

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function buildScripts(channel) {
  if (channel !== "development") {
    return ["build:bundle", "build:windows", "build:linux"];
  }

  if (process.platform === "win32") {
    return ["build:bundle", "build:windows"];
  }

  if (process.platform === "linux") {
    return ["build:bundle", "build:linux"];
  }

  return ["build:bundle"];
}
