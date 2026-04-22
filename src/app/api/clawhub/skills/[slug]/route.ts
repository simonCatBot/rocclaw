// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import { type NextRequest, NextResponse } from "next/server";

const CLAWHUB_REGISTRY = process.env.CLAWHUB_REGISTRY || "https://clawhub.ai";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  try {
    const url = new URL(`/api/v1/skills/${encodeURIComponent(slug)}`, CLAWHUB_REGISTRY);

    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `ClawHub returned ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch skill from ClawHub";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}