// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

/**
 * Gateway Metrics API Route
 * GET /api/gateway-metrics
 *
 * Fetches system metrics, routing to the appropriate source:
 * - Local mode: Uses systeminformation directly on the Next.js server
 * - Remote mode (Client/Cloud): Attempts to fetch from gateway via system.metrics method
 *
 * This allows the SystemMetricsDashboard to show the correct metrics
 * for the machine running the gateway, not the local laptop.
 */

import { NextResponse } from "next/server";
import si from "systeminformation";
import { bootstrapDomainRuntime } from "@/lib/controlplane/runtime-route-bootstrap";
import { detectROCm, ROCmGPUInfo } from "@/lib/system/rocm";
import { detectBasicGPU, BasicGPUInfo } from "@/lib/system/gpu-fallback";

export const runtime = "nodejs";

// Cache to remember when gateway doesn't support system.metrics
// Set once on first detection, not checked again until server restart
let gatewayMetricsUnsupported: boolean = false;

export interface SystemMetrics {
  cpu: {
    name: string;
    usage: number;
    physicalCores: number;
    logicalCores: number;
    temperature: number | null;
    speed: number;
    currentSpeedMHz: number;
    loadAvg: [number, number, number];
    coreLoads: number[];
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usage: number;
    swapTotal: number;
    swapUsed: number;
    swapFree: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
    usage: number;
  };
  gpu: {
    name: string;
    usage: number | null;
    temperature: number | null;
    memory: {
      total: number | null;
      used: number | null;
    };
    vendor?: string;
    gfxVersion?: string;
    computeUnits?: number;
    maxClockMHz?: number;
    power?: number;
    deviceType?: string;
    deviceId?: string;
    driverVersion?: string;
    vbiosVersion?: string;
    deviceRev?: string;
    subsystemId?: string;
    guid?: string;
    pciBus?: string;
    currentClockMHz?: number;
  }[];
  network: {
    rxSec: number;
    txSec: number;
    rxTotal: number;
    txTotal: number;
  };
  processes: {
    running: number;
    blocked: number;
    sleeping: number;
    total: number;
  };
  uptime: number;
  hostname: string;
  platform: string;
  // ROCm system-level info (available when rocmGpus.length > 0)
  rocmDetected: boolean;
  rocmRuntimeVersion: string;
}

interface GatewayPresence {
  host?: string;
  mode?: string;
  deviceId?: string;
  instanceId?: string;
  version?: string;
  platform?: string;
  deviceFamily?: string;
  text?: string;
}

