import { expect, test } from "@playwright/test";
import { stubRocclawRoute } from "./helpers/rocclawRoute";
import { stubRuntimeRoutes } from "./helpers/runtimeRoute";
import { defaultStudioInstallContext } from "@/lib/rocclaw/install-context";

test("connection settings save to the rocclaw settings API", async ({ page }) => {
  await stubRocclawRoute(page);
  // Must pass disconnected status so Connection tab is visible
  await stubRuntimeRoutes(page, {
    summary: {
      status: "disconnected",
      reason: null,
      error: "Control-plane start failed: rocCLAW gateway token is not configured.",
    },
  });

  await page.goto("/");
  
  // Connection tab should be visible when disconnected
  await page.waitForLoadState("networkidle");
  
  // Wait for the form to be visible - Connection tab auto-shows when disconnected
  await expect(page.getByText("Gateway URL & Token")).toBeVisible({ timeout: 5000 });
  
  // Fill URL input - use CSS id selector
  await page.locator('#gateway-url').fill('ws://gateway.example:18789');
  
  // Fill token input
  await page.locator('#gateway-token').fill('token-123');

  // Click save
  await page.getByRole("button", { name: "Save Settings" }).click();

  // Verify the settings persisted
  const savedSettings = await page.evaluate(async () => {
    const res = await fetch("/api/rocclaw");
    return res.json();
  });
  const gateway = (savedSettings as { settings?: { gateway?: { url?: string; token?: string } } })
    .settings?.gateway;
  expect(gateway?.url).toBe("ws://gateway.example:18789");
  expect(gateway?.token).toBe("token-123");
});

test("cloud tab uses local defaults when available", async ({ page }) => {
  const installContext = defaultStudioInstallContext();
  installContext.studioHost.remoteShell = true;
  installContext.tailscale.loggedIn = true;
  installContext.tailscale.dnsName = "studio-host.tailnet.ts.net";

  await stubRocclawRoute(
    page,
    {
      version: 1,
      gateway: null,
      focused: {},
      avatars: {},
    },
    {
      localGatewayDefaults: {
        url: "ws://localhost:18789",
        token: "",
      },
      localGatewayDefaultsMeta: {
        hasToken: true,
      },
      installContext,
    }
  );
  await stubRuntimeRoutes(page, {
    summary: {
      status: "disconnected",
      reason: null,
      error: "Control-plane start failed: rocCLAW gateway token is not configured.",
    },
  });

  await page.goto("/");
  // Connection tab is active by default - click Cloud tab
  await page.getByRole("button", { name: /^Cloud$/ }).click();
  
  // Should show Cloud tab content
  await expect(page.getByText("Cloud Setup")).toBeVisible();
  await page.getByRole("button", { name: "Use Local Defaults" }).click();
  // The Gateway URL input is in the right column - when Cloud tab is active, placeholder is wss://gateway.ts.net
  await expect(page.getByPlaceholder(/wss:\/\/gateway.ts.net/)).toHaveValue("ws://localhost:18789");
});

test("client tab warns about ws tailscale urls", async ({ page }) => {
  await stubRocclawRoute(page);
  await stubRuntimeRoutes(page, {
    summary: {
      status: "disconnected",
      reason: null,
      error: "Control-plane start failed: rocCLAW gateway token is not configured.",
    },
  });

  await page.goto("/");
  // Connection tab is active by default - click Client tab
  await page.getByRole("button", { name: /^Client$/ }).click();
  await page.getByPlaceholder(/wss:\/\/gateway.ts.net/).fill("ws://gateway-host.ts.net");
  await expect(
    page.getByText(/Use wss:\/\/ for \.ts\.net gateway URLs\./i)
  ).toBeVisible();
});
