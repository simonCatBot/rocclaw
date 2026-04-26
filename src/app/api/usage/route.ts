// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import { NextResponse } from "next/server";

import { bootstrapDomainRuntime } from "@/lib/controlplane/runtime-route-bootstrap";

export const runtime = "nodejs";

// GET /api/usage - Fetch token usage data from gateway
export async function GET(request: Request) {
  const runtimeBootstrap = await bootstrapDomainRuntime();
  
  if (runtimeBootstrap.kind === "mode-disabled") {
    return NextResponse.json({ error: "API mode is disabled" }, { status: 503 });
  }
  if (runtimeBootstrap.kind === "runtime-init-failed") {
    return NextResponse.json({ error: "Runtime initialization failed", details: runtimeBootstrap.failure }, { status: 503 });
  }
  if (runtimeBootstrap.kind === "start-failed") {
    return NextResponse.json({ error: "Runtime start failed", details: runtimeBootstrap.message }, { status: 503 });
  }
  if (runtimeBootstrap.kind !== "ready") {
    return NextResponse.json({ error: "Gateway not available", details: runtimeBootstrap }, { status: 503 });
  }
  const controlPlane = runtimeBootstrap.runtime;
  
  const { searchParams } = new URL(request.url);
  
  // Helper to convert ISO date to YYYY-MM-DD format required by gateway
  const parseDate = (dateStr: string | null): string | undefined => {
    if (!dateStr) return undefined;
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return undefined;
      return date.toISOString().split("T")[0]; // YYYY-MM-DD
    } catch {
      return undefined;
    }
  };
  
  const startDate = parseDate(searchParams.get("startDate"));
  const endDate = parseDate(searchParams.get("endDate"));
  const agentId = searchParams.get("agentId") ?? undefined;
  const tz = searchParams.get("tz") ?? undefined;
  
  try {
    // Fetch usage data from gateway (dates are optional)
    const usageParams: Record<string, unknown> = {
      includeContextWeight: true,
      limit: 1000,
    };
    if (startDate) usageParams.startDate = startDate;
    if (endDate) usageParams.endDate = endDate;
    if (tz) usageParams.tz = tz;
    
    const usageResult = await controlPlane.callGateway("sessions.usage", usageParams) as { sessions?: SessionInfo[]; startDate?: string; endDate?: string } | undefined;
    
    // Fetch cost data from gateway (dates are optional)
    const costParams: Record<string, unknown> = {};
    if (startDate) costParams.startDate = startDate;
    if (endDate) costParams.endDate = endDate;
    if (tz) costParams.tz = tz;
    
    const costResult = await controlPlane.callGateway("usage.cost", costParams) as { totalCost?: number } | undefined;
    
    // Process sessions - usage data is nested inside session.usage
    let sessions = usageResult?.sessions ?? [] as SessionInfo[];
    
    // Filter by agent if specified
    if (agentId) {
      sessions = sessions.filter((s: SessionInfo) => s.agentId === agentId);
    }
    
    // Aggregate token usage from nested usage objects
    let aggregated;
    try {
      aggregated = aggregateUsage(sessions);
    } catch (aggError) {
      console.error("[usage] Aggregation error:", aggError);
      throw new Error(`Aggregation failed: ${aggError}`);
    }
    
    return NextResponse.json({
      sessions,
      aggregated,
      cost: costResult,
      totalMessages: aggregated.totalMessages,
      timeRange: {
        startDate: usageResult?.startDate,
        endDate: usageResult?.endDate,
      },
    });
  } catch (error) {
    console.error("[usage] Failed to fetch usage data:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Failed to fetch usage data", details: errorMessage },
      { status: 500 }
    );
  }
}

