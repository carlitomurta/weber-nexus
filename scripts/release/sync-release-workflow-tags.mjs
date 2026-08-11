import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();
const workflowPath = path.join(repoRoot, ".github/workflows/nexus-release.yml");
const tags = readReleaseTags();

if (tags.length === 0) {
  fail("Nenhuma tag SemVer encontrada. Crie uma tag vMAJOR.MINOR.PATCH.");
}

const workflow = await readFile(workflowPath, "utf8");
const nextWorkflow = syncTagInputOptions(workflow, tags);

if (nextWorkflow !== workflow) {
  await writeFile(workflowPath, nextWorkflow);
}

console.log(`Workflow de release sincronizado com ${tags.length} tag(s).`);

function readReleaseTags() {
  const result = spawnSync(
    "git",
    ["tag", "--list", "v[0-9]*.[0-9]*.[0-9]*", "--sort=-v:refname"],
    { cwd: repoRoot, encoding: "utf8" },
  );

  if (result.status !== 0 && result.stdout.length === 0) {
    fail(
      result.stderr.trim() || result.error?.message || "Falha ao listar tags.",
    );
  }

  return result.stdout
    .split(/\r?\n/)
    .map((tag) => tag.trim())
    .filter((tag) => /^v\d+\.\d+\.\d+$/.test(tag));
}

function syncTagInputOptions(workflowContent, releaseTags) {
  const defaultTag = releaseTags[0];
  const withDefault = workflowContent.replace(
    /(\n\s+tag:\n(?:\s+.+\n)*?\s+default:\s+)["']?[^"'\n]+["']?/,
    `$1"${defaultTag}"`,
  );

  const optionLines = releaseTags.map((tag) => `          - ${tag}`).join("\n");
  const nextContent = withDefault.replace(
    /(\n\s+# release-tags:start\n)(?:\s+- .+\n)*(\s+# release-tags:end)/,
    `$1${optionLines}\n$2`,
  );

  if (
    nextContent === withDefault &&
    !nextContent.includes("# release-tags:start")
  ) {
    fail("Marcadores release-tags:start/end não encontrados no workflow.");
  }

  return nextContent;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
