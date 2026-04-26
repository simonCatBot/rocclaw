// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import { expect, test } from "@playwright/test";
import { stubRocclawRoute } from "./helpers/rocclawRoute";
import { stubRuntimeRoutes } from "./helpers/runtimeRoute";

test.beforeEach(async ({ page }) => {
  await stubRocclawRoute(page);
  await stubRuntimeRoutes(page);
});

test("settings route shows connect UI while disconnected and can return to chat", async ({ page }) => {
  await page.goto("/agents/main/settings");

  await expect
    .poll(() => new URL(page.url()).pathname, {
      message: "Expected settings route without agents to resolve to chat route.",
    })
    .toBe("/");

  // Footer button toggles the Connection tab with the connection form
  await page.locator('button[title="Gateway connection settings"]').click();
  await expect(page.locator('#gateway-url')).toBeVisible();
});
