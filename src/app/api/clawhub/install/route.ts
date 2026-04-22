// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import { type NextRequest, NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function resolveClawhubBin(): string {
  const env = process.env.CLAWHUB_BIN;
  if (env) return env;
  return "clawhub";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const slug = (body.slug ?? "").trim();

    if (!slug) {
      return NextResponse.json({ error: "Missing slug" }, { status: 400 });
    }

    const { stdout, stderr } = await execFileAsync(resolveClawhubBin(), [
      "install",
      slug,
      "--no-input",
    ], {
      timeout: 60_000,
      maxBuffer: 1 * 1024 * 1024,
    });

    const output = (stdout ?? "").trim();
    const errOutput = (stderr ?? "").trim();

    // clawhub install outputs to stderr for progress, stdout for result
    const success = !errOutput.toLowerCase().includes("error") || output.length > 0;

    return NextResponse.json({
      success,
      slug,
      output: output || errOutput,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to install skill";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}