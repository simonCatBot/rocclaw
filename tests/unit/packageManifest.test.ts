// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

// @vitest-environment node

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("package manifest", () => {
  it("does not export local openclaw-rocclaw bin", () => {
    const packageJsonPath = path.join(process.cwd(), "package.json");
    const parsed = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as {
      bin?: Record<string, unknown>;
    };
    const hasOpenclawROCclawBin = Object.prototype.hasOwnProperty.call(
      parsed.bin ?? {},
      "openclaw-rocclaw"
    );
    expect(hasOpenclawROCclawBin).toBe(false);
  });
});
