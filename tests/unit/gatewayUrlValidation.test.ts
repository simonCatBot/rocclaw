import { describe, expect, it } from "vitest";

/**
 * Tests the URL validation logic used in ConnectionPage.tsx for gateway URLs.
 * Extracted as a pure function to enable unit testing.
 */
function validateGatewayUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (!/^wss?:\/\//i.test(trimmed)) return "URL must start with ws:// or wss://";
  try {
    new URL(trimmed);
  } catch {
    return "Invalid URL format";
  }
  return null;
}

describe("gateway URL validation", () => {
  it("returns null for empty string", () => {
    expect(validateGatewayUrl("")).toBeNull();
  });

  it("returns null for whitespace-only string", () => {
    expect(validateGatewayUrl("   ")).toBeNull();
  });

  it("returns null for valid ws:// URL", () => {
    expect(validateGatewayUrl("ws://localhost:18789")).toBeNull();
  });

  it("returns null for valid wss:// URL", () => {
    expect(validateGatewayUrl("wss://gateway.example.com")).toBeNull();
  });

  it("returns null for ws:// with IP address", () => {
    expect(validateGatewayUrl("ws://192.168.1.100:18789")).toBeNull();
  });

  it("returns null for wss:// with path", () => {
    expect(validateGatewayUrl("wss://gateway.ts.net/ws")).toBeNull();
  });

  it("returns error for http:// URL", () => {
    expect(validateGatewayUrl("http://localhost:18789")).toBe("URL must start with ws:// or wss://");
  });

  it("returns error for https:// URL", () => {
    expect(validateGatewayUrl("https://gateway.example.com")).toBe("URL must start with ws:// or wss://");
  });

  it("returns error for plain text", () => {
    expect(validateGatewayUrl("not a url")).toBe("URL must start with ws:// or wss://");
  });

  it("returns error for missing protocol", () => {
    expect(validateGatewayUrl("localhost:18789")).toBe("URL must start with ws:// or wss://");
  });

  it("returns error for ws:// without host", () => {
    expect(validateGatewayUrl("ws://")).toBe("Invalid URL format");
  });

  it("is case-insensitive for protocol", () => {
    expect(validateGatewayUrl("WS://localhost:18789")).toBeNull();
    expect(validateGatewayUrl("WSS://gateway.example.com")).toBeNull();
  });

  it("trims whitespace before validation", () => {
    expect(validateGatewayUrl("  ws://localhost:18789  ")).toBeNull();
  });
});
