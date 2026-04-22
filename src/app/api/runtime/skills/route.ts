// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function resolveOpenClawBin(): string {
  const env = process.env.OPENCLAW_BIN;
  if (env) return env;
  return "openclaw";
}

/**
 * Extract the JSON object from openclaw CLI output.
 *
 * The openclaw CLI `skills list --json` command writes everything to stderr,
 * including a human-readable table followed by JSON. We need to find and
 * parse just the JSON portion.
 */
function extractJsonFromOutput(text: string): unknown {
  // Try direct parse first (in case they fix the output channel)
  try {
    return JSON.parse(text);
  } catch {
    // Continue to extraction
  }

  // Find the last top-level JSON object in the output
  // The CLI may print a table then the JSON, so we look for the last '{' that opens a valid object
  let lastBrace = text.lastIndexOf("{");
  while (lastBrace !== -1) {
    try {
      const candidate = text.substring(lastBrace);
      return JSON.parse(candidate);
    } catch {
      // Not a valid JSON start — try the previous brace
      lastBrace = text.lastIndexOf("{", lastBrace - 1);
    }
  }

  throw new Error("No valid JSON found in openclaw output");
}

export async function GET() {
  try {
    // The openclaw CLI writes --json output to stderr, not stdout.
    // We capture both and try to parse JSON from either.
    const result = await execFileAsync(resolveOpenClawBin(), [
      "skills",
      "list",
      "--json",
    ], {
      timeout: 15_000,
      maxBuffer: 4 * 1024 * 1024,
    });

    const output = result.stdout || result.stderr || "";
    const data = extractJsonFromOutput(output);

    return NextResponse.json(data);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to list skills via openclaw CLI";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}