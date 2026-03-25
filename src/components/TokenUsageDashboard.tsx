"use client";

import { TokenUsage } from "./TokenUsage";

export function TokenUsageDashboard() {
  return (
    <div className="ui-panel ui-depth-workspace p-4 h-full overflow-y-auto">
      <TokenUsage />
    </div>
  );
}
