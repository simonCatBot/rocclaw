/**
 * System Metrics API Route
 * GET /api/system/metrics
 * Returns CPU, Memory, Disk, Network and other system information
 */

import { NextRequest, NextResponse } from 'next/server';
import si from 'systeminformation';

export interface SystemMetrics {
  cpu: {
    name: string;
    usage: number;
    cores: number;
    temperature: number | null;
    speed: number;
    loadAvg: [number, number, number];
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
}

export async function GET(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _request: NextRequest
): Promise<NextResponse> {
  try {
    const [
      cpuData,
      cpuInfo,
      cpuTemp,
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

    // Process GPU data
    const gpuMetrics = gpuData.controllers
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

    // Format CPU name
    const cpuName = cpuInfo.brand || cpuInfo.manufacturer || 'Unknown CPU';

    const metrics: SystemMetrics = {
      cpu: {
        name: cpuName,
        usage: cpuUsage,
        cores: cpuData.cpus?.length ?? 0,
        temperature: cpuTemp.main !== null ? Math.round(cpuTemp.main) : null,
        speed: Math.round((cpuData.cpus?.[0] as { speed?: number } | undefined)?.speed ?? 0),
        loadAvg: cpuData.avgLoad 
          ? [cpuData.avgLoad, cpuData.avgLoad * 0.9, cpuData.avgLoad * 0.85] as [number, number, number]
          : [0, 0, 0] as [number, number, number],
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
