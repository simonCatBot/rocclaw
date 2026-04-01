import { expect, test } from "@playwright/test";
import { stubRocclawRoute } from "./helpers/rocclawRoute";
import { stubRuntimeRoutes } from "./helpers/runtimeRoute";

test.beforeEach(async ({ page }) => {
  await stubRocclawRoute(page);
  await stubRuntimeRoutes(page);
});

test("connection panel reflects disconnected state", async ({ page }) => {
  await page.goto("/");

  await page.locator('button[title="Gateway connection settings"]').click();
  await expect(page.getByLabel(/Upstream (gateway )?URL/i)).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^(Connect|Disconnect)$/ })
  ).toBeVisible();
});
