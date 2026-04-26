// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import { expect, test } from "@playwright/test";
import { stubRocclawRoute } from "./helpers/rocclawRoute";
import { stubRuntimeRoutes } from "./helpers/runtimeRoute";

test.beforeEach(async ({ page }) => {
  await stubRocclawRoute(page);
  await stubRuntimeRoutes(page);
});

test("connection panel reflects disconnected state", async ({ page }) => {
  await page.goto("/");

  // Footer button toggles the Connection tab
  await page.locator('button[title="Gateway connection settings"]').click();
  await expect(page.locator('#gateway-url')).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^(Connect|Disconnect)$/ }).first()
  ).toBeVisible();
});
