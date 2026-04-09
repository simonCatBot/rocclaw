// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import { expect, test } from "@playwright/test";
import { stubRocclawRoute } from "./helpers/rocclawRoute";
import { stubRuntimeRoutes } from "./helpers/runtimeRoute";

test.beforeEach(async ({ page }) => {
  await stubRocclawRoute(page);
  await stubRuntimeRoutes(page);
});

test("redirects unknown app routes to root", async ({ page }) => {
  await page.goto("/not-a-real-route");
  await expect
    .poll(() => new URL(page.url()).pathname, {
      message: "Expected invalid route to redirect to root path.",
    })
    .toBe("/");
  // Page loads successfully with footer visible
  await expect(page.locator('footer')).toBeVisible();
});
