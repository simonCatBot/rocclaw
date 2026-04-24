// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import { type NextRequest, NextResponse } from "next/server";

const CLAWHUB_REGISTRY = process.env.CLAWHUB_REGISTRY || "https://clawhub.ai";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") ?? "";
  const limit = Math.min(
    Math.max(1, Number(request.nextUrl.searchParams.get("limit") ?? 20)),
    50
  );

  if (!query.trim()) {
    return NextResponse.json({ results: [] });
  }

  try {
    const url = new URL("/api/v1/search", CLAWHUB_REGISTRY);
    url.searchParams.set("q", query);
    url.searchParams.set("limit", String(limit));

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
      err instanceof Error ? err.message : "Failed to search ClawHub";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}