interface SessionInfo {
  key: string;
  agentId?: string;
  model?: string;
  provider?: string;
  usage?: {
    input?: number;
    output?: number;
    totalTokens?: number;
    totalCost?: number;
    messageCounts?: {
      total?: number;
      errors?: number;
    };
    modelUsage?: Array<{
      provider?: string;
      model?: string;
      totals?: {
        input?: number;
        output?: number;
        totalTokens?: number;
        totalCost?: number;
      };
    }>;
  };
  messageCount?: number;
  errorCount?: number;
  durationMs?: number;
  startedAtMs?: number;
  endedAtMs?: number;
}

interface AggregatedUsage {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalMessages: number;
  totalErrors: number;
  totalCost: number;
  byAgent: Record<string, {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    messageCount: number;
    errorCount: number;
    cost: number;
  }>;
  byModel: Record<string, {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    messageCount: number;
    cost: number;
  }>;
}

function aggregateUsage(sessions: SessionInfo[]): AggregatedUsage {
  const result: AggregatedUsage = {
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalTokens: 0,
    totalMessages: 0,
    totalErrors: 0,
    totalCost: 0,
    byAgent: {},
    byModel: {},
  };
  
  for (const session of sessions) {
    // Extract usage data from nested usage object
    const usage = session.usage ?? {};
    const inputTokens = usage.input ?? 0;
    const outputTokens = usage.output ?? 0;
    const totalTokens = usage.totalTokens ?? (inputTokens + outputTokens);
    const totalCost = usage.totalCost ?? 0;
    const messageCount = usage.messageCounts?.total ?? 0;
    const errorCount = usage.messageCounts?.errors ?? 0;
    
    result.totalInputTokens += inputTokens;
    result.totalOutputTokens += outputTokens;
    result.totalTokens += totalTokens;
    result.totalMessages += messageCount;
    result.totalErrors += errorCount;
    result.totalCost += totalCost;
    
    // Aggregate by agent
    const sessionAgentId = session.agentId ?? "unknown";
    if (!result.byAgent[sessionAgentId]) {
      result.byAgent[sessionAgentId] = {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        messageCount: 0,
        errorCount: 0,
        cost: 0,
      };
    }
    result.byAgent[sessionAgentId].inputTokens += inputTokens;
    result.byAgent[sessionAgentId].outputTokens += outputTokens;
    result.byAgent[sessionAgentId].totalTokens += totalTokens;
    result.byAgent[sessionAgentId].messageCount += messageCount;
    result.byAgent[sessionAgentId].errorCount += errorCount;
    result.byAgent[sessionAgentId].cost += totalCost;
    
    // Aggregate by model from modelUsage array
    const modelUsage = usage.modelUsage ?? [];
    for (const mu of modelUsage) {
      const model = mu.model ?? "unknown";
      const muInput = mu.totals?.input ?? 0;
      const muOutput = mu.totals?.output ?? 0;
      const muTotal = mu.totals?.totalTokens ?? (muInput + muOutput);
      const muCost = mu.totals?.totalCost ?? 0;
      
      if (!result.byModel[model]) {
        result.byModel[model] = {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          messageCount: 0,
          cost: 0,
        };
      }
      result.byModel[model].inputTokens += muInput;
      result.byModel[model].outputTokens += muOutput;
      result.byModel[model].totalTokens += muTotal;
      // Distribute messageCount proportionally across models to avoid double-counting
      const modelMessageShare = modelUsage.length > 0 ? Math.round(messageCount / modelUsage.length) : 0;
      result.byModel[model].messageCount += modelMessageShare;
      result.byModel[model].cost += muCost;
    }
    
    // If no modelUsage, use session.model
    if (modelUsage.length === 0 && session.model) {
      const model = session.model;
      if (!result.byModel[model]) {
        result.byModel[model] = {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          messageCount: 0,
          cost: 0,
        };
      }
      result.byModel[model].inputTokens += inputTokens;
      result.byModel[model].outputTokens += outputTokens;
      result.byModel[model].totalTokens += totalTokens;
      result.byModel[model].messageCount += messageCount;
      result.byModel[model].cost += totalCost;
    }
  }
  
  return result;
}