async function getLocalMetrics(): Promise<SystemMetrics> {
  const [
    cpuData,
    cpuInfo,
    cpuTemp,
    cpuCurrentSpeed,
    memData,
    diskData,
    gpuData,
    netData,
    processData,
    osInfo,
  ] = await Promise.all([
    si.currentLoad(),
    si.cpu(),
    si.cpuTemperature().catch(() => ({ main: null, cores: [], max: null })),
    si.cpuCurrentSpeed().catch(() => ({ avg: 0, min: 0, max: 0, cores: [] })),
    si.mem(),
    si.fsSize(),
    si.graphics().catch(() => ({ controllers: [] })),
    si.networkStats("*").catch(() => []),
    si.processes().catch(() => ({ running: 0, blocked: 0, sleeping: 0, all: 0 })),
    si.osInfo(),
  ]);

  const cpuUsage = Math.round(cpuData.currentLoad ?? 0);
  const memUsage = memData.total > 0 ? Math.round((memData.used / memData.total) * 100) : 0;
  const rootDisk = diskData.find((d) => d.fs === "/") || diskData[0];
  const diskUsage = rootDisk && rootDisk.size > 0 ? Math.round((rootDisk.used / rootDisk.size) * 100) : 0;

  const totalRx = netData.reduce((acc, net) => acc + (net.rx_bytes ?? 0), 0);
  const totalTx = netData.reduce((acc, net) => acc + (net.tx_bytes ?? 0), 0);
  const rxSec = netData.reduce((acc, net) => acc + (net.rx_sec ?? 0), 0);
  const txSec = netData.reduce((acc, net) => acc + (net.tx_sec ?? 0), 0);

  // Detect ROCm GPU data if available
  let rocmGpus: ROCmGPUInfo[] = [];
  let rocmInfo: { detected: boolean; gpus: ROCmGPUInfo[]; runtimeVersion?: string } = { detected: false, gpus: [] };
  try {
    rocmInfo = await detectROCm();
    if (rocmInfo.detected && rocmInfo.gpus.length > 0) {
      rocmGpus = rocmInfo.gpus;
    }
  } catch {
    // ROCm detection failed, fall back to basic sysfs detection
  }

  // Try basic GPU detection via sysfs/lspci if no ROCm GPUs found
  let basicGpus: BasicGPUInfo[] = [];
  if (rocmGpus.length === 0) {
    try {
      basicGpus = await detectBasicGPU();
    } catch {
      // Basic GPU detection also failed
    }
  }

  let gpuMetrics: SystemMetrics["gpu"] = [];

  if (rocmGpus.length > 0) {
    gpuMetrics = rocmGpus.map((gpu) => ({
      name: gpu.marketingName || gpu.name,
      usage: gpu.usage !== undefined ? gpu.usage : null,
      temperature: gpu.temperature !== undefined ? gpu.temperature : null,
      memory: {
        total: gpu.memory?.total ?? null,
        used: gpu.memory?.used ?? null,
      },
      vendor: gpu.vendor,
      gfxVersion: gpu.gfxVersion,
      computeUnits: gpu.computeUnits,
      maxClockMHz: gpu.maxClockMHz,
      power: gpu.power,
      deviceType: gpu.deviceType,
      deviceId: gpu.deviceId,
      driverVersion: gpu.driverVersion,
      vbiosVersion: gpu.vbiosVersion,
      deviceRev: gpu.deviceRev,
      subsystemId: gpu.subsystemId,
      guid: gpu.guid,
      pciBus: gpu.pciBus,
      currentClockMHz: gpu.currentClockMHz,
    }));
  } else if (basicGpus.length > 0) {
    // Use basic sysfs GPU data (no ROCm required)
    gpuMetrics = basicGpus.map((gpu) => ({
      name: gpu.name,
      usage: gpu.gpuUtilPercent,
      temperature: gpu.currentTemp !== null ? Math.round(gpu.currentTemp) : null,
      memory: {
        total: gpu.vramBytes !== null ? Math.round(gpu.vramBytes / (1024 * 1024 * 1024) * 100) / 100 : null,
        used: gpu.vramUsedBytes !== null ? Math.round(gpu.vramUsedBytes / (1024 * 1024 * 1024) * 100) / 100 : null,
      },
      vendor: gpu.vendor,
      maxClockMHz: gpu.maxClockMHz ?? undefined,
      currentClockMHz: gpu.currentClockMHz ?? undefined,
    }));
  } else {
    gpuMetrics = gpuData.controllers
      .filter((gpu) => gpu.model || gpu.vendor)
      .map((gpu) => ({
        name: gpu.model || gpu.vendor || "Unknown GPU",
        usage: gpu.utilizationGpu !== null ? Math.round(gpu.utilizationGpu ?? 0) : null,
        temperature: gpu.temperatureGpu !== null ? Math.round(gpu.temperatureGpu ?? 0) : null,
        memory: {
          total: gpu.memoryTotal !== null ? Math.round(gpu.memoryTotal ?? 0) : null,
          used: gpu.memoryUsed !== null ? Math.round(gpu.memoryUsed ?? 0) : null,
        },
      }));
  }

  const cpuName = cpuInfo.brand || cpuInfo.manufacturer || "Unknown CPU";

  return {
    cpu: {
      name: cpuName,
      usage: cpuUsage,
      physicalCores: cpuInfo.physicalCores ?? 0,
      logicalCores: cpuInfo.cores ?? 0,
      temperature: cpuTemp.main !== null ? Math.round(cpuTemp.main) : null,
      speed: Math.round((cpuInfo.speed ?? 0) * 1000),
      currentSpeedMHz: Math.round((cpuCurrentSpeed.avg ?? 0) * 1000),
      loadAvg: cpuData.avgLoad
        ? ([cpuData.avgLoad, cpuData.avgLoad * 0.9, cpuData.avgLoad * 0.85] as [number, number, number])
        : ([0, 0, 0] as [number, number, number]),
      coreLoads: (cpuData.cpus ?? []).map((c: { load?: number }) => Math.round(c.load ?? 0)),
    },
    memory: {
      total: Math.round((memData.total / (1024 * 1024 * 1024)) * 100) / 100,
      used: Math.round((memData.used / (1024 * 1024 * 1024)) * 100) / 100,
      free: Math.round((memData.free || 0) / (1024 * 1024 * 1024) * 100) / 100,
      usage: memUsage,
      swapTotal: Math.round(((memData.swaptotal || 0) / (1024 * 1024 * 1024)) * 100) / 100,
      swapUsed: Math.round(((memData.swapused || 0) / (1024 * 1024 * 1024)) * 100) / 100,
      swapFree: Math.round(((memData.swaptotal || 0) - (memData.swapused || 0)) / (1024 * 1024 * 1024) * 100) / 100,
    },
    disk: rootDisk
      ? {
          total: Math.round((rootDisk.size / (1024 * 1024 * 1024)) * 100) / 100,
          used: Math.round((rootDisk.used / (1024 * 1024 * 1024)) * 100) / 100,
          free: Math.round((rootDisk.available / (1024 * 1024 * 1024)) * 100) / 100,
          usage: diskUsage,
        }
      : { total: 0, used: 0, free: 0, usage: 0 },
    gpu: gpuMetrics,
    network: {
      rxSec: Math.round(rxSec / 1024),
      txSec: Math.round(txSec / 1024),
      rxTotal: Math.round((totalRx / (1024 * 1024 * 1024)) * 100) / 100,
      txTotal: Math.round((totalTx / (1024 * 1024 * 1024)) * 100) / 100,
    },
    processes: {
      running: processData.running || 0,
      blocked: processData.blocked || 0,
      sleeping: processData.sleeping || 0,
      total: processData.all || 0,
    },
    uptime: Math.round(process.uptime()),
    hostname: osInfo.hostname,
    platform: `${osInfo.platform} ${osInfo.arch}`,
    rocmDetected: rocmGpus.length > 0,
    rocmRuntimeVersion: rocmInfo.runtimeVersion ?? "",
  };
}

