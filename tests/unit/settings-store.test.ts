// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import {
  loadROCclawSettings,
  applyROCclawSettingsPatch,
  redactROCclawSettingsSecrets,
  redactLocalGatewayDefaultsSecrets,
  loadLocalGatewayDefaults,
} from "@/lib/rocclaw/settings-store";
import { defaultROCclawSettings } from "@/lib/rocclaw/settings";

const makeTempDir = (name: string) => path.join(os.tmpdir(), `${name}-${Date.now()}`);

describe("settings-store", () => {
  const priorStateDir = process.env.OPENCLAW_STATE_DIR;
  let tempDir: string | null = null;

  beforeEach(() => {
    tempDir = null;
  });

  afterEach(() => {
    process.env.OPENCLAW_STATE_DIR = priorStateDir;
    if (tempDir) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // ignore cleanup errors
      }
      tempDir = null;
    }
  });

  describe("loadROCclawSettings", () => {
    it("should return default settings when settings file does not exist", () => {
      tempDir = makeTempDir("rocclaw-settings");
      process.env.OPENCLAW_STATE_DIR = tempDir;
      fs.mkdirSync(tempDir, { recursive: true });

      const result = loadROCclawSettings();

      expect(result.version).toBe(1);
      expect(result.gateway).toBeNull();
      expect(result.gatewayAutoStart).toBe(true);
    });

    it("should load and normalize settings from file", () => {
      tempDir = makeTempDir("rocclaw-settings-load");
      process.env.OPENCLAW_STATE_DIR = tempDir;
      
      const settingsDir = path.join(tempDir, "openclaw-rocclaw");
      const settingsFile = path.join(settingsDir, "settings.json");
      
      fs.mkdirSync(settingsDir, { recursive: true });
      fs.writeFileSync(
        settingsFile,
        JSON.stringify({
          version: 1,
          gateway: { url: "ws://127.0.0.1:18789", token: "test-token" },
          gatewayAutoStart: false,
        }),
        "utf8"
      );

      const result = loadROCclawSettings();

      expect(result.gateway).toEqual({ url: "ws://localhost:18789", token: "test-token" });
      expect(result.gatewayAutoStart).toBe(false);
    });

    it("should merge with local gateway defaults when token is missing", () => {
      tempDir = makeTempDir("rocclaw-settings-merge");
      process.env.OPENCLAW_STATE_DIR = tempDir;
      
      const settingsDir = path.join(tempDir, "openclaw-rocclaw");
      const settingsFile = path.join(settingsDir, "settings.json");
      const openclawFile = path.join(tempDir, "openclaw.json");
      
      fs.mkdirSync(settingsDir, { recursive: true });
      fs.writeFileSync(
        settingsFile,
        JSON.stringify({
          version: 1,
          gateway: { url: "ws://localhost:18789", token: "" },
        }),
        "utf8"
      );
      fs.writeFileSync(
        openclawFile,
        JSON.stringify({
          gateway: { port: 18789, auth: { token: "local-token" } },
        }),
        "utf8"
      );

      const result = loadROCclawSettings();

      expect(result.gateway).toEqual({ url: "ws://localhost:18789", token: "local-token" });
    });

    it("should use local gateway defaults when settings has no gateway", () => {
      tempDir = makeTempDir("rocclaw-settings-local-defaults");
      process.env.OPENCLAW_STATE_DIR = tempDir;
      
      const openclawFile = path.join(tempDir, "openclaw.json");
      fs.mkdirSync(tempDir, { recursive: true });
      fs.writeFileSync(
        openclawFile,
        JSON.stringify({
          gateway: { port: 18790, auth: { token: "local-token" } },
        }),
        "utf8"
      );

      const result = loadROCclawSettings();

      expect(result.gateway).toEqual({ url: "ws://localhost:18790", token: "local-token" });
    });

    it("should preserve stored URL when merging local token", () => {
      tempDir = makeTempDir("rocclaw-settings-preserve-url");
      process.env.OPENCLAW_STATE_DIR = tempDir;
      
      const settingsDir = path.join(tempDir, "openclaw-rocclaw");
      fs.mkdirSync(settingsDir, { recursive: true });
      fs.writeFileSync(
        path.join(settingsDir, "settings.json"),
        JSON.stringify({
          version: 1,
          gateway: { url: "ws://custom-host:9999", token: "" },
        }),
        "utf8"
      );
      fs.writeFileSync(
        path.join(tempDir, "openclaw.json"),
        JSON.stringify({
          gateway: { port: 18789, auth: { token: "local-token" } },
        }),
        "utf8"
      );

      const result = loadROCclawSettings();

      expect(result.gateway).toEqual({ url: "ws://custom-host:9999", token: "local-token" });
    });

    it("should fall back to defaults for malformed JSON", () => {
      tempDir = makeTempDir("rocclaw-settings-malformed");
      process.env.OPENCLAW_STATE_DIR = tempDir;

      const settingsDir = path.join(tempDir, "openclaw-rocclaw");
      fs.mkdirSync(settingsDir, { recursive: true });
      fs.writeFileSync(
        path.join(settingsDir, "settings.json"),
        "not valid json",
        "utf8"
      );

      // Corrupt JSON should gracefully fall back to defaults
      const result = loadROCclawSettings();
      expect(result.version).toBe(1);
      expect(result.gatewayAutoStart).toBe(true);
    });

    it("should fall back to defaults for empty settings file", () => {
      tempDir = makeTempDir("rocclaw-settings-empty");
      process.env.OPENCLAW_STATE_DIR = tempDir;

      const settingsDir = path.join(tempDir, "openclaw-rocclaw");
      fs.mkdirSync(settingsDir, { recursive: true });
      fs.writeFileSync(
        path.join(settingsDir, "settings.json"),
        "",
        "utf8"
      );

      // Empty file should gracefully fall back to defaults
      const result = loadROCclawSettings();
      expect(result.version).toBe(1);
      expect(result.gatewayAutoStart).toBe(true);
    });
  });

  describe("applyROCclawSettingsPatch", () => {
    it("should apply patch and persist settings", () => {
      tempDir = makeTempDir("rocclaw-settings-apply");
      process.env.OPENCLAW_STATE_DIR = tempDir;
      
      const settingsDir = path.join(tempDir, "openclaw-rocclaw");
      fs.mkdirSync(settingsDir, { recursive: true });

      const result = applyROCclawSettingsPatch({
        gateway: { url: "ws://new-host:18789", token: "new-token" },
      });

      expect(result.gateway).toEqual({ url: "ws://new-host:18789", token: "new-token" });
      
      // Verify file was written
      const settingsFile = path.join(settingsDir, "settings.json");
      expect(fs.existsSync(settingsFile)).toBe(true);
      
      const persisted = JSON.parse(fs.readFileSync(settingsFile, "utf8"));
      expect(persisted.gateway).toEqual({ url: "ws://new-host:18789", token: "new-token" });
    });

    it("should merge with existing settings", () => {
      tempDir = makeTempDir("rocclaw-settings-merge-patch");
      process.env.OPENCLAW_STATE_DIR = tempDir;
      
      const settingsDir = path.join(tempDir, "openclaw-rocclaw");
      fs.mkdirSync(settingsDir, { recursive: true });
      fs.writeFileSync(
        path.join(settingsDir, "settings.json"),
        JSON.stringify({
          version: 1,
          gateway: { url: "ws://old-host:18789", token: "old-token" },
          gatewayAutoStart: true,
          focused: { "ws://old-host:18789": { mode: "focused", selectedAgentId: "agent-1", filter: "all" } },
          avatars: {},
          avatarSources: {},
        }),
        "utf8"
      );

      const result = applyROCclawSettingsPatch({
        gateway: { url: "ws://new-host:18789" },
      });

      // URL is updated, token is preserved from old settings
      expect(result.gateway).toEqual({ url: "ws://new-host:18789", token: "old-token" });
      expect(result.gatewayAutoStart).toBe(true);
    });

    it("should create settings directory if it does not exist", () => {
      tempDir = makeTempDir("rocclaw-settings-create-dir");
      process.env.OPENCLAW_STATE_DIR = tempDir;
      fs.mkdirSync(tempDir, { recursive: true });

      applyROCclawSettingsPatch({
        gateway: { url: "ws://host:18789", token: "token" },
      });

      const settingsDir = path.join(tempDir, "openclaw-rocclaw");
      expect(fs.existsSync(settingsDir)).toBe(true);
    });
  });

  describe("redactROCclawSettingsSecrets", () => {
    it("should redact token in gateway settings", () => {
      const settings = {
        ...defaultROCclawSettings(),
        gateway: { url: "ws://localhost:18789", token: "secret-token" },
      };

      const result = redactROCclawSettingsSecrets(settings);

      expect(result.gateway).toEqual({ url: "ws://localhost:18789", token: "" });
    });

    it("should return settings unchanged when gateway is null", () => {
      const settings = defaultROCclawSettings();
      settings.gateway = null;

      const result = redactROCclawSettingsSecrets(settings);

      expect(result).toEqual(settings);
    });

    it("should not mutate original settings", () => {
      const settings = {
        ...defaultROCclawSettings(),
        gateway: { url: "ws://localhost:18789", token: "secret-token" },
      };

      const result = redactROCclawSettingsSecrets(settings);

      expect(result).not.toBe(settings);
      expect(settings.gateway?.token).toBe("secret-token");
    });
  });

  describe("redactLocalGatewayDefaultsSecrets", () => {
    it("should redact token in defaults", () => {
      const defaults = { url: "ws://localhost:18789", token: "secret-token" };

      const result = redactLocalGatewayDefaultsSecrets(defaults);

      expect(result).toEqual({ url: "ws://localhost:18789", token: "" });
    });

    it("should return null when input is null", () => {
      const result = redactLocalGatewayDefaultsSecrets(null);
      expect(result).toBeNull();
    });

    it("should not mutate original defaults", () => {
      const defaults = { url: "ws://localhost:18789", token: "secret-token" };

      const result = redactLocalGatewayDefaultsSecrets(defaults);

      expect(result).not.toBe(defaults);
      expect(defaults.token).toBe("secret-token");
    });
  });

  describe("loadLocalGatewayDefaults", () => {
    it("should return null when openclaw.json does not exist", () => {
      tempDir = makeTempDir("rocclaw-no-config");
      process.env.OPENCLAW_STATE_DIR = tempDir;
      fs.mkdirSync(tempDir, { recursive: true });

      const result = loadLocalGatewayDefaults();

      expect(result).toBeNull();
    });

    it("should parse openclaw.json and extract gateway config", () => {
      tempDir = makeTempDir("rocclaw-config");
      process.env.OPENCLAW_STATE_DIR = tempDir;
      
      fs.mkdirSync(tempDir, { recursive: true });
      fs.writeFileSync(
        path.join(tempDir, "openclaw.json"),
        JSON.stringify({
          gateway: { port: 18789, auth: { token: "gateway-token" } },
        }),
        "utf8"
      );

      const result = loadLocalGatewayDefaults();

      expect(result).toEqual({ url: "ws://localhost:18789", token: "gateway-token" });
    });

    it("should return null when gateway has no token", () => {
      tempDir = makeTempDir("rocclaw-no-token");
      process.env.OPENCLAW_STATE_DIR = tempDir;
      
      fs.mkdirSync(tempDir, { recursive: true });
      fs.writeFileSync(
        path.join(tempDir, "openclaw.json"),
        JSON.stringify({
          gateway: { port: 18789, auth: { token: "" } },
        }),
        "utf8"
      );

      const result = loadLocalGatewayDefaults();

      expect(result).toBeNull();
    });

    it("should return null when gateway has no port", () => {
      tempDir = makeTempDir("rocclaw-no-port");
      process.env.OPENCLAW_STATE_DIR = tempDir;
      
      fs.mkdirSync(tempDir, { recursive: true });
      fs.writeFileSync(
        path.join(tempDir, "openclaw.json"),
        JSON.stringify({
          gateway: { auth: { token: "token" } },
        }),
        "utf8"
      );

      const result = loadLocalGatewayDefaults();

      expect(result).toBeNull();
    });

    it("should return null when openclaw.json is not an object", () => {
      tempDir = makeTempDir("rocclaw-invalid-root");
      process.env.OPENCLAW_STATE_DIR = tempDir;
      
      fs.mkdirSync(tempDir, { recursive: true });
      fs.writeFileSync(
        path.join(tempDir, "openclaw.json"),
        JSON.stringify("not an object"),
        "utf8"
      );

      const result = loadLocalGatewayDefaults();

      expect(result).toBeNull();
    });

    it("should return null when gateway is not an object", () => {
      tempDir = makeTempDir("rocclaw-invalid-gateway");
      process.env.OPENCLAW_STATE_DIR = tempDir;
      
      fs.mkdirSync(tempDir, { recursive: true });
      fs.writeFileSync(
        path.join(tempDir, "openclaw.json"),
        JSON.stringify({ gateway: "not an object" }),
        "utf8"
      );

      const result = loadLocalGatewayDefaults();

      expect(result).toBeNull();
    });

    it("should handle malformed JSON gracefully", () => {
      tempDir = makeTempDir("rocclaw-malformed-json");
      process.env.OPENCLAW_STATE_DIR = tempDir;
      
      fs.mkdirSync(tempDir, { recursive: true });
      fs.writeFileSync(
        path.join(tempDir, "openclaw.json"),
        "not valid json",
        "utf8"
      );

      const result = loadLocalGatewayDefaults();

      expect(result).toBeNull();
    });
  });
});
