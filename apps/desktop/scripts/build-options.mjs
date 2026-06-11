export function buildChannel() {
  const requested = process.env.NEXUS_BUILD_CHANNEL?.toLowerCase();

  return requested === "development" || requested === "dev"
    ? "development"
    : "production";
}

export function electronBuilderConfigArgs(platform) {
  const channel = buildChannel();
  const isDevelopment = channel === "development";
  const productName = isDevelopment ? "Nexus Dev" : "Nexus";
  const artifactName = isDevelopment ? "Nexus-Dev" : "Nexus";
  const platformArtifact =
    platform === "win" ? "win64" : platform === "linux" ? "linux" : platform;

  return [
    `--config.appId=com.weber.nexus${isDevelopment ? ".dev" : ""}`,
    `--config.productName=${productName}`,
    `--config.executableName=${productName}`,
    `--config.extraMetadata.nexusBuildChannel=${channel}`,
    `--config.${platform}.artifactName=${artifactName}-${platformArtifact}-\${version}.\${ext}`,
  ];
}
