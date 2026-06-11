import { spawnSync } from "node:child_process";

const requestedChannel = process.argv[2] ?? process.env.NEXUS_BUILD_CHANNEL;
if (requestedChannel === "--help" || requestedChannel === "-h") {
  console.log(
    "Uso: node scripts/build-system-channel.mjs [production|development]",
  );
  process.exit(0);
}

const channel =
  requestedChannel === "development" ? "development" : "production";
const env = {
  ...process.env,
  NEXUS_BUILD_CHANNEL: channel,
};

for (const args of [
  ["turbo", "run", "build"],
  ["node", "scripts/ensure-node-native-modules.mjs"],
]) {
  const result = spawnSync("yarn", args, {
    env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
