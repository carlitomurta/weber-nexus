import { expect, test } from "../fixtures/test";

test.use({
  electronEnv: {
    NEXUS_DESKTOP_MOCK_UPDATE_AVAILABLE: "1",
    NEXUS_DESKTOP_MOCK_UPDATE_VERSION: "1.0.1",
  },
});

test("desktop exibe status de atualização disponível", async ({ page }) => {
  await expect(page.getByText("Atualização disponível")).toBeVisible();
  await expect(page.getByText("v1.0.1")).toBeVisible();
  await expect(page.getByRole("button", { name: "Instalar" })).toBeVisible();
});
