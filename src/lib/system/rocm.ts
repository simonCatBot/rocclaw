/**
 * ROCm GPU Detection and Metrics Module
 * Detects rocminfo/rocm-smi and provides GPU information
 */

import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface ROCmGPUInfo {
  index: number;
  name: string;
  marketingName: string;
  vendor: string;
  deviceType: "GPU" | "CPU";
  gfxVersion: string;
  computeUnits: number;
  maxClockMHz: number;
  // Extended info from rocm-smi -a
  deviceId?: string;
  driverVersion?: string;
  vbiosVersion?: string;
  deviceRev?: string;
  subsystemId?: string;
  guid?: string;
  pciBus?: string;
  memory?: {
    total: number; // GB
    used: number; // GB
  };
  usage?: number; // percentage
  temperature?: number; // celsius
  power?: number; // watts
  currentClockMHz?: number;
}

export interface ROCmSystemInfo {
  runtimeVersion: string;
  gpus: ROCmGPUInfo[];
  detected: boolean;
  rocmInfoPath?: string;
  rocmSmiPath?: string;
}

/**
 * Check if rocminfo is available in PATH or /opt/rocm
 */
async function findRocmInfo(): Promise<string | null> {
  const paths = [
    "/usr/bin/rocminfo",
    "/opt/rocm/bin/rocminfo",
    "/opt/rocm/latest/bin/rocminfo",
  ];

  for (const path of paths) {
    try {
      await execAsync(`test -x ${path}`);
      return path;
    } catch {
      continue;
    }
  }

  // Try PATH
  try {
    await execAsync("which rocminfo");
    return "rocminfo";
  } catch {
    return null;
  }
}

/**
 * Check if rocm-smi is available in PATH or /opt/rocm
 */
async function findRocmSmi(): Promise<string | null> {
  const paths = [
    "/usr/bin/rocm-smi",
    "/opt/rocm/bin/rocm-smi",
    "/opt/rocm/latest/bin/rocm-smi",
  ];

  for (const path of paths) {
    try {
      await execAsync(`test -x ${path}`);
      return path;
    } catch {
      continue;
    }
  }

  // Try PATH
  try {
    await execAsync("which rocm-smi");
    return "rocm-smi";
  } catch {
    return null;
  }
}

/**
 * Parse rocminfo output to extract GPU details
 */
function parseRocmInfo(output: string): ROCmGPUInfo[] {
  const gpus: ROCmGPUInfo[] = [];
  const agentBlocks = output.split("*******").filter((block) =>
    block.includes("Device Type:")
  );

  let gpuIndex = 0;
  for (const block of agentBlocks) {
    const deviceTypeMatch = block.match(/Device Type:\s*(\w+)/);
    const deviceType = deviceTypeMatch?.[1] || "Unknown";

    if (deviceType === "GPU") {
      const nameMatch = block.match(/Name:\s*(.+)/);
      const marketingNameMatch = block.match(/Marketing Name:\s*(.+)/);
      const vendorMatch = block.match(/Vendor Name:\s*(.+)/);
      const gfxVersionMatch = block.match(/Name:\s*(gfx\d+)/);
      const computeUnitsMatch = block.match(/Compute Unit:\s*(\d+)/);
      const maxClockMatch = block.match(/Max Clock Freq\. \(MHz\):\s*(\d+)/);

      gpus.push({
        index: gpuIndex++,
        name: nameMatch?.[1]?.trim() || "Unknown GPU",
        marketingName: marketingNameMatch?.[1]?.trim() || "AMD GPU",
        vendor: vendorMatch?.[1]?.trim() || "AMD",
        deviceType: "GPU",
        gfxVersion: gfxVersionMatch?.[1]?.trim() || "unknown",
        computeUnits: parseInt(computeUnitsMatch?.[1] || "0", 10),
        maxClockMHz: parseInt(maxClockMatch?.[1] || "0", 10),
      });
    }
  }

  return gpus;
}

/**
 * Parse comprehensive GPU info from rocm-smi -a output
 */
