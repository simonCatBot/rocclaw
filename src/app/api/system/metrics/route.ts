/**
 * System Metrics API Route
 * GET /api/system/metrics
 * Returns CPU, Memory, Disk, Network, GPU and other system information
 */

import { NextRequest, NextResponse } from 'next/server';
import si from 'systeminformation';
import { detectROCm, ROCmGPUInfo } from '@/lib/system/rocm';
import { detectBasicGPU, BasicGPUInfo } from '@/lib/system/gpu-fallback';

export interface SystemMetrics {
  cpu: {
    name: string;
    usage: number;
    cores: number;
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
    // ROCm-specific fields (optional)
    vendor?: string;
    gfxVersion?: string;
    computeUnits?: number;
    maxClockMHz?: number;
    power?: number;
    deviceType?: string;
    // Extended ROCm info
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
  // GPU fallback source info (indicates which detection method was used)
  gpuDetectionMethod?: "rocm" | "systeminfo" | "basic-sysfs" | "none";
}

export interface SystemMetricsOptions {
  /**
   * When true, also attempt fallback GPU detection via sysfs/lspci
   * when ROCm is not installed. This provides basic GPU info even on
   * systems without ROCm drivers.
   * @default false
   */
  includeBasicGpu?: boolean;
}

export async function GET(
  request: NextRequest
): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const includeBasicGpu = searchParams.get("includeBasicGpu") === "true";

