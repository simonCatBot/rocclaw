// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

"use client";

import { TokenUsage } from "./TokenUsage";

export function TokenUsageDashboard() {
  return (
    <div className="h-full overflow-y-auto">
      <TokenUsage />
    </div>
  );
}
