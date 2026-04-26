// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import { expect, test } from "@playwright/test";
import { stubRocclawRoute } from "./helpers/rocclawRoute";
import { stubRuntimeRoutes } from "./helpers/runtimeRoute";

test("loads focused rocclaw empty state", async ({ page }) => {
  await stubRocclawRoute(page);
  await stubRuntimeRoutes(page);

  await page.goto("/");

  // Connection accessible via footer button which toggles the Connection tab
  await page.locator('button[title="Gateway connection settings"]').click();
  await expect(page.getByText("Gateway URL & Token")).toBeVisible();
});
