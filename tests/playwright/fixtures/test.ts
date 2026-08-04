import { test as base } from "@playwright/test";
import {
  launchElectronApp,
  type ElectronHarness,
} from "./electron-app";
import {
  startRuntimeHarness,
  type PlaywrightSeed,
  type RuntimeHarness,
} from "./runtime";

type Fixtures = {
  electron: ElectronHarness;
  electronEnv: Partial<NodeJS.ProcessEnv>;
  page: ElectronHarness["page"];
  runtime: RuntimeHarness;
  seed: PlaywrightSeed;
};

export const test = base.extend<Fixtures>({
  electronEnv: [{}, { option: true }],
  runtime: [
    async ({}, use) => {
      const runtime = await startRuntimeHarness();

      try {
        await use(runtime);
      } finally {
        await runtime.stop();
      }
    },
    { scope: "worker", auto: true },
  ],
  seed: [
    async ({ runtime }, use) => {
      await use(runtime.seed);
    },
    { scope: "worker" },
  ],
  electron: async ({ runtime: _runtime, electronEnv }, use) => {
    const electronApp = await launchElectronApp(electronEnv);

    try {
      await use(electronApp);
    } finally {
      await electronApp.app.close();
    }
  },
  page: async ({ electron }, use) => {
    await use(electron.page);
  },
});

export { expect } from "@playwright/test";
