import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./specs",
  outputDir: "../../.playwright/results",
  timeout: 90_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ["list"],
    ["html", { outputFolder: "../../playwright-report", open: "never" }],
  ],
  use: {
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "electron-runtime",
      testMatch: "**/*.spec.ts",
    },
  ],
});
