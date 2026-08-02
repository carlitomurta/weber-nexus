import { expect, test } from "../fixtures/test";

test("CRUD de sensores pela tela de configurações", async ({ page, seed }) => {
  await page.getByRole("link", { name: "Configurações" }).click();
  await page
    .getByRole("listitem")
    .filter({ hasText: seed.controller.name })
    .click();

  await page.getByRole("button", { name: "Adicionar sensor" }).click();
  await page.getByLabel("Nome do sensor").fill("Sensor Playwright Pressão");
  await page.getByLabel("Modelo do sensor").fill("Q45P");
  await page.getByLabel("ID do sensor").fill("4");
  await page.getByLabel("Localização").fill("Saída da linha");
  await page.getByLabel("Descrição").fill("Pressão de processo");
  await page.getByLabel("Nome do registro").fill("Status");
  await page.getByLabel("Status").check();
  await page.getByRole("button", { name: "Adicionar registro" }).click();
  await page.getByLabel("Nome do registro").fill("Pressão");
  await page.getByLabel("Unidade").fill("bar");
  await page.getByRole("button", { name: "Adicionar registro" }).click();
  await page.getByRole("button", { name: "Salvar sensor" }).click();
  await page.getByRole("button", { name: "Salvar e sincronizar" }).click();

  await expect(page.getByText("Sensor Playwright Pressão")).toBeVisible();
  await expect(page.getByText("Pressão@66 bar")).toBeVisible();

  const sensorRow = page
    .locator("tr")
    .filter({ hasText: "Sensor Playwright Pressão" });

  await sensorRow.getByRole("button", { name: "Editar sensor" }).click();
  await page.getByLabel("Localização").fill("Saída da linha revisada");
  await page.getByRole("button", { name: "Salvar sensor" }).click();

  await expect(page.getByText("Saída da linha revisada")).toBeVisible();

  const updatedSensorRow = page
    .locator("tr")
    .filter({ hasText: "Sensor Playwright Pressão" });

  await updatedSensorRow
    .getByRole("button", { name: "Remover sensor" })
    .click();
  await page.getByRole("button", { name: "Remover" }).click();
  await page.getByRole("button", { name: "Remover e sincronizar" }).click();

  await expect(page.getByText("Sensor Playwright Pressão")).toBeHidden();
});
