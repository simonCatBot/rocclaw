/**
 * System Metrics API Route
 * GET /api/system/metrics
 * Returns CPU, GPU, RAM usage and other system information
 */

import { NextRequest, NextResponse } from 'next/server';
import si from 'systeminformation';

export interface SystemMetrics {
  cpu: {
    usage: number;
    cores: number;
    temperature: number | null;
    speed: number;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usage: number;
  };
  gpu: {
    usage: number | null;
    temperature: number | null;
    memory: {
      total: number | null;
      used: number | null;
    };
  }[];
  disk: {
    total: number;
    used: number;
    free: number;
    usage: number;
  };
  uptime: number;
  hostname: string;
  platform: string;
}

export async function GET(
  request: NextRequest
): Promise<NextResponse> {
  try {
    // Gather system information in parallel
    const [
      cpuData,
      memData,
      gpuData,
      diskData,
      osInfo,
      cpuTemp
    ] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.graphics(),
      si.fsSize(),
      si.osInfo(),
      si.cpuTemperature().catch(() => ({ main: null, cores: [], max: null })),
    ]);

    // Calculate CPU usage
    const cpuUsage = Math.round(cpuData.currentLoad);
    const cpuSpeed = 0; // Speed property removed from newer systeminformation types

    // Calculate memory usage
    const memUsage = Math.round((memData.used / memData.total) * 100);

    // Process GPU data
    const gpuMetrics = gpuData.controllers.map(gpu => ({
      usage: gpu.utilizationGpu !== null ? Math.round(gpu.utilizationGpu) : null,
      temperature: gpu.temperatureGpu !== null ? Math.round(gpu.temperatureGpu) : null,
      memory: {
        total: gpu.memoryTotal !== null ? Math.round(gpu.memoryTotal) : null,
        used: gpu.memoryUsed !== null ? Math.round(gpu.memoryUsed) : null,
      },
    }));

    // Process disk data (use the root filesystem)
    const rootDisk = diskData.find(d => d.fs === '/') || diskData[0] || null;
    const diskUsage = rootDisk ? Math.round((rootDisk.used / rootDisk.size) * 100) : 0;

    const metrics: SystemMetrics = {
      cpu: {
        usage: cpuUsage,
        cores: cpuData.cpus.length,
        temperature: cpuTemp.main !== null ? Math.round(cpuTemp.main) : null,
        speed: cpuSpeed,
      },
      memory: {
        total: Math.round(memData.total / (1024 * 1024 * 1024) * 100) / 100, // GB
        used: Math.round(memData.used / (1024 * 1024 * 1024) * 100) / 100, // GB
        free: Math.round(memData.free / (1024 * 1024 * 1024) * 100) / 100, // GB
        usage: memUsage,
      },
      gpu: gpuMetrics,
      disk: rootDisk ? {
        total: Math.round(rootDisk.size / (1024 * 1024 * 1024) * 100) / 100, // GB
        used: Math.round(rootDisk.used / (1024 * 1024 * 1024) * 100) / 100, // GB
        free: Math.round(rootDisk.available / (1024 * 1024 * 1024) * 100) / 100, // GB
        usage: diskUsage,
      } : { total: 0, used: 0, free: 0, usage: 0 },
      uptime: Math.round(process.uptime()),
      hostname: osInfo.hostname,
      platform: osInfo.platform,
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
