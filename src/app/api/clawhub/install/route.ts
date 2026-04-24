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

    let stdout = "";
    let stderr = "";

    try {
      const result = await execFileAsync(resolveClawhubBin(), [
        "install",
        slug,
        "--no-input",
      ], {
        timeout: 60_000,
        maxBuffer: 1 * 1024 * 1024,
      });
      stdout = (result.stdout ?? "").trim();
      stderr = (result.stderr ?? "").trim();
    } catch (execErr) {
      // clawhub exits non-zero for "Already installed" — treat as success
      const errMessage =
        execErr instanceof Error ? execErr.message : String(execErr);
      if (errMessage.includes("Already installed")) {
        return NextResponse.json({
          success: true,
          alreadyInstalled: true,
          slug,
          output: errMessage,
        });
      }
      // Re-throw genuine errors
      throw execErr;
    }

    const output = stdout || stderr;

    return NextResponse.json({
      success: true,
      alreadyInstalled: false,
      slug,
      output,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to install skill";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}