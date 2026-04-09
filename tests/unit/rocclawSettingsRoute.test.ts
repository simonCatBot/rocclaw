// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { GET, PUT } from "@/app/api/rocclaw/route";

const makeTempDir = (name: string) => fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));

describe("rocclaw settings route", () => {
  const priorStateDir = process.env.OPENCLAW_STATE_DIR;
  const priorROCclawDomainApiMode = process.env.ROCCLAW_DOMAIN_API_MODE;
  const priorNextPublicROCclawDomainApiMode = process.env.NEXT_PUBLIC_ROCCLAW_DOMAIN_API_MODE;
  let tempDir: string | null = null;

  afterEach(() => {
    process.env.OPENCLAW_STATE_DIR = priorStateDir;
    process.env.ROCCLAW_DOMAIN_API_MODE = priorROCclawDomainApiMode;
    process.env.NEXT_PUBLIC_ROCCLAW_DOMAIN_API_MODE = priorNextPublicROCclawDomainApiMode;
    if (tempDir) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  it("GET returns default settings when missing", async () => {
    tempDir = makeTempDir("rocclaw-settings-get-default");
    process.env.OPENCLAW_STATE_DIR = tempDir;

    const response = await GET();
    const body = (await response.json()) as {
      settings?: Record<string, unknown>;
      localGatewayDefaults?: unknown;
      localGatewayDefaultsMeta?: { hasToken?: unknown };
      gatewayMeta?: { hasStoredToken?: unknown };
      installContext?: Record<string, unknown>;
      domainApiModeEnabled?: unknown;
    };

    expect(response.status).toBe(200);
    expect(body.settings?.gateway).toBe(null);
    expect(body.localGatewayDefaults ?? null).toBeNull();
    expect(body.localGatewayDefaultsMeta?.hasToken).toBe(false);
    expect(body.gatewayMeta?.hasStoredToken).toBe(false);
    expect(body.installContext).toBeTruthy();
    expect(typeof body.domainApiModeEnabled).toBe("boolean");
    expect(body.settings?.version).toBe(1);
    expect(body.settings?.gatewayAutoStart).toBe(true);
  });

  it("GET always reports domain mode enabled", async () => {
    tempDir = makeTempDir("rocclaw-settings-domain-mode");
    process.env.OPENCLAW_STATE_DIR = tempDir;
    process.env.NEXT_PUBLIC_ROCCLAW_DOMAIN_API_MODE = "true";
    process.env.ROCCLAW_DOMAIN_API_MODE = "false";

    const response = await GET();
    const body = (await response.json()) as { domainApiModeEnabled?: unknown };
    expect(response.status).toBe(200);
    expect(body.domainApiModeEnabled).toBe(true);
  });

  it("GET returns local gateway defaults from openclaw.json", async () => {
    tempDir = makeTempDir("rocclaw-settings-get-local-defaults");
    process.env.OPENCLAW_STATE_DIR = tempDir;
    fs.writeFileSync(
      path.join(tempDir, "openclaw.json"),
      JSON.stringify({ gateway: { port: 18791, auth: { token: "local-token" } } }, null, 2),
      "utf8"
    );

    const response = await GET();
    const body = (await response.json()) as {
      settings?: { gateway?: { url?: string; token?: string } | null };
      localGatewayDefaults?: { url?: string; token?: string } | null;
      localGatewayDefaultsMeta?: { hasToken?: unknown };
      gatewayMeta?: { hasStoredToken?: unknown };
    };

    expect(response.status).toBe(200);
    expect(body.localGatewayDefaults).toEqual({
      url: "ws://localhost:18791",
      token: "",
    });
    expect(body.localGatewayDefaultsMeta?.hasToken).toBe(true);
    expect(body.gatewayMeta?.hasStoredToken).toBe(true);
    expect(body.settings?.gateway).toEqual({
      url: "ws://localhost:18791",
      token: "",
    });
  });

  it("PUT returns 400 for non-object JSON payload", async () => {
    tempDir = makeTempDir("rocclaw-settings-put-invalid");
    process.env.OPENCLAW_STATE_DIR = tempDir;

    const response = await PUT({
      json: async () => "nope",
    } as unknown as Request);
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(400);
    expect(typeof body.error).toBe("string");
    expect(body.error?.length).toBeGreaterThan(0);
  });

  it("PUT persists a patch and GET returns merged settings", async () => {
    tempDir = makeTempDir("rocclaw-settings-put-persist");
    process.env.OPENCLAW_STATE_DIR = tempDir;

    const patch = {
      gateway: { url: "ws://example.test:1234", token: "t" },
    };

    const putResponse = await PUT({
      json: async () => patch,
    } as unknown as Request);
    expect(putResponse.status).toBe(200);

    const getResponse = await GET();
    const body = (await getResponse.json()) as {
      settings?: { gateway?: { url?: string; token?: string } | null };
      gatewayMeta?: { hasStoredToken?: unknown };
    };

    expect(getResponse.status).toBe(200);
    expect(body.settings?.gateway).toEqual({ url: "ws://example.test:1234", token: "" });
    expect(body.gatewayMeta?.hasStoredToken).toBe(true);

    const settingsPath = path.join(tempDir, "openclaw-rocclaw", "settings.json");
    expect(fs.existsSync(settingsPath)).toBe(true);
    const raw = fs.readFileSync(settingsPath, "utf8");
    const parsed = JSON.parse(raw) as {
      gateway?: { url?: string; token?: string } | null;
      gatewayAutoStart?: boolean;
    };
    expect(parsed.gateway).toEqual({ url: "ws://example.test:1234", token: "t" });
    expect(parsed.gatewayAutoStart).toBe(true);
  });

  it("PUT url-only gateway patch preserves existing token", async () => {
    tempDir = makeTempDir("rocclaw-settings-put-url-only");
    process.env.OPENCLAW_STATE_DIR = tempDir;
    fs.mkdirSync(path.join(tempDir, "openclaw-rocclaw"), { recursive: true });
    fs.writeFileSync(
      path.join(tempDir, "openclaw-rocclaw", "settings.json"),
      JSON.stringify(
        {
          version: 1,
          gateway: { url: "ws://old.example:18789", token: "secret-token" },
          focused: {},
          avatars: {},
        },
        null,
        2
      ),
      "utf8"
    );

    const putResponse = await PUT({
      json: async () => ({ gateway: { url: "ws://new.example:18789" } }),
    } as unknown as Request);
    expect(putResponse.status).toBe(200);

    const getResponse = await GET();
    const body = (await getResponse.json()) as {
      settings?: { gateway?: { url?: string; token?: string } | null };
      gatewayMeta?: { hasStoredToken?: unknown };
    };
    expect(getResponse.status).toBe(200);
    expect(body.settings?.gateway).toEqual({ url: "ws://new.example:18789", token: "" });
    expect(body.gatewayMeta?.hasStoredToken).toBe(true);

    const persisted = JSON.parse(
      fs.readFileSync(path.join(tempDir, "openclaw-rocclaw", "settings.json"), "utf8")
    ) as { gateway?: { url?: string; token?: string }; gatewayAutoStart?: boolean };
    expect(persisted.gateway).toEqual({
      url: "ws://new.example:18789",
      token: "secret-token",
    });
    expect(persisted.gatewayAutoStart).toBe(true);
  });
});