  try {
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
      si.networkStats('*').catch(() => []),
      si.processes().catch(() => ({ running: 0, blocked: 0, sleeping: 0, all: 0 })),
      si.osInfo(),
    ]);

    const cpuUsage = Math.round(cpuData.currentLoad ?? 0);
    const memUsage = memData.total > 0 ? Math.round((memData.used / memData.total) * 100) : 0;
    const rootDisk = diskData.find(d => d.fs === '/') || diskData[0];
    const diskUsage = rootDisk && rootDisk.size > 0 ? Math.round((rootDisk.used / rootDisk.size) * 100) : 0;

    // Calculate network stats (total bytes)
    const totalRx = netData.reduce((acc, net) => acc + (net.rx_bytes ?? 0), 0);
    const totalTx = netData.reduce((acc, net) => acc + (net.tx_bytes ?? 0), 0);
    const rxSec = netData.reduce((acc, net) => acc + (net.rx_sec ?? 0), 0);
    const txSec = netData.reduce((acc, net) => acc + (net.tx_sec ?? 0), 0);

    // GPU detection - try ROCm first, then optionally fallback to basic sysfs
    let rocmGpus: ROCmGPUInfo[] = [];
    let basicGpus: BasicGPUInfo[] = [];
    let gpuDetectionMethod: SystemMetrics["gpuDetectionMethod"] = "none";
    // Keep rocmInfo in scope so we can read runtimeVersion for the response
    let rocmInfo: { detected: boolean; gpus: ROCmGPUInfo[]; runtimeVersion?: string } = { detected: false, gpus: [] };

    try {
      rocmInfo = await detectROCm();
      if (rocmInfo.detected && rocmInfo.gpus.length > 0) {
        rocmGpus = rocmInfo.gpus;
      }
    } catch (error) {
      console.log('ROCm detection failed:', error);
    }

    // If no ROCm GPUs and basic GPU detection is enabled, try sysfs/lspci
    if (rocmGpus.length === 0 && includeBasicGpu) {
      try {
        basicGpus = await detectBasicGPU();
      } catch (error) {
        console.log('Basic GPU detection failed:', error);
      }
    }

    // Process GPU data - prefer ROCm data if available, then basic sysfs, then systeminformation
    let gpuMetrics: SystemMetrics['gpu'] = [];
    
    if (rocmGpus.length > 0) {
      gpuDetectionMethod = "rocm";
      // Use ROCm GPU data with detailed info
      gpuMetrics = rocmGpus.map(gpu => ({
        name: gpu.marketingName || gpu.name,
        usage: gpu.usage !== undefined ? gpu.usage : null,
        temperature: gpu.temperature !== undefined ? gpu.temperature : null,
        memory: {
          total: gpu.memory?.total ?? null,
          used: gpu.memory?.used ?? null,
        },
        // ROCm-specific fields
        vendor: gpu.vendor,
        gfxVersion: gpu.gfxVersion,
        computeUnits: gpu.computeUnits,
        maxClockMHz: gpu.maxClockMHz,
        power: gpu.power,
        deviceType: gpu.deviceType,
        // Extended ROCm info from rocm-smi -a
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
      gpuDetectionMethod = "basic-sysfs";
      // Use basic sysfs GPU data
      gpuMetrics = basicGpus.map(gpu => ({
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
      gpuDetectionMethod = "systeminfo";
      // Fallback to systeminformation GPU data
      gpuMetrics = gpuData.controllers
        .filter(gpu => gpu.model || gpu.vendor)
        .map(gpu => ({
          name: gpu.model || gpu.vendor || 'Unknown GPU',
          usage: gpu.utilizationGpu !== null ? Math.round(gpu.utilizationGpu ?? 0) : null,
          temperature: gpu.temperatureGpu !== null ? Math.round(gpu.temperatureGpu ?? 0) : null,
          memory: {
            total: gpu.memoryTotal !== null ? Math.round(gpu.memoryTotal ?? 0) : null,
            used: gpu.memoryUsed !== null ? Math.round(gpu.memoryUsed ?? 0) : null,
          },
        }));
    }

    // Format CPU name
    const cpuName = cpuInfo.brand || cpuInfo.manufacturer || 'Unknown CPU';

    const metrics: SystemMetrics = {
      cpu: {
        name: cpuName,
        usage: cpuUsage,
        cores: cpuData.cpus?.length ?? 0,
        temperature: cpuTemp.main !== null ? Math.round(cpuTemp.main) : null,
        speed: Math.round((cpuInfo.speed ?? 0) * 1000),
        currentSpeedMHz: Math.round((cpuCurrentSpeed.avg ?? 0) * 1000),
        loadAvg: cpuData.avgLoad 
          ? [cpuData.avgLoad, cpuData.avgLoad * 0.9, cpuData.avgLoad * 0.85] as [number, number, number]
          : [0, 0, 0] as [number, number, number],
        coreLoads: (cpuData.cpus ?? []).map((c: { load?: number }) => Math.round(c.load ?? 0)),
      },
      memory: {
        total: Math.round(memData.total / (1024 * 1024 * 1024) * 100) / 100,
        used: Math.round(memData.used / (1024 * 1024 * 1024) * 100) / 100,
        free: Math.round((memData.free || 0) / (1024 * 1024 * 1024) * 100) / 100,
        usage: memUsage,
        swapTotal: Math.round((memData.swaptotal || 0) / (1024 * 1024 * 1024) * 100) / 100,
        swapUsed: Math.round((memData.swapused || 0) / (1024 * 1024 * 1024) * 100) / 100,
        swapFree: Math.round(((memData.swaptotal || 0) - (memData.swapused || 0)) / (1024 * 1024 * 1024) * 100) / 100,
      },
      disk: rootDisk ? {
        total: Math.round(rootDisk.size / (1024 * 1024 * 1024) * 100) / 100,
        used: Math.round(rootDisk.used / (1024 * 1024 * 1024) * 100) / 100,
        free: Math.round(rootDisk.available / (1024 * 1024 * 1024) * 100) / 100,
        usage: diskUsage,
      } : { total: 0, used: 0, free: 0, usage: 0 },
      gpu: gpuMetrics,
      network: {
        rxSec: Math.round(rxSec / 1024), // KB/s
        txSec: Math.round(txSec / 1024), // KB/s
        rxTotal: Math.round(totalRx / (1024 * 1024 * 1024) * 100) / 100, // GB
        txTotal: Math.round(totalTx / (1024 * 1024 * 1024) * 100) / 100, // GB
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
      gpuDetectionMethod,
    };

    return NextResponse.json({ 
      success: true, 
      data: metrics 
    });
  } catch (error) {
    console.error('Failed to get system metrics:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to retrieve system metrics' 
      },
      { status: 500 }
    );
  }
}
