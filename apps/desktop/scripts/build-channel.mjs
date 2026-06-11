import { spawnSync } from "node:child_process";

const channel =
  process.argv[2] === "development" ? "development" : "production";
const env = {
  ...process.env,
  NEXUS_BUILD_CHANNEL: channel,
};

for (const script of ["build:bundle", "build:windows", "build:linux"]) {
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
