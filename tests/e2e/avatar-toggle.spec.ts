// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import { expect, test } from "@playwright/test";
import { stubRocclawRoute } from "./helpers/rocclawRoute";
import { stubRuntimeRoutes } from "./helpers/runtimeRoute";

const FLEET_WITH_TWO_AGENTS = {
  seeds: [
    { agentId: "agent-1", name: "Alice", sessionKey: "agent:agent-1:main" },
    { agentId: "agent-2", name: "Bob", sessionKey: "agent:agent-2:main" },
  ],
  sessionCreatedAgentIds: [],
  sessionSettingsSyncedAgentIds: [],
  summaryPatches: [],
  suggestedSelectedAgentId: "agent-1",
  configSnapshot: null,
};

test.beforeEach(async ({ page }) => {
  await stubRocclawRoute(page, {
    version: 1,
    gateway: null,
    focused: {},
    avatars: {},
  });
  await stubRuntimeRoutes(page, {
    summary: { status: "connected" },
    fleetResult: FLEET_WITH_TWO_AGENTS,
  });
});

test("footer avatar toggle opens dropdown with all three mode options", async ({ page }) => {
  await page.goto("/");

  // Wait for fleet to hydrate
  await expect(page.getByTestId("fleet-agent-row-agent-1")).toBeVisible();

  // Footer is rendered
  const footer = page.locator("footer");
  await expect(footer).toBeVisible();

  // Footer avatar toggle button is present
  const avatarToggle = page.getByRole("button", { name: /avatar mode: auto/i });
  await expect(avatarToggle).toBeVisible();

  // Open the dropdown
  await avatarToggle.click();

  // Dropdown items appear with descriptive accessible names
  // Each mode button's accessible name is "{label} {description}"
  await expect(page.getByRole("menuitem", { name: /auto procedural/i })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: /default profile/i })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: /custom custom/i })).toBeVisible();
});

test("selecting default mode closes dropdown and updates toggle title", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("fleet-agent-row-agent-1")).toBeVisible();

  // Open dropdown
  await page.getByRole("button", { name: /avatar mode: auto/i }).click();

  // Select Default mode
  await page.getByRole("menuitem", { name: /default profile/i }).click();

  // Dropdown is closed
  await expect(page.getByRole("menuitem", { name: /auto procedural/i })).not.toBeVisible();

  // Toggle reflects the new mode — re-query to avoid stale locator
  await expect(
    page.getByRole("button", { name: /avatar mode: default/i })
  ).toHaveAttribute("title", "Avatar mode: Default");
});

test("selecting custom mode persists across page reload", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("fleet-agent-row-agent-1")).toBeVisible();

  // Select Custom
  await page.getByRole("button", { name: /avatar mode: auto/i }).click();
  await page.getByRole("menuitem", { name: /custom custom/i }).click();

  // Reload — mode is restored from localStorage
  await page.reload();
  await expect(page.getByTestId("fleet-agent-row-agent-1")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /avatar mode: custom/i })
  ).toHaveAttribute("title", "Avatar mode: Custom");
});

test("footer avatar toggle is present even when fleet is empty", async ({ page }) => {
  // Override stubs with empty fleet before navigating
  await stubRuntimeRoutes(page, {
    summary: { status: "connected" },
    fleetResult: {
      seeds: [],
      sessionCreatedAgentIds: [],
      sessionSettingsSyncedAgentIds: [],
      summaryPatches: [],
      suggestedSelectedAgentId: null,
      configSnapshot: null,
    },
  });

  await page.goto("/");

  // Footer is rendered
  const footer = page.locator("footer");
  await expect(footer).toBeVisible();

  // Avatar toggle is still present even when fleet is empty
  const avatarToggle = page.getByRole("button", { name: /avatar mode/i });
  await expect(avatarToggle).toBeVisible();
  await expect(avatarToggle).toHaveAttribute("title", "Avatar mode: Auto");
});

test("agent row selection is reflected via CSS class change", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("fleet-agent-row-agent-1")).toBeVisible();

  // Agent-2 starts unselected
  const agent2 = page.getByTestId("fleet-agent-row-agent-2");
  await expect(agent2).not.toHaveClass(/ui-card-selected/);

  // Click selects agent-2
  await agent2.click();
  await expect(agent2).toHaveClass(/ui-card-selected/);

  // Agent-1 is no longer selected
  const agent1 = page.getByTestId("fleet-agent-row-agent-1");
  await expect(agent1).not.toHaveClass(/ui-card-selected/);
});
