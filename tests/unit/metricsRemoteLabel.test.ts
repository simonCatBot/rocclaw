// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import { describe, it, expect } from "vitest";

/**
 * Regression tests for the System Metrics "Local" vs "Remote: hostname" label.
 *
 * This was a recurring bug (PRs #38, #41, #42) where client connections
 * incorrectly showed "Local" instead of "Remote". These tests cover all
 * known scenarios to prevent regression.
 *
 * The label depends on two signals:
 * 1. Server-side: connectionMode from /api/gateway-metrics (determined by
 *    hostname match + URL check + cloud presence)
 * 2. Client-side: browser locality (is the browser on localhost or remote?)
 *
 * isRemoteMetrics = connectionMode !== "local" || !isBrowserLocal
 */

// ─── Server-side detection logic ──────────────────────────────────────

// Mirrors isLocalConnection() from gateway-metrics/route.ts
function isLocalUrlCheck(gatewayUrl: string | null): boolean {
  if (!gatewayUrl) return true;
  const normalized = gatewayUrl.toLowerCase().trim();
  return (
    normalized.includes("localhost") ||
    normalized.includes("127.0.0.1") ||
    normalized.includes("::1") ||
    normalized.includes("0.0.0.0")
  );
}

// Mirrors the detection logic from gateway-metrics/route.ts GET handler
function detectConnectionMode(params: {
  gatewayUrl: string | null;
  gatewayHostname: string | undefined | null;
  localHostname: string;
  presenceMode: string | undefined | null;
}): { isLocal: boolean; connectionMode: "local" | "client" } {
  const { gatewayUrl, gatewayHostname, localHostname, presenceMode } = params;

  const isLocalUrl = isLocalUrlCheck(gatewayUrl);
  const isSameHost = !!(
    gatewayHostname &&
    localHostname &&
    gatewayHostname.toLowerCase() === localHostname.toLowerCase()
  );
  const isCloudPresence = presenceMode === "cloud";
  const isLocal = !isCloudPresence && (isSameHost || (!gatewayHostname && isLocalUrl));

  return { isLocal, connectionMode: isLocal ? "local" : "client" };
}

// ─── Client-side display logic ────────────────────────────────────────

// Mirrors the isRemoteMetrics logic from SystemMetricsDashboard.tsx
function computeIsRemoteMetrics(
  connectionMode: string | null,
  isBrowserLocal: boolean
): boolean {
  return connectionMode !== null && (connectionMode !== "local" || !isBrowserLocal);
}

// Mirrors the browser locality check from SystemMetricsDashboard.tsx useEffect
function computeIsBrowserLocal(browserHostname: string): boolean {
  const hostname = browserHostname.toLowerCase();
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "0.0.0.0" ||
    hostname === "[::1]"
  );
}

// ─── End-to-end label determination ───────────────────────────────────

function determineLabel(params: {
  gatewayUrl: string | null;
  gatewayHostname: string | undefined | null;
  localHostname: string;
  presenceMode: string | undefined | null;
  browserHostname: string;
}): { label: "Local" | "Remote"; remoteHostname: string | null } {
  const serverResult = detectConnectionMode({
    gatewayUrl: params.gatewayUrl,
    gatewayHostname: params.gatewayHostname,
    localHostname: params.localHostname,
    presenceMode: params.presenceMode,
  });

  const isBrowserLocal = computeIsBrowserLocal(params.browserHostname);
  const isRemote = computeIsRemoteMetrics(serverResult.connectionMode, isBrowserLocal);

  if (isRemote) {
    const remoteHostname =
      serverResult.connectionMode === "client"
        ? (params.gatewayHostname || params.browserHostname)
        : params.browserHostname;
    return { label: "Remote", remoteHostname };
  }
  return { label: "Local", remoteHostname: null };
}

// ─── Tests ────────────────────────────────────────────────────────────

