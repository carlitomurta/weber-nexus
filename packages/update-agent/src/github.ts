import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseNexusReleaseManifest } from "./manifest.js";
import { validateFileSha256 } from "./hash.js";
import type { NexusReleaseArtifact, NexusReleaseManifest } from "./types.js";

type GitHubAsset = {
  name: string;
  url: string;
  browser_download_url?: string;
  size: number;
};

type GitHubRelease = {
  tag_name: string;
  draft: boolean;
  prerelease: boolean;
  assets: GitHubAsset[];
};

export type GitHubReleaseManifestInput = {
  owner: string;
  repo: string;
  token: string;
  manifestAssetName?: string;
  includeDrafts?: boolean;
  includePrereleases?: boolean;
  fetchImpl?: typeof fetch;
};

export async function fetchGitHubReleaseManifests(
  input: GitHubReleaseManifestInput,
): Promise<NexusReleaseManifest[]> {
  const releases = await fetchGitHubJson<GitHubRelease[]>(
    `https://api.github.com/repos/${input.owner}/${input.repo}/releases`,
    input.token,
    input.fetchImpl,
  );
  const manifestAssetName =
    input.manifestAssetName ?? "nexus-update-manifest.json";
  const manifests: NexusReleaseManifest[] = [];

  for (const release of releases) {
    if (release.draft && input.includeDrafts !== true) continue;
    if (release.prerelease && input.includePrereleases !== true) continue;

    const manifestAsset = release.assets.find(
      (asset) => asset.name === manifestAssetName,
    );

    if (!manifestAsset) continue;

    const manifestJson = await fetchGitHubText(
      manifestAsset.url,
      input.token,
      input.fetchImpl,
    );
    manifests.push(parseNexusReleaseManifest(manifestJson));
  }

  return manifests;
}

export type DownloadArtifactInput = {
  artifact: NexusReleaseArtifact;
  destinationDirectory: string;
  token: string;
  fetchImpl?: typeof fetch;
};

export async function downloadAndValidateArtifact(
  input: DownloadArtifactInput,
): Promise<string> {
  const response = await (input.fetchImpl ?? fetch)(input.artifact.artifact_url, {
    headers: githubHeaders(input.token, "application/octet-stream"),
  });

  if (!response.ok) {
    throw new Error(
      `Falha ao baixar artefato. GitHub retornou HTTP ${response.status}.`,
    );
  }

  const artifactPath = path.join(
    input.destinationDirectory,
    input.artifact.file_name,
  );
  const content = Buffer.from(await response.arrayBuffer());

  await mkdir(input.destinationDirectory, { recursive: true });
  await writeFile(artifactPath, content);

  const downloadedStat = await stat(artifactPath);
  if (downloadedStat.size !== input.artifact.artifact_size_bytes) {
    throw new Error(
      `Tamanho do artefato inválido. Esperado ${input.artifact.artifact_size_bytes}, obtido ${downloadedStat.size}.`,
    );
  }

  await validateFileSha256(artifactPath, input.artifact.artifact_sha256);
  return artifactPath;
}

async function fetchGitHubJson<TValue>(
  url: string,
  token: string,
  fetchImpl: typeof fetch = fetch,
): Promise<TValue> {
  const response = await fetchImpl(url, {
    headers: githubHeaders(token, "application/vnd.github+json"),
  });

  if (!response.ok) {
    throw new Error(`GitHub retornou HTTP ${response.status}.`);
  }

  return (await response.json()) as TValue;
}

async function fetchGitHubText(
  url: string,
  token: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const response = await fetchImpl(url, {
    headers: githubHeaders(token, "application/octet-stream"),
  });

  if (!response.ok) {
    throw new Error(`GitHub retornou HTTP ${response.status}.`);
  }

  return response.text();
}

function githubHeaders(token: string, accept: string): Record<string, string> {
  return {
    Accept: accept,
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };
}
