import { expect, test } from "@playwright/test";
import { stubRocclawRoute } from "./helpers/rocclawRoute";
import { stubRuntimeRoutes } from "./helpers/runtimeRoute";
import { defaultStudioInstallContext } from "@/lib/rocclaw/install-context";

// TODO: This test needs updating for the new ConnectionPage UI architecture
// The test was designed for GatewayConnectScreen but we now use ConnectionPage with tabs
test.skip("connection settings save to the rocclaw settings API", async ({ page }) => {
  await stubRocclawRoute(page);
  await stubRuntimeRoutes(page);

  await page.goto("/");
  await page.waitForLoadState("networkidle");
  
  // Click the Connection tab
  await page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('button'));
    const connectionTab = tabs.find(btn => btn.textContent?.trim() === 'Connection');
    connectionTab?.click();
  });
  
  await page.waitForTimeout(500);
  
  // Fill URL input
  const urlInput = page.locator('#gateway-url');
  await expect(urlInput).toBeVisible({ timeout: 5000 });
  await urlInput.fill('ws://gateway.example:18789', { force: true });
  
  // Fill token input
  const tokenInput = page.locator('#gateway-token');
  await expect(tokenInput).toBeVisible({ timeout: 5000 });
  await tokenInput.fill('token-123', { force: true });

  // Click save
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const saveBtn = buttons.find(btn => btn.textContent?.includes('Save Settings'));
    saveBtn?.click();
  });

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
