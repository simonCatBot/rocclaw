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

test("fleet row click applies selected CSS class to clicked agent", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByTestId("fleet-agent-row-agent-1")).toBeVisible();
  await expect(page.getByTestId("fleet-agent-row-agent-2")).toBeVisible();

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

test("fleet row click triggers PUT request with focused selectedAgentId", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByTestId("fleet-agent-row-agent-1")).toBeVisible();

  // Capture the focused PUT request
  const focusedPut = page.waitForRequest((req) => {
    if (!req.url().includes("/api/rocclaw") || req.method() !== "PUT") return false;
    try {
      const payload = JSON.parse(req.postData() ?? "{}");
      return (
        payload.focused &&
        Object.values(payload.focused).some(
          (entry: unknown) =>
            typeof entry === "object" &&
            entry !== null &&
            "selectedAgentId" in entry &&
            (entry as { selectedAgentId: string }).selectedAgentId === "agent-2"
        )
      );
    } catch {
      return false;
    }
  });

  await page.getByTestId("fleet-agent-row-agent-2").click();
  const request = await focusedPut;

  const payload = JSON.parse(request.postData() ?? "{}");
  const focusedEntry = Object.values(payload.focused ?? {})[0] as {
    selectedAgentId: string;
  } | null;
  expect(focusedEntry?.selectedAgentId).toBe("agent-2");
});

test("avatar shuffle triggers PUT request with avatar data", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByTestId("fleet-agent-row-agent-1")).toBeVisible();
  await page.getByTestId("fleet-agent-row-agent-1").click();

  // Wait for the inspect panel's AvatarSelector to render — look for shuffle button
  await expect(page.getByRole("button", { name: /shuffle/i })).toBeVisible({ timeout: 10000 });

  // Capture avatar PUT triggered by shuffle
  const avatarPut = page.waitForRequest((req) => {
    if (!req.url().includes("/api/rocclaw") || req.method() !== "PUT") return false;
    try {
      const payload = JSON.parse(req.postData() ?? "{}");
      return "avatars" in payload || "avatarSources" in payload;
    } catch {
      return false;
    }
  });

  await page.getByRole("button", { name: /shuffle/i }).click();

  const request = await avatarPut;
  expect(request).toBeDefined();
  const payload = JSON.parse(request.postData() ?? "{}");
  expect(payload.avatars ?? payload.avatarSources).toBeDefined();
});
