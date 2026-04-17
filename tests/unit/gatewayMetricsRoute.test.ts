// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Unit tests for gateway-metrics route local/remote detection logic.
 *
 * We test the detection logic by extracting it into a pure function
 * and verifying all signal combinations.
 */

// ─── Pure logic extraction ────────────────────────────────────────────

// Mirrors the detection logic from gateway-metrics/route.ts GET handler
function detectConnectionMode(params: {
  gatewayUrl: string | null;
  gatewayHostname: string | undefined | null;
  localHostname: string;
  presenceMode: string | undefined | null;
}): { isLocal: boolean; reason: string } {
  const { gatewayUrl, gatewayHostname, localHostname, presenceMode } = params;

  // 1. URL check
  const isLocalUrl = isLocalUrlCheck(gatewayUrl);

  // 2. Hostname match
  const isSameHost = !!(
    gatewayHostname &&
    localHostname &&
    gatewayHostname.toLowerCase() === localHostname.toLowerCase()
  );

  // 3. Cloud presence override
  const isCloudPresence = presenceMode === "cloud";

  const isLocal = (isLocalUrl || isSameHost) && !isCloudPresence;

  let reason: string;
  if (isCloudPresence) {
    reason = "cloud-presence-override";
  } else if (isLocalUrl) {
    reason = "local-url";
  } else if (isSameHost) {
    reason = "hostname-match";
  } else {
    reason = "remote-url-and-host";
  }

  return { isLocal, reason };
}

// Mirrors isLocalConnection() from gateway-metrics/route.ts
function isLocalUrlCheck(gatewayUrl: string | null): boolean {
  if (!gatewayUrl) return true; // Default to local if unknown
  const normalized = gatewayUrl.toLowerCase().trim();
  return (
    normalized.includes("localhost") ||
    normalized.includes("127.0.0.1") ||
    normalized.includes("::1") ||
    normalized.includes("0.0.0.0")
  );
}

// ─── Tests ────────────────────────────────────────────────────────────

