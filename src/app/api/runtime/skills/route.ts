// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import { type NextRequest, NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function resolveOpenClawBin(): string {
  const env = process.env.OPENCLAW_BIN;
  if (env) return env;
  return "openclaw";
}

export async function GET(_request: NextRequest) {
  try {
    const { stdout } = await execFileAsync(resolveOpenClawBin(), [
      "skills",
      "list",
      "--json",
    ], {
      timeout: 15_000,
      maxBuffer: 2 * 1024 * 1024,
    });

    const data = JSON.parse(stdout);
    return NextResponse.json(data);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to list skills via openclaw CLI";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}