// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import { describe, expect, it } from "vitest";
import {
  NEEDS_APPROVAL_BADGE_CLASS,
  resolveAgentStatusBadgeClass,
  resolveAgentStatusLabel,
  resolveGatewayStatusBadgeClass,
  resolveGatewayStatusLabel,
} from "@/features/agents/components/colorSemantics";

describe("colorSemantics", () => {
  it("maps agent statuses to semantic badge classes and labels", () => {
    expect(resolveAgentStatusLabel("idle")).toBe("Idle");
    expect(resolveAgentStatusLabel("running")).toBe("Running");
    expect(resolveAgentStatusLabel("error")).toBe("Error");

    expect(resolveAgentStatusBadgeClass("idle")).toBe("ui-badge-status-idle");
    expect(resolveAgentStatusBadgeClass("running")).toBe("ui-badge-status-running");
    expect(resolveAgentStatusBadgeClass("error")).toBe("ui-badge-status-error");
  });

  it("maps gateway statuses to semantic badge classes and labels", () => {
    expect(resolveGatewayStatusLabel("disconnected")).toBe("Disconnected");
    expect(resolveGatewayStatusLabel("connecting")).toBe("Connecting");
    expect(resolveGatewayStatusLabel("connected")).toBe("Connected");

    expect(resolveGatewayStatusBadgeClass("disconnected")).toBe("ui-badge-status-disconnected");
    expect(resolveGatewayStatusBadgeClass("connecting")).toBe("ui-badge-status-connecting");
    expect(resolveGatewayStatusBadgeClass("connected")).toBe("ui-badge-status-connected");
  });

  it("keeps approval state on its own semantic class", () => {
    expect(NEEDS_APPROVAL_BADGE_CLASS).toBe("ui-badge-approval");
  });
});
