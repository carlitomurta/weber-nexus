import { expect, test } from "../fixtures/test";

test("CRUD de controladores pela tela de configurações", async ({
  page,
  seed,
}) => {
  await page.getByRole("link", { name: "Configurações" }).click();
  await expect(
    page.getByRole("heading", { name: "Configurações" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Novo controlador" }).click();
  await page.getByLabel("Nome do controlador").fill("DXM Playwright Sul");
  await page.getByLabel("Endereço IP").fill("127.0.0.2");
  await page.getByLabel("Local / Planta").fill("Linha Playwright Sul");
  await page.getByLabel("Intervalo de coleta (ms)").fill("45000");
  await page.getByRole("button", { name: "Salvar controlador" }).click();
  await page.getByRole("button", { name: "Importar e cadastrar" }).click();

  const createdController = page
    .locator("li")
    .filter({ hasText: "DXM Playwright Sul" });

  await expect(createdController).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "DXM Playwright Sul" }),
  ).toBeVisible();
  await expect(page.getByText("Linha Playwright Sul")).toBeVisible();

  const seededController = page
    .locator("li")
    .filter({ hasText: seed.controller.name });

  await seededController.getByRole("button", { name: "Editar" }).click();
  await page.getByLabel("Nome do controlador").fill("DXM Playwright Norte 2");
  await page.getByLabel("Local / Planta").fill("Linha Playwright Revisada");
  await page.getByRole("button", { name: "Salvar alterações" }).click();

  const updatedController = page
    .locator("li")
    .filter({ hasText: "DXM Playwright Norte 2" });

  await expect(updatedController).toBeVisible();
  await updatedController.click();
  await expect(
    page.getByRole("heading", { name: "DXM Playwright Norte 2" }),
  ).toBeVisible();
  await expect(page.getByText("Linha Playwright Revisada")).toBeVisible();

  await createdController.getByRole("button", { name: "Remover" }).click();
  await page.getByRole("button", { name: "Remover" }).click();

  await expect(createdController).toBeHidden();
});
