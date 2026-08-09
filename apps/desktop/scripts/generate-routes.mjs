import { Generator, getConfig } from "@tanstack/router-generator";

const root = process.cwd();
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