async function getGatewayPresence(controlPlane: { callGateway: (method: string, params: unknown) => Promise<unknown> }): Promise<GatewayPresence | null> {
  try {
    const result = await controlPlane.callGateway("system-presence", {}) as GatewayPresence[] | null;
    if (!result || !Array.isArray(result) || result.length === 0) {
      return null;
    }
    // Look for gateway's own presence entry (has deviceType='gateway' or matches known gateway patterns)
    const gatewayEntry = result.find(
      (entry) => entry.deviceFamily === "gateway" || entry.instanceId?.includes("gateway")
    );
    // Fall back to first entry if no explicit gateway entry found
    return gatewayEntry || result[0];
  } catch {
    return null;
  }
}

/**
 * Gets the gateway URL from the rocCLAW settings store.
 * Returns null if we can't determine it.
 */
async function getGatewayUrlFromSettings(): Promise<string | null> {
  try {
    // Import settings store dynamically to avoid circular deps
    const { loadROCclawSettings } = await import("@/lib/rocclaw/settings-store");
    const settings = loadROCclawSettings();
    return settings.gateway?.url || null;
  } catch {
    return null;
  }
}

/**
 * Determines if we're connected to a local gateway by checking if the URL is localhost/127.0.0.1.
 */
async function isLocalConnection(): Promise<boolean> {
  const gatewayUrl = await getGatewayUrlFromSettings();
  if (!gatewayUrl) return true; // Default to local if unknown
  
  const normalized = gatewayUrl.toLowerCase().trim();
  // Check for various localhost patterns including IPv6
  return (
    normalized.includes("localhost") ||
    normalized.includes("127.0.0.1") ||
    normalized.includes("::1") ||
    normalized.includes("0.0.0.0")
  );
}

