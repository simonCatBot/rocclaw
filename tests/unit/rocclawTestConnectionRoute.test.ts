// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

describe("rocclaw test-connection route", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("returns 400 when the gateway URL is missing", async () => {
    const { POST } = await import("@/app/api/rocclaw/test-connection/route");
    const response = await POST(
      new Request("http://localhost/api/rocclaw/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gateway: { token: "secret" } }),
      })
    );
    expect(response.status).toBe(400);
    const body = (await response.json()) as { ok?: boolean; error?: string };
    expect(body.ok).toBe(false);
    expect(body.error).toBe("Gateway URL is required.");
  });

});
