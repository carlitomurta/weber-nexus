import {
  _electron as electron,
  expect,
  type ElectronApplication,
  type Page,
} from "@playwright/test";
import path from "node:path";
import { buildElectronEnv, desktopRoot, workspaceRoot } from "./environment";

export type ElectronHarness = {
  app: ElectronApplication;
  page: Page;
};

export async function launchElectronApp(
  envOverrides: Partial<NodeJS.ProcessEnv> = {},
): Promise<ElectronHarness> {
  const app = await electron
    .launch({
      executablePath: electronExecutablePath(),
      args: ["."],
      cwd: desktopRoot,
      env: {
        ...buildElectronEnv(),
        ...envOverrides,
      },
      timeout: 45_000,
    })
    .catch((error: unknown) => {
      const message =
        error instanceof Error ? (error.stack ?? error.message) : String(error);

      throw new Error(`Falha ao iniciar Electron: ${message}`);
    });

  await app.context().addInitScript(() => {
    window.localStorage.setItem(
      "nexus_auth_user",
      JSON.stringify({
        id: 1,
        name: "Admin",
        email: "admin@admin.com",
        role: "ADMIN",
      }),
    );
  });

  const page = await app.firstWindow();

  await page.waitForLoadState("domcontentloaded");
  await signIn(page);

  return { app, page };
}

function electronExecutablePath(): string {
  if (process.platform === "win32") {
    return path.join(
      workspaceRoot,
      "node_modules",
      "electron",
      "dist",
      "electron.exe",
    );
  }

  return path.join(
    workspaceRoot,
    "node_modules",
    "electron",
    "dist",
    "electron",
  );
}

async function signIn(page: Page): Promise<void> {
  const loginButton = page.getByRole("button", {
    name: "Conectar e entrar",
  });

  if (await loginButton.isVisible()) {
    await page.getByLabel("E-mail").fill("admin@admin.com");
    await page.getByLabel("Senha").fill("12345678");
    await loginButton.click();
  }

  await expect(page.getByRole("link", { name: "Painel" })).toBeVisible();
}
