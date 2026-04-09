// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import { fetchJson } from "@/lib/http";

export const postROCclawIntent = async <T>(path: string, body: Record<string, unknown>): Promise<T> => {
  return await fetchJson<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
};
