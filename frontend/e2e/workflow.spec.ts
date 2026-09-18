import { expect, test } from "@playwright/test";

test("partial consent → release → mechanic → auditable document", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByTestId("confirmed-total")).toContainText(/18\s*500/);
  await page.getByRole("button", { name: "Зафиксировать решение", exact: true }).click();
  await page.getByRole("button", { name: "Отклонить всё" }).click();
  await page.getByLabel("Решение: Замена передних тормозных колодок").selectOption("accepted");
  await expect(page.getByLabel("Решение: Колодки передние · Akebono")).toHaveValue("accepted");
  await page
    .getByLabel("Комментарий к решению")
    .fill("Клиент согласовал колодки, от замены ремня отказался.");
  await page.getByRole("button", { name: "Зафиксировать решение", exact: true }).last().click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("Согласовано частично", { exact: true })).toBeVisible();
  await expect(page.getByTestId("confirmed-total")).toContainText(/27\s*700/);
  await page.getByRole("button", { name: "Передать в работу", exact: true }).click();
  await expect(
    page.getByText("Согласованные позиции переданы в работу", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Роль сотрудника").selectOption("mechanic");
  await expect(page.getByRole("button", { name: "Начать", exact: true })).toHaveCount(1);
  await page.getByRole("button", { name: "Начать", exact: true }).click();
  await page.getByRole("button", { name: "Завершить", exact: true }).click();
  await expect(page.getByText("Работа завершена", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Документы" }).click();
  await expect(page.locator(".document-panel")).toContainText("Колодки передние");
  await expect(page.locator(".document-panel")).not.toContainText("Ремень приводной");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSON", exact: true }).click();
  expect((await download).suggestedFilename()).toContain("ЗН-1042");
  await page.getByRole("tab", { name: "История изменений" }).click();
  await expect(page.getByText("Зафиксировано решение клиента", { exact: true })).toBeVisible();
  await expect(page.getByText(/Изменение согласованной суммы/)).toContainText(/9\s*200/);
  expect(errors).toEqual([]);
});

test("create, edit and send a new proposal; reject without changing the total", async ({
  page,
}) => {
  await page.goto("/");
  const totalBefore = await page.getByTestId("confirmed-total").textContent();
  await page.getByRole("button", { name: "Новое предложение", exact: true }).click();
  await page.getByLabel("Название предложения").fill("Проверка кондиционера");
  await page.getByLabel("Обнаруженная неисправность").fill("Слабое охлаждение в салоне");
  await page.getByLabel("Наименование позиции 1").fill("Диагностика кондиционера");
  await page.getByLabel("Цена за единицу, ₽ 1").fill("1500.50");
  await page.getByRole("button", { name: "Сохранить черновик" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Редактировать", exact: true }).click();
  await page.getByLabel("Цена за единицу, ₽ 1").fill("1600.50");
  await page.getByRole("button", { name: "Сохранить черновик" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Передано клиенту", exact: true }).click();
  await page.getByLabel("Комментарий к передаче").fill("Передано клиенту лично в приёмной");
  await page.getByRole("button", { name: "Зафиксировать передачу" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Зафиксировать решение", exact: true }).click();
  await page.getByRole("button", { name: "Отклонить всё" }).click();
  await page.getByLabel("Комментарий к решению").fill("Клиент решил отложить диагностику");
  await page.getByRole("button", { name: "Зафиксировать решение", exact: true }).last().click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.locator(".proposal-card").getByText("Отклонено", { exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("confirmed-total")).toHaveText(totalBefore!);
});

test("theme persists after reload and cashier has read-only controls", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("confirmed-total")).toBeVisible();
  await page.getByLabel("Переключить тему").click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.getByLabel("Роль сотрудника").selectOption("cashier");
  await expect(page.getByRole("button", { name: "Новое предложение", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Добавить запись", exact: true })).toHaveCount(0);
  await expect(page.getByText("Режим кассира", { exact: false })).toBeVisible();
});

test("mobile page fits viewport and exposes all tabs", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByTestId("confirmed-total")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByRole("tab", { name: "Документы" }).click();
  await expect(page.locator(".document-total")).toBeVisible();
  await page.getByRole("tab", { name: "История изменений" }).click();
  await expect(page.locator(".timeline")).toBeVisible();
});
