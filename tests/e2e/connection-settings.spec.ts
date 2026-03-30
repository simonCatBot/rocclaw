import { expect, test } from "@playwright/test";
import { stubRocclawRoute } from "./helpers/rocclawRoute";
import { stubRuntimeRoutes } from "./helpers/runtimeRoute";
import { defaultStudioInstallContext } from "@/lib/rocclaw/install-context";

test("connection settings save to the rocclaw settings API", async ({ page }) => {
  await stubRocclawRoute(page);
  await stubRuntimeRoutes(page);

  await page.goto("/");
  await page.getByTestId("studio-menu-toggle").click();
  await page.getByTestId("gateway-settings-toggle").click();
  await expect(page.getByLabel(/Upstream (gateway )?URL/i)).toBeVisible();

  await page.getByLabel(/Upstream (gateway )?URL/i).fill("ws://gateway.example:18789");
  await page.getByLabel("Upstream token").fill("token-123");

  const requestPromise = page.waitForRequest((req) => {
    if (!req.url().includes("/api/rocclaw") || req.method() !== "PUT") {
      return false;
    }
    const payload = JSON.parse(req.postData() ?? "{}") as Record<string, unknown>;
    const gateway = (payload.gateway ?? {}) as { url?: string; token?: string };
    return gateway.url === "ws://gateway.example:18789" && gateway.token === "token-123";
  });

  // Wait for button to be stable and clickable before clicking
  const saveButton = page.getByRole("button", { name: "Save settings" });
  await saveButton.scrollIntoViewIfNeeded();
  await saveButton.waitFor({ state: "visible" });
  await page.waitForTimeout(100); // Brief delay to ensure element is stable
  await saveButton.click({ force: true });
  const request = await requestPromise;

  const payload = JSON.parse(request.postData() ?? "{}") as Record<string, unknown>;
  const gateway = (payload.gateway ?? {}) as { url?: string; token?: string };
  expect(gateway.url).toBe("ws://gateway.example:18789");
  expect(gateway.token).toBe("token-123");
  await expect(page.getByRole("button", { name: "Test connection" })).toBeVisible();
});

test("same-host cloud onboarding keeps the upstream on localhost", async ({ page }) => {
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
  await expect(page.getByText("rocCLAW and OpenClaw on the same cloud machine")).toBeVisible();
  await page.getByRole("button", { name: /rocCLAW and OpenClaw on the same cloud machine/i }).click();
  await expect(page.getByText(/rocCLAW is on a remote host\./i)).toBeVisible();
  await expect(
    page.getByText("tailscale serve --yes --bg --https 443 http://127.0.0.1:3000")
  ).toBeVisible();
  await page.getByRole("button", { name: "Use local defaults" }).click();
  await expect(page.getByLabel("Upstream URL")).toHaveValue("ws://localhost:18789");
});

test("remote gateway onboarding warns about ws tailscale urls", async ({ page }) => {
  await stubRocclawRoute(page);
  await stubRuntimeRoutes(page, {
    summary: {
      status: "disconnected",
      reason: null,
      error: "Control-plane start failed: rocCLAW gateway token is not configured.",
    },
  });

  await page.goto("/");
  await page.getByRole("button", { name: /rocCLAW here, OpenClaw in the cloud/i }).click();
  await page.getByLabel("Upstream URL").fill("ws://gateway-host.ts.net");
  await expect(
    page.getByText(/Use wss:\/\/ for \.ts\.net gateway URLs\./i)
  ).toBeVisible();
});