async function getMetricsFromGateway(
  controlPlane: { callGateway: (method: string, params: unknown) => Promise<unknown> },
  issueUrl: string
): Promise<SystemMetrics | { unavailable: true; issueUrl: string } | null> {
  // Check cache first - if we already know it's unsupported, skip the call
  if (gatewayMetricsUnsupported) {
    return { unavailable: true, issueUrl };
  }

  try {
    const result = await controlPlane.callGateway("system.metrics", {}) as SystemMetrics | null;
    return result;
  } catch (error) {
    // Check if it's an "unknown method" error - expected before OpenClaw implements system.metrics
    if (error instanceof Error && error.message.includes("unknown method")) {
      // Set the flag - we now know gateway doesn't support this
      gatewayMetricsUnsupported = true;
      return { unavailable: true, issueUrl };
    }
    // Other errors - log but don't spam
    if (error instanceof Error) {
      console.error(`[gateway-metrics] Gateway system.metrics call failed: ${error.message}`);
    }
    return null;
  }
}

export async function GET(): Promise<NextResponse> {
  const bootstrap = await bootstrapDomainRuntime();

  if (bootstrap.kind === "mode-disabled") {
    return NextResponse.json({ error: "API mode is disabled" }, { status: 503 });
  }
  if (bootstrap.kind === "runtime-init-failed") {
    return NextResponse.json(
      { error: "Runtime initialization failed", details: bootstrap.failure },
      { status: 503 }
    );
  }
  if (bootstrap.kind === "start-failed") {
    return NextResponse.json(
      { error: "Runtime start failed", details: bootstrap.message },
      { status: 503 }
    );
  }
  if (bootstrap.kind !== "ready") {
    return NextResponse.json({ error: "Gateway not available", kind: (bootstrap as { kind?: string }).kind }, { status: 503 });
  }

  const controlPlane = bootstrap.runtime;

  try {
    // Determine if we're connected to local or remote gateway
    const presence = await getGatewayPresence(controlPlane);
    const gatewayHostname = presence?.host;
    
    // Get local metrics early — we need the hostname to compare with gateway
    const localMetrics = await getLocalMetrics();
    const localHostname = localMetrics.hostname;

    // Hostname-match detection for local vs remote:
    // The strongest signal is whether the gateway's reported hostname matches our own.
    // - Same hostname = we're on the same machine as the gateway (local)
    // - Different hostname = we're on a different machine (client/remote)
    //   This correctly handles SSH tunnels where the URL is ws://localhost:18789
    //   but the gateway is actually on a remote machine.
    // - Cloud presence always overrides to remote.
    // - If we can't determine the gateway hostname (no presence data), fall back to URL check.
    const isLocalUrl = await isLocalConnection();
    const isSameHost = !!(
      gatewayHostname &&
      localHostname &&
      gatewayHostname.toLowerCase() === localHostname.toLowerCase()
    );
    const isCloudPresence = presence?.mode === "cloud";

    // Local when: hostnames match (strong signal of same machine), OR
    // we have no hostname data AND the URL looks local (best-guess fallback)
    const isLocal = !isCloudPresence && (isSameHost || (!gatewayHostname && isLocalUrl));

    if (isLocal) {
      // Local mode: always use local systeminformation directly
      return NextResponse.json({
        success: true,
        source: "local",
        connectionMode: "local",
        hostname: localHostname,
        data: localMetrics,
        remoteAvailable: false,
      });
    } else {
      // Remote/Client mode: try gateway method first, fall back to local
      const issueUrl = "https://github.com/openclaw/openclaw/issues/60074";
      const gatewayMetrics = await getMetricsFromGateway(controlPlane, issueUrl);

      if (gatewayMetrics && "hostname" in gatewayMetrics && gatewayMetrics.hostname) {
        // Gateway has system.metrics method - use it
        return NextResponse.json({
          success: true,
          source: "gateway",
          connectionMode: "client",
          hostname: gatewayMetrics.hostname,
          data: gatewayMetrics,
          remoteAvailable: true,
        });
      }

      // Gateway doesn't support system.metrics - fall back to local with warning
      // Show gateway hostname from presence to indicate where we're connected
      return NextResponse.json({
        success: true,
        source: "local",
        connectionMode: "client",
        hostname: gatewayHostname || localHostname,
        data: localMetrics,
        remoteAvailable: false,
        warning: `Connected to remote gateway (${gatewayHostname || "unknown"})`,
      });
    }
  } catch (error) {
    console.error("[gateway-metrics] Failed to fetch metrics:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: "Failed to retrieve metrics", details: errorMessage },
      { status: 500 }
    );
  }
}
