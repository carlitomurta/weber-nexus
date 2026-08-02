import { expect, test } from "../fixtures/test";

test("dashboard e detalhe exibem telemetria real do InfluxDB isolado", async ({
  page,
  seed,
}) => {
  await page.getByRole("link", { name: "Painel" }).click();

  await expect(
    page.getByRole("heading", { name: seed.controller.name }),
  ).toBeVisible();
  await expect(page.getByText("Registros em tempo real")).toBeVisible();
  await expect(
    page.getByRole("cell", { name: seed.controller.ipAddress }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: seed.controller.name }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Inspecionar" }).click();

  await expect(
    page.getByRole("heading", { name: seed.controller.name }),
  ).toBeVisible();
  const sensorCard = page.locator(".rounded-lg").filter({
    hasText: seed.sensor.name,
  });

  await expect(sensorCard).toBeVisible();
  await expect(sensorCard.getByText("ONLINE").first()).toBeVisible();
  await expect(sensorCard.getByText("12,3")).toBeVisible();
  await expect(sensorCard.getByText("mm/s")).toBeVisible();
  await expect(sensorCard.getByText("42")).toBeVisible();
});
