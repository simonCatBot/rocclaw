import { NextResponse } from "next/server";

import { bootstrapDomainRuntime } from "@/lib/controlplane/runtime-route-bootstrap";

// GET /api/usage - Fetch token usage data from gateway
export async function GET(request: Request) {
  const runtimeBootstrap = await bootstrapDomainRuntime();
  if (runtimeBootstrap.kind !== "runtime-ok") {
    return NextResponse.json(
      { error: "Gateway not available", details: runtimeBootstrap },
      { status: 503 }
    );
  }
  const controlPlane = runtimeBootstrap.runtime;
  
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get("startDate") ?? undefined;
  const endDate = searchParams.get("endDate") ?? undefined;
  const agentId = searchParams.get("agentId") ?? undefined;
  const tz = searchParams.get("tz") ?? undefined;
  
  try {
    // Fetch usage data from gateway
    const usageResult = await controlPlane.callGateway<GatewayUsageResponse>("sessions.usage", {
      startDate,
      endDate,
      includeContextWeight: true,
      limit: 1000,
      ...(tz ? { tz } : {}),
    });
    
    // Fetch cost data from gateway
    const costResult = await controlPlane.callGateway<GatewayCostResponse>("usage.cost", {
      startDate,
      endDate,
      ...(tz ? { tz } : {}),
    });
    
    // If agentId is specified, filter sessions for that agent
    let sessions = usageResult?.sessions ?? [];
    if (agentId) {
      sessions = sessions.filter((s: SessionInfo) => s.agentId === agentId);
    }
    
    // Aggregate token usage
    const aggregated = aggregateUsage(sessions);
    
    return NextResponse.json({
      sessions,
      aggregated,
      cost: costResult,
      timeRange: {
        startDate: usageResult?.startDate,
        endDate: usageResult?.endDate,
      },
    });
  } catch (error) {
    console.error("Failed to fetch usage data:", error);
    return NextResponse.json(
      { error: "Failed to fetch usage data", details: String(error) },
      { status: 500 }
    );
  }
}

interface SessionInfo {
  key: string;
  agentId?: string;
  model?: string;
  provider?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  cost?: number;
  messageCount?: number;
  errorCount?: number;
  durationMs?: number;
  startedAtMs?: number;
  endedAtMs?: number;
}

interface GatewayUsageResponse {
  sessions?: SessionInfo[];
  startDate?: string;
  endDate?: string;
  totalInputTokens?: number;
  totalOutputTokens?: number;
  totalTokens?: number;
  totalMessages?: number;
  totalErrors?: number;
}

interface GatewayCostResponse {
  totalCost?: number;
  costByModel?: Record<string, number>;
  costByProvider?: Record<string, number>;
  costByDay?: Record<string, number>;
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
    const inputTokens = session.inputTokens ?? 0;
    const outputTokens = session.outputTokens ?? 0;
    const totalTokens = session.totalTokens ?? (inputTokens + outputTokens);
    const messageCount = session.messageCount ?? 0;
    const errorCount = session.errorCount ?? 0;
    const cost = session.cost ?? 0;
    
    result.totalInputTokens += inputTokens;
    result.totalOutputTokens += outputTokens;
    result.totalTokens += totalTokens;
    result.totalMessages += messageCount;
    result.totalErrors += errorCount;
    result.totalCost += cost;
    
    // Aggregate by agent
    const agentId = session.agentId ?? "unknown";
    if (!result.byAgent[agentId]) {
      result.byAgent[agentId] = {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        messageCount: 0,
        errorCount: 0,
        cost: 0,
      };
    }
    result.byAgent[agentId].inputTokens += inputTokens;
    result.byAgent[agentId].outputTokens += outputTokens;
    result.byAgent[agentId].totalTokens += totalTokens;
    result.byAgent[agentId].messageCount += messageCount;
    result.byAgent[agentId].errorCount += errorCount;
    result.byAgent[agentId].cost += cost;
    
    // Aggregate by model
    const model = session.model ?? "unknown";
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
    result.byModel[model].cost += cost;
  }
  
  return result;
}