function parseRocmSmiAll(output: string): Map<number, Partial<ROCmGPUInfo>> {
  const gpuInfoMap = new Map<number, Partial<ROCmGPUInfo>>();
  
  // Split output by GPU sections
  const lines = output.split('\n');
  let currentGpuIndex: number | null = null;
  
  for (const line of lines) {
    // Check for GPU index
    const gpuMatch = line.match(/GPU\[(\d+)\]/);
    if (gpuMatch) {
      currentGpuIndex = parseInt(gpuMatch[1], 10);
      if (!gpuInfoMap.has(currentGpuIndex)) {
        gpuInfoMap.set(currentGpuIndex, { index: currentGpuIndex });
      }
    }
    
    if (currentGpuIndex === null) continue;
    
    const currentInfo = gpuInfoMap.get(currentGpuIndex) || {};
    
    // Device ID
    const deviceIdMatch = line.match(/Device ID:\s*(0x[0-9a-fA-F]+)/);
    if (deviceIdMatch) {
      currentInfo.deviceId = deviceIdMatch[1];
    }
    
    // Device Revision
    const deviceRevMatch = line.match(/Device Rev:\s*(0x[0-9a-fA-F]+)/);
    if (deviceRevMatch) {
      currentInfo.deviceRev = deviceRevMatch[1];
    }
    
    // Subsystem ID
    const subsysIdMatch = line.match(/Subsystem ID:\s*(-?0x[0-9a-fA-F]+)/);
    if (subsysIdMatch) {
      currentInfo.subsystemId = subsysIdMatch[1];
    }
    
    // GUID
    const guidMatch = line.match(/GUID:\s*(\d+)/);
    if (guidMatch) {
      currentInfo.guid = guidMatch[1];
    }
    
    // VBIOS version
    const vbiosMatch = line.match(/VBIOS version:\s*(.+)/);
    if (vbiosMatch) {
      currentInfo.vbiosVersion = vbiosMatch[1].trim();
    }
    
    // PCI Bus
    const pciMatch = line.match(/PCI Bus:\s*(.+)/);
    if (pciMatch) {
      currentInfo.pciBus = pciMatch[1].trim();
    }
    
    // Current clock frequency (from sclk clock level line)
    const clockMatch = line.match(/sclk clock level:\s*\d+:\s*\((\d+)Mhz\)/);
    if (clockMatch) {
      currentInfo.currentClockMHz = parseInt(clockMatch[1], 10);
    }
    
    gpuInfoMap.set(currentGpuIndex, currentInfo);
  }
  
  return gpuInfoMap;
}

/**
 * Get driver version from rocm-smi
 */
function parseDriverVersion(output: string): string {
  const match = output.match(/Driver version:\s*(.+)/);
  return match?.[1]?.trim() || "unknown";
}

/**
 * Get GPU usage from rocm-smi
 */
async function getGpuUsage(rocmSmiPath: string): Promise<
  Map<
    number,
    {
      usage?: number;
      temperature?: number;
      power?: number;
      memoryUsed?: number;
      memoryTotal?: number;
    }
  >
> {
  const usageMap = new Map<
    number,
    {
      usage?: number;
      temperature?: number;
      power?: number;
      memoryUsed?: number;
      memoryTotal?: number;
    }
  >();

  try {
    // Get GPU usage percentage
    const { stdout: useOutput } = await execAsync(
      `${rocmSmiPath} --showuse 2>/dev/null`
    );
    const useMatches = useOutput.matchAll(
      /GPU\[(\d+)\][\s\S]*?GPU use \(%\):\s*(\d+)/g
    );
    for (const match of useMatches) {
      const index = parseInt(match[1], 10);
      const usage = parseInt(match[2], 10);
      const current = usageMap.get(index) || {};
      usageMap.set(index, { ...current, usage });
    }
  } catch {
    // Ignore errors - rocm-smi might not support all flags
  }

  try {
    // Get temperature
    const { stdout: tempOutput } = await execAsync(
      `${rocmSmiPath} --showtemperature 2>/dev/null`
    );
    const tempMatches = tempOutput.matchAll(
      /GPU\[(\d+)\][\s\S]*?Temperature \(Sensor edge\) \(C\):\s*([\d.]+)/g
    );
    for (const match of tempMatches) {
      const index = parseInt(match[1], 10);
      const temperature = Math.round(parseFloat(match[2]));
      const current = usageMap.get(index) || {};
      usageMap.set(index, { ...current, temperature });
    }
  } catch {
    // Ignore errors
  }

  try {
    // Get power consumption
    const { stdout: powerOutput } = await execAsync(
      `${rocmSmiPath} --showpower 2>/dev/null`
    );
    const powerMatches = powerOutput.matchAll(
      /GPU\[(\d+)\][\s\S]*?Current Socket Graphics Package Power \(W\):\s*([\d.]+)/g
    );
    for (const match of powerMatches) {
      const index = parseInt(match[1], 10);
      const power = parseFloat(match[2]);
      const current = usageMap.get(index) || {};
      usageMap.set(index, { ...current, power });
    }
  } catch {
    // Ignore errors
  }

  try {
    // Get VRAM usage - use --showmeminfo vram instead of --showvram
    const { stdout: vramOutput } = await execAsync(
      `${rocmSmiPath} --showmeminfo vram 2>/dev/null`
    );
    // Parse: GPU[0] : VRAM Total Memory (B): 34359738368
    //         GPU[0] : VRAM Total Used Memory (B): 912105472
    const vramTotalMatches = vramOutput.matchAll(
      /GPU\[(\d+)\][\s\S]*?VRAM Total Memory \(B\):\s*(\d+)/g
    );
    const vramUsedMatches = vramOutput.matchAll(
      /GPU\[(\d+)\][\s\S]*?VRAM Total Used Memory \(B\):\s*(\d+)/g
    );
    
    for (const match of vramTotalMatches) {
      const index = parseInt(match[1], 10);
      const totalBytes = parseInt(match[2], 10);
      const current = usageMap.get(index) || {};
      usageMap.set(index, {
        ...current,
        memoryTotal: Math.round(totalBytes / (1024 * 1024 * 1024) * 100) / 100,
      });
    }
    
    for (const match of vramUsedMatches) {
      const index = parseInt(match[1], 10);
      const usedBytes = parseInt(match[2], 10);
      const current = usageMap.get(index) || {};
      usageMap.set(index, {
        ...current,
        memoryUsed: Math.round(usedBytes / (1024 * 1024 * 1024) * 100) / 100,
      });
    }
  } catch {
    // Ignore errors
  }

  return usageMap;
}

