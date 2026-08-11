import { Generator, getConfig } from "@tanstack/router-generator";
import { access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDirectory, "..");
const config = getConfig(
  {
    target: "react",
    autoCodeSplitting: true,
  },
  root,
);

const generator = new Generator({
  config,
  root,
});

await generator.run();
await access(path.join(root, "src/routeTree.gen.ts"));

console.log("Route tree TanStack gerada em apps/desktop/src/routeTree.gen.ts.");
