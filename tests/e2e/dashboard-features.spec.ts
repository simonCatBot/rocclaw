// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { stubRocclawRoute } from "./helpers/rocclawRoute";
import { stubRuntimeRoutes } from "./helpers/runtimeRoute";

// Helper to stub system metrics routes
const stubSystemMetricsRoutes = async (page: Page) => {
  await page.route("**/api/system/metrics", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          cpu: { name: "Test CPU", usage: 10, cores: 8, temperature: 45, speed: 3000, currentSpeedMHz: 3000, loadAvg: [1, 0.5, 0.2], coreLoads: [10, 20, 15, 5] },
          memory: { total: 32, used: 16, free: 16, usage: 50, swapTotal: 8, swapUsed: 0, swapFree: 8 },
          disk: { total: 500, used: 200, free: 300, usage: 40 },
          gpu: [],
          network: { rxSec: 100, txSec: 50, rxTotal: 1000, txTotal: 500 },
          processes: { running: 100, blocked: 0, sleeping: 200, total: 300 },
          uptime: 86400,
          hostname: "test-localhost",
          platform: "linux x64",
        },
      }),
    });
  });
};

// Helper to stub gateway metrics route
const stubGatewayMetricsRoutes = async (page: Page, response: object) => {
  await page.route("**/api/gateway-metrics", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(response),
    });
  });
};

test.describe("System Metrics Dashboard", () => {
  test("shows local badge when connected locally", async ({ page }) => {
    await stubRocclawRoute(page);
    await stubRuntimeRoutes(page, {
      summary: { status: "connected" },
    });
    await stubSystemMetricsRoutes(page);
    await stubGatewayMetricsRoutes(page, {
      success: true,
      source: "local",
      connectionMode: "local",
      hostname: "test-localhost",
      data: {
        cpu: { name: "Test CPU", usage: 10, cores: 8, temperature: 45, speed: 3000, currentSpeedMHz: 3000, loadAvg: [1, 0.5, 0.2], coreLoads: [10, 20, 15, 5] },
        memory: { total: 32, used: 16, free: 16, usage: 50, swapTotal: 8, swapUsed: 0, swapFree: 8 },
        disk: { total: 500, used: 200, free: 300, usage: 40 },
        gpu: [],
        network: { rxSec: 100, txSec: 50, rxTotal: 1000, txTotal: 500 },
        processes: { running: 100, blocked: 0, sleeping: 200, total: 300 },
        uptime: 86400,
        hostname: "test-localhost",
        platform: "linux x64",
      },
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // System tab is default active - look for System Metrics header
    await expect(page.getByText("System Metrics")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Test CPU")).toBeVisible({ timeout: 5000 });
    // Should show Local badge (exact match) — scope to the System Metrics panel
    await expect(page.locator("section, div").filter({ hasText: /^System Metrics/ }).getByText("Local", { exact: true })).toBeVisible();
  });

  test("shows remote badge when connected to remote gateway", async ({ page }) => {
    await stubRocclawRoute(page);
    await stubRuntimeRoutes(page, {
      summary: { status: "connected" },
    });
    await stubGatewayMetricsRoutes(page, {
      success: true,
      source: "local",
      connectionMode: "client",
      hostname: "test-remote-host",
      data: {
        cpu: { name: "Remote CPU", usage: 10, cores: 32, temperature: 45, speed: 3000, currentSpeedMHz: 3000, loadAvg: [1, 0.5, 0.2], coreLoads: [10, 20, 15, 5] },
        memory: { total: 128, used: 64, free: 64, usage: 50, swapTotal: 8, swapUsed: 0, swapFree: 8 },
        disk: { total: 1000, used: 400, free: 600, usage: 40 },
        gpu: [],
        network: { rxSec: 100, txSec: 50, rxTotal: 1000, txTotal: 500 },
        processes: { running: 200, blocked: 0, sleeping: 400, total: 600 },
        uptime: 86400,
        hostname: "test-remote-host",
        platform: "linux x64",
      },
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Wait for system metrics to load
    await expect(page.getByText("System Metrics")).toBeVisible({ timeout: 5000 });
    // Should show Remote badge with hostname — scope to the System Metrics panel
    await expect(page.locator("section, div").filter({ hasText: /^System Metrics/ }).getByText(/Remote: test-remote-host/)).toBeVisible();
  });
});

test.describe("Token Usage Dashboard", () => {
  test("shows token usage section when connected", async ({ page }) => {
    await stubRocclawRoute(page);
    await stubRuntimeRoutes(page, {
      summary: { status: "connected" },
    });
    await page.route("**/api/usage", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          sessions: [],
          aggregated: {
            totalInputTokens: 1000000,
            totalOutputTokens: 500000,
            totalTokens: 1500000,
            totalMessages: 100,
            totalErrors: 2,
            totalCost: 0.25,
            byAgent: {},
            byModel: {},
          },
          cost: { totalCost: 0.25 },
          totalMessages: 100,
          timeRange: { startDate: "2024-01-01", endDate: "2024-01-31" },
        }),
      });
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Click on Tokens tab in the tab bar (toolbar toggle button)
    await page.getByRole("button", { name: "Show Tokens" }).click();
    await expect(page.getByText("Tokens")).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Settings Panel", () => {
  test("shows settings with gateway section", async ({ page }) => {
    await stubRocclawRoute(page);
    await stubRuntimeRoutes(page, {
      summary: { status: "connected" },
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Click on Settings tab (toolbar toggle button)
    await page.getByRole("button", { name: "Show Settings" }).click();
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible({ timeout: 5000 });
    // Should show gateway section with heading
    await expect(page.getByRole("heading", { name: "Gateway Connection" })).toBeVisible();
  });
});