/**
 * Get comprehensive GPU info from rocm-smi -a
 */
async function getComprehensiveGpuInfo(rocmSmiPath: string): Promise<{
  driverVersion: string;
  gpuInfo: Map<number, Partial<ROCmGPUInfo>>;
}> {
  try {
    const { stdout } = await execAsync(`${rocmSmiPath} -a 2>&1`);
    const driverVersion = parseDriverVersion(stdout);
    const gpuInfo = parseRocmSmiAll(stdout);
    return { driverVersion, gpuInfo };
  } catch (error) {
    console.error("Failed to get comprehensive GPU info:", error);
    return { driverVersion: "unknown", gpuInfo: new Map() };
  }
}

/**
 * Get ROCm runtime version
 */
async function getRocmVersion(rocmInfoPath: string): Promise<string> {
  try {
    const { stdout } = await execAsync(`${rocmInfoPath} 2>&1`);
    const versionMatch = stdout.match(/Runtime Version:\s*([\d.]+)/);
    return versionMatch?.[1] || "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * Detect ROCm installation and get GPU information
 */
export async function detectROCm(): Promise<ROCmSystemInfo> {
  const rocmInfoPath = await findRocmInfo();
  const rocmSmiPath = await findRocmSmi();

  if (!rocmInfoPath) {
    return {
      detected: false,
      runtimeVersion: "",
      gpus: [],
    };
  }

  try {
    const { stdout } = await execAsync(`${rocmInfoPath} 2>&1`);
    const gpus = parseRocmInfo(stdout);
    const runtimeVersion = await getRocmVersion(rocmInfoPath);

    // Get comprehensive info from rocm-smi -a
    let driverVersion = "unknown";
    let comprehensiveInfo = new Map<number, Partial<ROCmGPUInfo>>();
    
    if (rocmSmiPath) {
      const comprehensive = await getComprehensiveGpuInfo(rocmSmiPath);
      driverVersion = comprehensive.driverVersion;
      comprehensiveInfo = comprehensive.gpuInfo;
      
      // Also get real-time metrics
      const usageData = await getGpuUsage(rocmSmiPath);
      
      for (const gpu of gpus) {
        // Merge comprehensive info
        const extraInfo = comprehensiveInfo.get(gpu.index);
        if (extraInfo) {
          gpu.deviceId = extraInfo.deviceId;
          gpu.deviceRev = extraInfo.deviceRev;
          gpu.subsystemId = extraInfo.subsystemId;
          gpu.guid = extraInfo.guid;
          gpu.vbiosVersion = extraInfo.vbiosVersion;
          gpu.pciBus = extraInfo.pciBus;
          gpu.currentClockMHz = extraInfo.currentClockMHz;
        }
        
        // Set driver version on each GPU
        gpu.driverVersion = driverVersion;
        
        // Merge real-time metrics
        const metrics = usageData.get(gpu.index);
        if (metrics) {
          gpu.usage = metrics.usage;
          gpu.temperature = metrics.temperature;
          gpu.power = metrics.power;
          if (metrics.memoryTotal !== undefined) {
            gpu.memory = {
              total: metrics.memoryTotal,
              used: metrics.memoryUsed || 0,
            };
          }
        }
      }
    }

    return {
      detected: true,
      runtimeVersion,
      gpus,
      rocmInfoPath,
      rocmSmiPath,
    };
  } catch (error) {
    console.error("Failed to detect ROCm:", error);
    return {
      detected: false,
      runtimeVersion: "",
      gpus: [],
    };
  }
}

/**
 * Get real-time GPU metrics (for polling)
 */
export async function getROCmMetrics(): Promise<ROCmGPUInfo[]> {
  const rocmInfo = await detectROCm();
  return rocmInfo.gpus;
}