describe("metrics remote/local label: regression guard", () => {
  describe("server-side detection (connectionMode)", () => {
    it("returns local when rocclaw and gateway are on the same machine", () => {
      const result = detectConnectionMode({
        gatewayUrl: "ws://localhost:18789",
        gatewayHostname: "my-server",
        localHostname: "my-server",
        presenceMode: "server",
      });
      expect(result.connectionMode).toBe("local");
    });

    it("returns client when rocclaw on laptop connects to remote gateway via IP", () => {
      const result = detectConnectionMode({
        gatewayUrl: "ws://192.168.1.100:18789",
        gatewayHostname: "my-server",
        localHostname: "my-laptop",
        presenceMode: "server",
      });
      expect(result.connectionMode).toBe("client");
    });

    it("returns client when using SSH tunnel (localhost URL, different hostnames)", () => {
      // SSH tunnel: ws://localhost:18789 forwards to remote gateway
      const result = detectConnectionMode({
        gatewayUrl: "ws://localhost:18789",
        gatewayHostname: "my-server",
        localHostname: "my-laptop",
        presenceMode: "server",
      });
      expect(result.connectionMode).toBe("client");
    });

    it("returns client when using SSH tunnel with 127.0.0.1 URL, different hostnames", () => {
      const result = detectConnectionMode({
        gatewayUrl: "ws://127.0.0.1:18789",
        gatewayHostname: "my-server",
        localHostname: "my-laptop",
        presenceMode: "server",
      });
      expect(result.connectionMode).toBe("client");
    });

    it("returns local when LAN IP points to same machine (hostname match)", () => {
      const result = detectConnectionMode({
        gatewayUrl: "ws://192.168.1.100:18789",
        gatewayHostname: "my-server",
        localHostname: "my-server",
        presenceMode: "server",
      });
      expect(result.connectionMode).toBe("local");
    });

    it("returns client for cloud gateway even with localhost URL", () => {
      const result = detectConnectionMode({
        gatewayUrl: "ws://localhost:18789",
        gatewayHostname: "cloud-gw-01",
        localHostname: "my-laptop",
        presenceMode: "cloud",
      });
      expect(result.connectionMode).toBe("client");
    });

    it("returns client for Tailscale URL with different hostnames", () => {
      const result = detectConnectionMode({
        gatewayUrl: "wss://my-server.ts.net",
        gatewayHostname: "my-server",
        localHostname: "my-laptop",
        presenceMode: "server",
      });
      expect(result.connectionMode).toBe("client");
    });
  });

  describe("client-side browser locality (isBrowserLocal)", () => {
    it("detects local browser on localhost", () => {
      expect(computeIsBrowserLocal("localhost")).toBe(true);
    });

    it("detects local browser on 127.0.0.1", () => {
      expect(computeIsBrowserLocal("127.0.0.1")).toBe(true);
    });

    it("detects local browser on ::1", () => {
      expect(computeIsBrowserLocal("::1")).toBe(true);
    });

    it("detects remote browser on LAN IP", () => {
      expect(computeIsBrowserLocal("192.168.1.100")).toBe(false);
    });

    it("detects remote browser on public hostname", () => {
      expect(computeIsBrowserLocal("my-server.ts.net")).toBe(false);
    });

    it("detects remote browser on machine IP", () => {
      expect(computeIsBrowserLocal("10.0.0.100")).toBe(false);
    });

    it("is case-insensitive", () => {
      expect(computeIsBrowserLocal("Localhost")).toBe(true);
      expect(computeIsBrowserLocal("LOCALHOST")).toBe(true);
    });
  });

  describe("combined display logic (isRemoteMetrics)", () => {
    it("shows Local when server says local and browser is local", () => {
      expect(computeIsRemoteMetrics("local", true)).toBe(false);
    });

    it("shows Remote when server says client", () => {
      expect(computeIsRemoteMetrics("client", true)).toBe(true);
      expect(computeIsRemoteMetrics("client", false)).toBe(true);
    });

    it("shows Remote when server says local but browser is remote", () => {
      // rocclaw + gateway on same machine, browser on laptop via LAN IP
      expect(computeIsRemoteMetrics("local", false)).toBe(true);
    });

    it("waits for connectionMode before deciding (null state)", () => {
      // During initial load before API responds, don't flash "Remote"
      expect(computeIsRemoteMetrics(null, true)).toBe(false);
      expect(computeIsRemoteMetrics(null, false)).toBe(false);
    });
  });

  describe("end-to-end label scenarios (regression guard)", () => {
    it("shows Local: same machine, same browser (most common local setup)", () => {
      const result = determineLabel({
        gatewayUrl: "ws://localhost:18789",
        gatewayHostname: "my-server",
        localHostname: "my-server",
        presenceMode: "server",
        browserHostname: "localhost",
      });
      expect(result.label).toBe("Local");
    });

    it("shows Remote: laptop connects to remote gateway via direct IP", () => {
      const result = determineLabel({
        gatewayUrl: "ws://10.0.0.100:18789",
        gatewayHostname: "my-server",
        localHostname: "my-laptop",
        presenceMode: "server",
        browserHostname: "localhost",
      });
      expect(result.label).toBe("Remote");
      expect(result.remoteHostname).toBe("my-server");
    });

    it("shows Remote: laptop connects via SSH tunnel (PR #42 regression case)", () => {
      // SSH tunnel makes URL localhost, but gateway is remote
      const result = determineLabel({
        gatewayUrl: "ws://localhost:18789",
        gatewayHostname: "my-server",
        localHostname: "my-laptop",
        presenceMode: "server",
        browserHostname: "localhost",
      });
      expect(result.label).toBe("Remote");
    });

    it("shows Remote: browser accesses same-machine server via LAN IP", () => {
      // rocclaw + gateway on same machine, but browser on laptop accessing via IP
      const result = determineLabel({
        gatewayUrl: "ws://localhost:18789",
        gatewayHostname: "my-server",
        localHostname: "my-server",
        presenceMode: "server",
        browserHostname: "192.168.1.100",
      });
      expect(result.label).toBe("Remote");
    });

    it("shows Remote: cloud gateway", () => {
      const result = determineLabel({
        gatewayUrl: "wss://cloud.openclaw.ai",
        gatewayHostname: "cloud-gw-01",
        localHostname: "my-laptop",
        presenceMode: "cloud",
        browserHostname: "localhost",
      });
      expect(result.label).toBe("Remote");
    });

    it("shows Remote: Tailscale connection", () => {
      const result = determineLabel({
        gatewayUrl: "wss://my-server.ts.net",
        gatewayHostname: "my-server",
        localHostname: "my-laptop",
        presenceMode: "server",
        browserHostname: "localhost",
      });
      expect(result.label).toBe("Remote");
    });

    it("shows Local: LAN IP pointing to same machine (hostname match)", () => {
      const result = determineLabel({
        gatewayUrl: "ws://192.168.1.100:18789",
        gatewayHostname: "my-server",
        localHostname: "my-server",
        presenceMode: "server",
        browserHostname: "localhost",
      });
      expect(result.label).toBe("Local");
    });

    it("shows Local: same machine, browser accesses via 127.0.0.1", () => {
      const result = determineLabel({
        gatewayUrl: "ws://127.0.0.1:18789",
        gatewayHostname: "my-server",
        localHostname: "my-server",
        presenceMode: "server",
        browserHostname: "127.0.0.1",
      });
      expect(result.label).toBe("Local");
    });
  });
});