// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import { expect, test } from "@playwright/test";
import { stubRocclawRoute } from "./helpers/rocclawRoute";
import { stubRuntimeRoutes } from "./helpers/runtimeRoute";

test.beforeEach(async ({ page }) => {
  await stubRocclawRoute(page);
  await stubRuntimeRoutes(page);
});

test("shows_connection_settings_control_in_header", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByTestId("brain-files-toggle")).toHaveCount(0);
  // Connection settings accessible via footer button
  await expect(page.locator('button[title="Gateway connection settings"]')).toBeVisible();
});

test("mobile_header_shows_connection_control", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect(page.getByTestId("brain-files-toggle")).toHaveCount(0);
  // Connection settings accessible via footer button
  await expect(page.locator('button[title="Gateway connection settings"]')).toBeVisible();
});
