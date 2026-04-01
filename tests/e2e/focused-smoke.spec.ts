import { expect, test } from "@playwright/test";
import { stubRocclawRoute } from "./helpers/rocclawRoute";
import { stubRuntimeRoutes } from "./helpers/runtimeRoute";

test("loads focused studio empty state", async ({ page }) => {
  await stubRocclawRoute(page);
  await stubRuntimeRoutes(page);

  await page.goto("/");

  // Connection panel accessible via footer button
  await page.locator('button[title="Gateway connection settings"]').click();
  await expect(page.getByTestId("gateway-connection-overlay")).toBeVisible();
});
