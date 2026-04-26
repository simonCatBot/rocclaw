// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import { expect, test } from "@playwright/test";
import { stubRocclawRoute } from "./helpers/rocclawRoute";
import { stubRuntimeRoutes } from "./helpers/runtimeRoute";

test.beforeEach(async ({ page }) => {
  await stubRocclawRoute(page);
  await stubRuntimeRoutes(page);
});

test("empty focused view shows zero agents when disconnected", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("No agents yet").first()).toBeVisible();
  // Footer connection settings button is visible
  await expect(page.locator('button[title="Gateway connection settings"]')).toBeVisible();
  // Clicking it toggles the Connection tab with the connection form
  await page.locator('button[title="Gateway connection settings"]').click();
  await expect(page.getByText("Gateway URL & Token")).toBeVisible();
});
