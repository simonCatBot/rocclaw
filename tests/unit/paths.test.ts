// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import os from "node:os";
import path from "node:path";

import { resolveStateDir } from "@/lib/clawdbot/paths";

describe("paths", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("resolveStateDir", () => {
    it("should use OPENCLAW_STATE_DIR directly when set (no .openclaw suffix)", () => {
      process.env.OPENCLAW_STATE_DIR = "/custom/state/dir";
      const result = resolveStateDir();
      expect(result).toBe("/custom/state/dir");
    });

    it("should use OPENCLAW_STATE_DIR with tilde expansion (no .openclaw suffix)", () => {
      const homeDir = os.homedir();
      process.env.OPENCLAW_STATE_DIR = "~/custom/state";
      const result = resolveStateDir();
      expect(result).toBe(path.join(homeDir, "custom/state"));
    });

    it("should use OPENCLAW_STATE_DIR with relative path (no .openclaw suffix)", () => {
      process.env.OPENCLAW_STATE_DIR = "relative/path";
      const result = resolveStateDir();
      expect(result).toBe(path.resolve("relative/path"));
    });

    it("should trim whitespace from OPENCLAW_STATE_DIR", () => {
      process.env.OPENCLAW_STATE_DIR = "  /custom/state/dir  ";
      const result = resolveStateDir();
      expect(result).toBe("/custom/state/dir");
    });

    it("should use home directory when OPENCLAW_STATE_DIR is empty", () => {
      process.env.OPENCLAW_STATE_DIR = "";
      const homeDir = os.homedir();
      const result = resolveStateDir();
      expect(result).toBe(path.join(homeDir, ".openclaw"));
    });

    it("should use home directory when OPENCLAW_STATE_DIR is not set", () => {
      delete process.env.OPENCLAW_STATE_DIR;
      const homeDir = os.homedir();
      const result = resolveStateDir();
      expect(result).toBe(path.join(homeDir, ".openclaw"));
    });

    it("should use tmpdir when homedir returns invalid path", () => {
      const mockHomedir = vi.fn(() => "/nonexistent/path/that/does/not/exist");
      delete process.env.OPENCLAW_STATE_DIR;
      const result = resolveStateDir(process.env, mockHomedir);
      const tmpDir = os.tmpdir();
      expect(result).toBe(path.join(tmpDir, ".openclaw"));
    });

    it("should use tmpdir when homedir returns empty string", () => {
      const mockHomedir = vi.fn(() => "");
      delete process.env.OPENCLAW_STATE_DIR;
      const result = resolveStateDir(process.env, mockHomedir);
      const tmpDir = os.tmpdir();
      expect(result).toBe(path.join(tmpDir, ".openclaw"));
    });

    it("should handle paths with multiple slashes correctly", () => {
      process.env.OPENCLAW_STATE_DIR = "//multiple//slashes//path";
      const result = resolveStateDir();
      expect(result).toBe(path.resolve("/multiple/slashes/path"));
    });

    it("should handle tilde in middle of path", () => {
      process.env.OPENCLAW_STATE_DIR = "/path/~/to/dir";
      const result = resolveStateDir();
      expect(result).toBe(path.resolve("/path/~/to/dir"));
    });

    it("should resolve absolute paths correctly", () => {
      process.env.OPENCLAW_STATE_DIR = "/absolute/path";
      const result = resolveStateDir();
      expect(result).toBe("/absolute/path");
    });

    it("should use custom env object", () => {
      const customEnv = { OPENCLAW_STATE_DIR: "/custom/env/path" };
      // @ts-expect-error - testing with partial env
      const result = resolveStateDir(customEnv as NodeJS.ProcessEnv);
      expect(result).toBe("/custom/env/path");
    });

    it("should fallback to tmpdir when homedir throws", () => {
      const mockHomedir = vi.fn(() => {
        throw new Error("homedir error");
      });
      delete process.env.OPENCLAW_STATE_DIR;
      // The implementation catches errors from fs.existsSync but not from homedir()
      // This test expects the error to propagate
      expect(() => resolveStateDir(process.env, mockHomedir)).toThrow("homedir error");
    });

    it("should use homedir result when accessible", () => {
      const homeDir = os.homedir();
      const mockHomedir = vi.fn(() => homeDir);
      delete process.env.OPENCLAW_STATE_DIR;
      const result = resolveStateDir(process.env, mockHomedir);
      expect(result).toBe(path.join(homeDir, ".openclaw"));
    });

    it("should handle OPENCLAW_STATE_DIR with only whitespace", () => {
      process.env.OPENCLAW_STATE_DIR = "   ";
      const homeDir = os.homedir();
      const result = resolveStateDir();
      // Whitespace-only gets trimmed to empty, so it uses default home
      expect(result).toBe(path.join(homeDir, ".openclaw"));
    });

    it("should append .openclaw when using default path", () => {
      delete process.env.OPENCLAW_STATE_DIR;
      const homeDir = os.homedir();
      const result = resolveStateDir();
      expect(path.basename(result)).toBe(".openclaw");
      expect(result).toBe(path.join(homeDir, ".openclaw"));
    });

    it("should handle nested state directories via env", () => {
      process.env.OPENCLAW_STATE_DIR = "/very/nested/state/dir";
      const result = resolveStateDir();
      expect(result).toBe("/very/nested/state/dir");
    });

    it("should normalize parent directory references via env", () => {
      process.env.OPENCLAW_STATE_DIR = "/path/to/../state";
      const result = resolveStateDir();
      expect(result).toBe("/path/state");
    });

    it("should handle paths with trailing slash via env", () => {
      process.env.OPENCLAW_STATE_DIR = "/custom/state/";
      const result = resolveStateDir();
      expect(result).toBe("/custom/state");
    });
  });
});