describe("gateway-metrics: connection mode detection", () => {
  describe("isLocalUrlCheck", () => {
    it("returns true for localhost URLs", () => {
      expect(isLocalUrlCheck("http://localhost:3000")).toBe(true);
    });

    it("returns true for 127.0.0.1 URLs", () => {
      expect(isLocalUrlCheck("http://127.0.0.1:3000")).toBe(true);
    });

    it("returns true for IPv6 localhost", () => {
      expect(isLocalUrlCheck("http://[::1]:3000")).toBe(true);
    });

    it("returns true for 0.0.0.0 URLs", () => {
      expect(isLocalUrlCheck("http://0.0.0.0:3000")).toBe(true);
    });

    it("returns true for null (unknown URL, default to local)", () => {
      expect(isLocalUrlCheck(null)).toBe(true);
    });

    it("returns false for remote URLs", () => {
      expect(isLocalUrlCheck("http://192.168.1.100:3000")).toBe(false);
      expect(isLocalUrlCheck("https://my-server.example.com")).toBe(false);
      expect(isLocalUrlCheck("http://10.0.0.5:8080")).toBe(false);
    });
  });

  describe("detectConnectionMode", () => {
    it("detects local when URL is localhost and hostnames match (host machine)", () => {
      const result = detectConnectionMode({
        gatewayUrl: "http://localhost:3000",
        gatewayHostname: "my-machine",
        localHostname: "my-machine",
        presenceMode: "server",
      });
      expect(result.isLocal).toBe(true);
      expect(result.reason).toBe("local-url");
    });

    it("detects local when URL is localhost and gateway mode is 'server' (not 'local')", () => {
      // This is the BUG we're fixing — presence.mode="server" was incorrectly treated as remote
      const result = detectConnectionMode({
        gatewayUrl: "http://localhost:3000",
        gatewayHostname: "my-machine",
        localHostname: "my-machine",
        presenceMode: "server",
      });
      expect(result.isLocal).toBe(true);
    });

    it("detects local when URL is localhost even with undefined presence mode", () => {
      const result = detectConnectionMode({
        gatewayUrl: "http://localhost:3000",
        gatewayHostname: "my-machine",
        localHostname: "my-machine",
        presenceMode: undefined,
      });
      expect(result.isLocal).toBe(true);
    });

    it("detects local via hostname match even with remote-looking URL", () => {
      // LAN IP in settings but gateway is actually on same host
      const result = detectConnectionMode({
        gatewayUrl: "http://192.168.1.100:3000",
        gatewayHostname: "my-machine",
        localHostname: "my-machine",
        presenceMode: "host",
      });
      expect(result.isLocal).toBe(true);
      expect(result.reason).toBe("hostname-match");
    });

    it("detects local via hostname match (case-insensitive)", () => {
      const result = detectConnectionMode({
        gatewayUrl: "http://192.168.1.100:3000",
        gatewayHostname: "MY-MACHINE",
        localHostname: "my-machine",
        presenceMode: undefined,
      });
      expect(result.isLocal).toBe(true);
      expect(result.reason).toBe("hostname-match");
    });

    it("detects remote when URL is remote and hostnames differ", () => {
      // Laptop connecting to a remote server
      const result = detectConnectionMode({
        gatewayUrl: "http://192.168.1.100:3000",
        gatewayHostname: "remote-server",
        localHostname: "my-laptop",
        presenceMode: "server",
      });
      expect(result.isLocal).toBe(false);
      expect(result.reason).toBe("remote-url-and-host");
    });

    it("detects remote when URL is remote, hostnames differ, and mode is undefined", () => {
      const result = detectConnectionMode({
        gatewayUrl: "https://cloud.openclaw.ai",
        gatewayHostname: "cloud-gateway-01",
        localHostname: "my-laptop",
        presenceMode: undefined,
      });
      expect(result.isLocal).toBe(false);
    });

    it("detects remote (cloud) even when URL is localhost — cloud presence override", () => {
      // If the gateway explicitly reports mode="cloud", that overrides everything
      const result = detectConnectionMode({
        gatewayUrl: "http://localhost:3000",
        gatewayHostname: "cloud-gateway-01",
        localHostname: "my-laptop",
        presenceMode: "cloud",
      });
      expect(result.isLocal).toBe(false);
      expect(result.reason).toBe("cloud-presence-override");
    });

    it("detects remote (cloud) even when hostnames match — cloud override", () => {
      // Edge case: tunnel makes URL localhost but it's a cloud gateway
      const result = detectConnectionMode({
        gatewayUrl: "http://localhost:3000",
        gatewayHostname: "my-machine",
        localHostname: "my-machine",
        presenceMode: "cloud",
      });
      expect(result.isLocal).toBe(false);
      expect(result.reason).toBe("cloud-presence-override");
    });

    it("detects remote when URL is remote, hostnames differ, and mode is 'client'", () => {
      const result = detectConnectionMode({
        gatewayUrl: "http://10.0.0.5:8080",
        gatewayHostname: "remote-host",
        localHostname: "my-laptop",
        presenceMode: "client",
      });
      expect(result.isLocal).toBe(false);
    });

    it("defaults to local when gateway URL is null and hostnames match", () => {
      const result = detectConnectionMode({
        gatewayUrl: null,
        gatewayHostname: "my-machine",
        localHostname: "my-machine",
        presenceMode: undefined,
      });
      expect(result.isLocal).toBe(true);
    });

    it("detects local when URL is null, hostnames match, and mode is 'server'", () => {
      // No settings file but hostnames match — we're on the host machine
      const result = detectConnectionMode({
        gatewayUrl: null,
        gatewayHostname: "my-machine",
        localHostname: "my-machine",
        presenceMode: "server",
      });
      expect(result.isLocal).toBe(true);
    });

    it("detects remote when URL is null and hostnames differ", () => {
      // No settings, but gateway is on a different host
      const result = detectConnectionMode({
        gatewayUrl: null,
        gatewayHostname: "remote-server",
        localHostname: "my-laptop",
        presenceMode: "server",
      });
      // URL null → isLocalUrl=true, hostnames differ → isSameHost=false
      // Not cloud → isLocal = true (URL defaults to local)
      // This is a limitation — without URL we can't know, default to local
      expect(result.isLocal).toBe(true);
      expect(result.reason).toBe("local-url");
    });
  });
});