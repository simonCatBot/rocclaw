// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  buildDeviceAuthPayloadV3,
  loadOrCreateDeviceIdentity,
  publicKeyRawBase64UrlFromPem,
  signConnectChallenge,
} from "@/lib/controlplane/device-identity";

const makeTempDir = (name: string) => fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));

describe("device-identity", () => {
  const priorStateDir = process.env.OPENCLAW_STATE_DIR;
  let tempDir: string | null = null;

  beforeEach(() => {
    tempDir = makeTempDir("device-identity-test");
    process.env.OPENCLAW_STATE_DIR = tempDir;
  });

  afterEach(() => {
    process.env.OPENCLAW_STATE_DIR = priorStateDir;
    if (tempDir) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  describe("loadOrCreateDeviceIdentity", () => {
    it("creates a new identity when none exists", () => {
      const identityPath = path.join(tempDir!, "device.json");

      const identity = loadOrCreateDeviceIdentity(identityPath);

      expect(identity.deviceId).toBeDefined();
      expect(identity.deviceId).toMatch(/^[a-f0-9]{64}$/); // 64 hex chars = 256 bits
      expect(identity.publicKeyPem).toMatch(/^-----BEGIN PUBLIC KEY-----/);
      expect(identity.privateKeyPem).toMatch(/^-----BEGIN PRIVATE KEY-----/);
      expect(fs.existsSync(identityPath)).toBe(true);
    });

    it("loads existing identity from disk", () => {
      const identityPath = path.join(tempDir!, "device.json");

      const first = loadOrCreateDeviceIdentity(identityPath);
      const second = loadOrCreateDeviceIdentity(identityPath);

      expect(second.deviceId).toBe(first.deviceId);
      expect(second.publicKeyPem).toBe(first.publicKeyPem);
      expect(second.privateKeyPem).toBe(first.privateKeyPem);
    });

    it("recreates identity if file is corrupt", () => {
      const identityPath = path.join(tempDir!, "device.json");

      fs.mkdirSync(path.dirname(identityPath), { recursive: true });
      fs.writeFileSync(identityPath, "not valid json", { mode: 0o600 });

      const identity = loadOrCreateDeviceIdentity(identityPath);

      expect(identity.deviceId).toBeDefined();
      expect(identity.publicKeyPem).toMatch(/^-----BEGIN PUBLIC KEY-----/);
    });

    it("fixes deviceId if it does not match key fingerprint", () => {
      const identityPath = path.join(tempDir!, "device.json");

      // Create a valid identity first
      const original = loadOrCreateDeviceIdentity(identityPath);
      const originalId = original.deviceId;

      // Tamper with the deviceId
      const stored = JSON.parse(fs.readFileSync(identityPath, "utf8"));
      stored.deviceId = "wrongdeviceid123456789012345678901234567890123456789012345678901234";
      fs.writeFileSync(identityPath, JSON.stringify(stored, null, 2));

      // Should auto-fix the deviceId
      const fixed = loadOrCreateDeviceIdentity(identityPath);
      expect(fixed.deviceId).toBe(originalId);
    });

    it("stores file with restricted permissions", () => {
      const identityPath = path.join(tempDir!, "device.json");

      loadOrCreateDeviceIdentity(identityPath);

      const stats = fs.statSync(identityPath);
      // Check file mode - 0o600 means owner read/write only
      expect(stats.mode & 0o777).toBe(0o600);
    });
  });

  describe("publicKeyRawBase64UrlFromPem", () => {
    it("extracts raw public key as base64url", () => {
      const identityPath = path.join(tempDir!, "device.json");
      const identity = loadOrCreateDeviceIdentity(identityPath);

      const rawBase64Url = publicKeyRawBase64UrlFromPem(identity.publicKeyPem);

      // Should be base64url (no +, /, or = padding)
      expect(rawBase64Url).not.toContain("+");
      expect(rawBase64Url).not.toContain("/");
      expect(rawBase64Url).not.toContain("=");
      // Ed25519 raw keys are 32 bytes = ~43 base64url chars
      expect(rawBase64Url.length).toBeGreaterThan(30);
    });

    it("produces verifiable public key", () => {
      const identityPath = path.join(tempDir!, "device.json");
      const identity = loadOrCreateDeviceIdentity(identityPath);

      const rawBase64Url = publicKeyRawBase64UrlFromPem(identity.publicKeyPem);

      // Verify rawBase64Url is a valid base64url string (no +, /, =)
      expect(rawBase64Url).not.toContain("+");
      expect(rawBase64Url).not.toContain("/");
      expect(rawBase64Url).not.toContain("=");

      // Verify we can reconstruct the key
      const key = crypto.createPublicKey(identity.publicKeyPem);
      expect(key.asymmetricKeyType).toBe("ed25519");
    });
  });

  describe("buildDeviceAuthPayloadV3", () => {
    it("builds correct v3 payload format", () => {
      const payload = buildDeviceAuthPayloadV3({
        deviceId: "test-device-id",
        clientId: "test-client",
        clientMode: "backend",
        role: "operator",
        scopes: ["operator.read", "operator.write"],
        signedAtMs: 1234567890,
        token: "test-token",
        nonce: "test-nonce",
        platform: "node",
        deviceFamily: "rocclaw",
      });

      const parts = payload.split("|");
      expect(parts[0]).toBe("v3");
      expect(parts[1]).toBe("test-device-id");
      expect(parts[2]).toBe("test-client");
      expect(parts[3]).toBe("backend");
      expect(parts[4]).toBe("operator");
      expect(parts[5]).toBe("operator.read,operator.write");
      expect(parts[6]).toBe("1234567890");
      expect(parts[7]).toBe("test-token");
      expect(parts[8]).toBe("test-nonce");
      expect(parts[9]).toBe("node"); // lowercase
      expect(parts[10]).toBe("rocclaw"); // lowercase
    });

    it("normalizes platform and deviceFamily to lowercase", () => {
      const payload = buildDeviceAuthPayloadV3({
        deviceId: "test-device-id",
        clientId: "test-client",
        clientMode: "backend",
        role: "operator",
        scopes: ["operator.read"],
        signedAtMs: 1234567890,
        token: "test-token",
        nonce: "test-nonce",
        platform: "NODE",
        deviceFamily: "ROCCLAW",
      });

      const parts = payload.split("|");
      expect(parts[9]).toBe("node");
      expect(parts[10]).toBe("rocclaw");
    });

    it("trims whitespace from platform and deviceFamily", () => {
      const payload = buildDeviceAuthPayloadV3({
        deviceId: "test-device-id",
        clientId: "test-client",
        clientMode: "backend",
        role: "operator",
        scopes: ["operator.read"],
        signedAtMs: 1234567890,
        token: "test-token",
        nonce: "test-nonce",
        platform: "  node  ",
        deviceFamily: "  rocclaw  ",
      });

      const parts = payload.split("|");
      expect(parts[9]).toBe("node");
      expect(parts[10]).toBe("rocclaw");
    });

    it("handles empty token", () => {
      const payload = buildDeviceAuthPayloadV3({
        deviceId: "test-device-id",
        clientId: "test-client",
        clientMode: "backend",
        role: "operator",
        scopes: ["operator.read"],
        signedAtMs: 1234567890,
        token: "",
        nonce: "test-nonce",
        platform: "node",
        deviceFamily: "rocclaw",
      });

      const parts = payload.split("|");
      expect(parts[7]).toBe("");
    });
  });

  describe("signConnectChallenge", () => {
    it("produces valid connect params", () => {
      const identityPath = path.join(tempDir!, "device.json");
      const identity = loadOrCreateDeviceIdentity(identityPath);

      const params = signConnectChallenge(identity, {
        nonce: "challenge-nonce-123",
        platform: "node",
        deviceFamily: "rocclaw",
        role: "operator",
        scopes: ["operator.admin", "operator.read"],
        client: {
          id: "gateway-client",
          version: "1.0.0",
          mode: "backend",
        },
        token: "auth-token-xyz",
      });

      expect(params.id).toBe(identity.deviceId);
      expect(params.nonce).toBe("challenge-nonce-123");
      expect(params.signedAt).toBeGreaterThan(0);
      expect(params.publicKey).not.toContain("+"); // base64url
      expect(params.publicKey).not.toContain("/");
      expect(params.signature).toBeDefined();
      expect(params.signature.length).toBeGreaterThan(20);
    });

    it("produces verifiable signature", () => {
      const identityPath = path.join(tempDir!, "device.json");
      const identity = loadOrCreateDeviceIdentity(identityPath);

      const params = signConnectChallenge(identity, {
        nonce: "challenge-nonce-123",
        platform: "node",
        deviceFamily: "rocclaw",
        role: "operator",
        scopes: ["operator.read"],
        client: {
          id: "gateway-client",
          version: "1.0.0",
          mode: "backend",
        },
        token: "auth-token-xyz",
      });

      // Reconstruct the payload
      const payload = buildDeviceAuthPayloadV3({
        deviceId: identity.deviceId,
        clientId: "gateway-client",
        clientMode: "backend",
        role: "operator",
        scopes: ["operator.read"],
        signedAtMs: params.signedAt,
        token: "auth-token-xyz",
        nonce: "challenge-nonce-123",
        platform: "node",
        deviceFamily: "rocclaw",
      });

      // Decode base64url signature
      const normalized = params.signature.replaceAll("-", "+").replaceAll("_", "/");
      const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
      const signature = Buffer.from(padded, "base64");

      // Verify with node's crypto
      const key = crypto.createPublicKey(identity.publicKeyPem);
      const verified = crypto.verify(null, Buffer.from(payload, "utf8"), key, signature);

      expect(verified).toBe(true);
    });

    it("includes correct fields in signature payload", () => {
      const identityPath = path.join(tempDir!, "device.json");
      const identity = loadOrCreateDeviceIdentity(identityPath);

      const params = signConnectChallenge(identity, {
        nonce: "test-nonce",
        platform: "web",
        deviceFamily: "control-ui",
        role: "operator",
        scopes: ["operator.write", "operator.read"], // Note: not sorted here
        client: {
          id: "openclaw-control-ui",
          version: "dev",
          mode: "webchat",
        },
        token: "my-token",
      });

      expect(params.id).toBe(identity.deviceId);
      expect(params.nonce).toBe("test-nonce");

      // Verify payload format by checking public key is derived correctly
      const rawKey = publicKeyRawBase64UrlFromPem(identity.publicKeyPem);
      expect(params.publicKey).toBe(rawKey);
    });
  });
});
