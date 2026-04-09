// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

/**
 * GPU Detection and Metrics Module (Fallback)
 * Detects GPU information using system tools when ROCm is not available
 * Works without root/sudo by reading from sysfs, lspci, and other standard Linux interfaces
 */

import { exec } from "child_process";
import { promisify } from "util";
import { readFile } from "fs/promises";
import { join } from "path";

const execAsync = promisify(exec);

/**
 * Basic GPU info interface (fallback mode)
 * Contains fields that can be populated without ROCm
 */
export interface BasicGPUInfo {
  index: number;
  name: string;
  pciId: string;
  vendor: string;
  driver: string | null;
  vramBytes: number | null;
  vramUsedBytes: number | null;
  currentClockMHz: number | null;
  maxClockMHz: number | null;
  currentTemp: number | null;
  gpuUtilPercent: number | null;
  memoryUtilPercent: number | null;
  powerWatts: number | null;
  currentMemoryClockMHz: number | null;
  maxMemoryClockMHz: number | null;
  drmDevicePath: string | null;
  isActive: boolean;
}

/**
 * Extended GPU info from DRM sysfs
 */
interface DrmSysfsInfo {
  vramTotal: number | null;
  vramUsed: number | null;
  gttTotal: number | null;
  gttUsed: number | null;
  gpuBusy: number | null;
  vcnBusy: number | null;
  currentLinkWidth: number | null;
  currentLinkSpeed: string | null;
  maxLinkSpeed: string | null;
  maxLinkWidth: number | null;
}

/**
 * Read a sysfs file safely, returning null on error
 */
async function readSysfsFile(path: string): Promise<string | null> {
  try {
    return (await readFile(path, "utf-8")).trim();
  } catch {
    return null;
  }
}

/**
 * Execute a command and return stdout, or null on error
 */
async function execCmd(cmd: string): Promise<string | null> {
  try {
    const { stdout } = await execAsync(cmd);
    return stdout.trim();
  } catch {
    return null;
  }
}

/**
 * Read extended DRM info from sysfs for a specific GPU device
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function findDrmDevices(): Promise<string[]> {
  try {
    const { stdout } = await execAsync("ls /sys/class/drm/ 2>/dev/null");
    return stdout
      .split("\n")
      .filter((line) => line.startsWith("card") && !line.includes("-"))
      .map((line) => `/sys/class/drm/${line}/device`);
  } catch {
    return [];
  }
}

/**
 * Read extended DRM info from sysfs for a specific GPU device
 */
async function getDrmSysfsInfo(drmPath: string): Promise<DrmSysfsInfo> {
  const basePath = drmPath;

  const [
    vramTotalStr,
    vramUsedStr,
    gttTotalStr,
    gttUsedStr,
    gpuBusyStr,
    vcnBusyStr,
    linkWidthStr,
    linkSpeedStr,
    maxLinkSpeedStr,
    maxLinkWidthStr,
  ] = await Promise.all([
    readSysfsFile(join(basePath, "mem_info_vram_total")),
    readSysfsFile(join(basePath, "mem_info_vram_used")),
    readSysfsFile(join(basePath, "mem_info_gtt_total")),
    readSysfsFile(join(basePath, "mem_info_gtt_used")),
    readSysfsFile(join(basePath, "gpu_busy_percent")),
    readSysfsFile(join(basePath, "vcn_busy_percent")),
    readSysfsFile(join(basePath, "current_link_width")),
    readSysfsFile(join(basePath, "current_link_speed")),
    readSysfsFile(join(basePath, "max_link_speed")),
    readSysfsFile(join(basePath, "max_link_width")),
  ]);

  return {
    vramTotal: vramTotalStr ? parseInt(vramTotalStr, 10) : null,
    vramUsed: vramUsedStr ? parseInt(vramUsedStr, 10) : null,
    gttTotal: gttTotalStr ? parseInt(gttTotalStr, 10) : null,
    gttUsed: gttUsedStr ? parseInt(gttUsedStr, 10) : null,
    gpuBusy: gpuBusyStr ? parseInt(gpuBusyStr, 10) : null,
    vcnBusy: vcnBusyStr ? parseInt(vcnBusyStr, 10) : null,
    currentLinkWidth: linkWidthStr ? parseInt(linkWidthStr, 10) : null,
    currentLinkSpeed: linkSpeedStr,
    maxLinkSpeed: maxLinkSpeedStr,
    maxLinkWidth: maxLinkWidthStr ? parseInt(maxLinkWidthStr, 10) : null,
  };
}

/**
 * Read GPU clock states from sysfs
 */
async function getGpuClocks(drmPath: string): Promise<{
  currentSclkMHz: number | null;
  maxSclkMHz: number | null;
  currentMclkMHz: number | null;
  maxMclkMHz: number | null;
}> {
  const [sclkStr, mclkStr] = await Promise.all([
    readSysfsFile(join(drmPath, "pp_dpm_sclk")),
    readSysfsFile(join(drmPath, "pp_dpm_mclk")),
  ]);

  // Parse SCLK: "0: 600Mhz \n1: 802Mhz * \n2: 2900Mhz" - asterisk marks current max
  let currentSclkMHz: number | null = null;
  let maxSclkMHz: number | null = null;

  if (sclkStr) {
    const lines = sclkStr.split("\n").map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      const match = line.match(/^(\d+):\s*(\d+)Mhz\s*\*?\s*$/);
      if (match) {
        const freq = parseInt(match[2], 10);
        if (line.includes("*")) {
          maxSclkMHz = freq;
        }
        // First entry is usually the current active clock
        if (currentSclkMHz === null) {
          currentSclkMHz = freq;
        }
      }
    }
  }

  // Parse MCLK: same format
  let currentMclkMHz: number | null = null;
  let maxMclkMHz: number | null = null;

  if (mclkStr) {
    const lines = mclkStr.split("\n").map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      const match = line.match(/^(\d+):\s*(\d+)Mhz\s*\*?\s*$/);
      if (match) {
        const freq = parseInt(match[2], 10);
        if (line.includes("*")) {
          maxMclkMHz = freq;
        }
        if (currentMclkMHz === null) {
          currentMclkMHz = freq;
        }
      }
    }
  }

  return { currentSclkMHz, maxSclkMHz, currentMclkMHz, maxMclkMHz };
}

/**
 * Try to get GPU temperature (varies by GPU driver)
 */
async function getGpuTemperature(drmPath: string): Promise<number | null> {
  // Try thermal_zone via hwmon
  try {
    const { stdout } = await execAsync(
      `ls /sys/class/drm/${drmPath.split("/").pop()}/device/hwmon/ 2>/dev/null`
    );
    const hwmonDir = stdout.trim();
    if (hwmonDir) {
      const tempStr = await readSysfsFile(
        join(drmPath, "hwmon", hwmonDir, "temp1_input")
      );
      if (tempStr) {
        return parseInt(tempStr, 10) / 1000; // Convert millidegrees to C
      }
    }
  } catch {
    // Ignore
  }

  // Try reading from power_state or other amdgpu sysfs entries
  // Temperature is often not exposed in a standard way without ROCm
  return null;
}

/**
 * Get GPU name from VBIOS or lspci
 */
async function getGpuName(drmPath: string, pciId: string): Promise<string> {
  // Try VBIOS version string as proxy for marketing name
  const vbiosStr = await readSysfsFile(join(drmPath, "vbios_version"));
  if (vbiosStr && vbiosStr !== "unknown") {
    // VBIOS strings often contain marketing info like "113-STRIXEMU-001"
    // We can parse some common patterns
    const nameFromVbios = parseVbiosMarketingName(vbiosStr);
    if (nameFromVbios) return nameFromVbios;
  }

  // Try using inxi if available (more reliable naming)
  const inxiOut = await execCmd("inxi -G 2>/dev/null | grep 'Device-1'");
  if (inxiOut) {
    const match = inxiOut.match(/Device-1\s+(\w+)\s+(.+?)\s+(?:driver|12)/);
    if (match) return match[2].trim();
  }

  // Fallback: map PCI ID to known names
  return mapPciIdToName(pciId);
}

/**
 * Parse marketing name from VBIOS version string
 */
function parseVbiosMarketingName(vbios: string): string | null {
  // Common VBIOS patterns for integrated AMD GPUs
  // e.g., "113-STRIXEMU-001" -> Strix Point integrated GPU
  if (vbios.includes("STRIX")) {
    return "AMD Radeon Integrated Graphics (Strix Point)";
  }
  if (vbios.includes("REMBRANDT")) {
    return "AMD Radeon Integrated Graphics (Rembrandt)";
  }
  if (vbios.includes("PHOENIX")) {
    return "AMD Radeon Integrated Graphics (Phoenix)";
  }
  if (vbios.includes("DRAGON")) {
    return "AMD Radeon Integrated Graphics (Dragon Range)";
  }
  return null;
}

/**
 * Map PCI device ID to a human-readable name
 * This is a simplified mapping - full list would be very long
 */
function mapPciIdToName(pciId: string): string {
  const id = pciId.replace(/^0x/i, "").toLowerCase();
  const knownDevices: Record<string, string> = {
    // AMD Integrated GPUs (APUs)
    "150e": "AMD Radeon 890M Graphics",    // Strix Point (Ryzen AI 300)
    "1502": "AMD Radeon 8060S Graphics",    // Strix Point
    "150f": "AMD Radeon 8050S Graphics",    // Strix Point
    "1586": "AMD Radeon 8060S Graphics",    // Strix Point (alternate)
    "15b3": "AMD Radeon 780M Graphics",      // Strix Point (lower tier)
    "15c7": "AMD Radeon 760M Graphics",      // Strix Point (lower tier)
    "150b": "AMD Radeon 770M Graphics",      // Strix Halo
    "13c0": "AMD Radeon 680M Graphics",       // Rembrandt
    "15e7": "AMD Radeon 680M Graphics",      // Phoenix
    "73ef": "AMD Radeon 680M Graphics",      // Phoenix (Linux driver ID)
    "1622": "AMD Radeon 780M Graphics",      // Strix Halo
    "1433": "AMD Radeon 740M Graphics",      // Hawk Point
    "1505": "AMD Radeon 890M Graphics",      // Strix Point (Linux)
    // RDNA 3 discrete
    "744c": "AMD Radeon RX 7900 XTX",
    "7440": "AMD Radeon RX 7900 XT",
    "7450": "AMD Radeon RX 7900 GRE",
    "743f": "AMD Radeon RX 7800 XT",
    "747f": "AMD Radeon RX 7700 XT",
    "7480": "AMD Radeon RX 7700 XT",
    // RDNA 2 discrete
    "73bf": "AMD Radeon RX 6800 XT",
    "73af": "AMD Radeon RX 6800",
    "73a1": "AMD Radeon RX 6700 XT",
    "73e1": "AMD Radeon RX 6700 XT",
    "73da": "AMD Radeon RX 6600 XT",
    "73ff": "AMD Radeon RX 6600",
    // RDNA 1 discrete
    "731f": "AMD Radeon RX 5700 XT",
    "731e": "AMD Radeon RX 5700",
    "7310": "AMD Radeon RX 5600 XT",
    "7312": "AMD Radeon RX 5600",
    "7318": "AMD Radeon RX 5500 XT",
    // Vega
    "687f": "AMD Radeon RX Vega",
    "66a3": "AMD Radeon VII",
    "6872": "AMD Radeon RX Vega 56",
    // Intel (fallback)
    "8086": "Intel GPU",
    // NVIDIA (fallback - not common on Linux APUs)
    "10de": "NVIDIA GPU",
  };

  return knownDevices[id] ?? `AMD GPU (${pciId})`;
}

/**
 * Get vendor string from PCI ID
 */
function getVendorFromPciId(pciId: string): string {
  // Strip vendor prefix if present (e.g., "1002:150e" -> "150e")
  const normalized = pciId.replace(/^0x/i, "").toLowerCase();
  const id = normalized.includes(":") ? normalized.split(":")[1] : normalized;
  
  const intel = ["8086", "8087", "8088", "8089"];
  const nvidia = ["10de", "12ba", "134d", "1382", "1431"];
  const amd = [
    "1002", "150e", "1502", "150f", "1586", "15b3", "15c7", "15e7",
    "73ef", "73bf", "73af", "73a1", "73e1", "73da", "73ff", "7310",
    "731f", "731e", "7312", "7318", "687f", "66a3", "6872", "743f",
    "744c", "7440", "7450", "747f", "7480",
  ];

  if (intel.includes(id)) return "Intel";
  if (nvidia.includes(id)) return "NVIDIA";
  if (amd.includes(id)) return "AMD";
  return "Unknown";
}

/**
 * Detect GPUs using lspci (always available on Linux)
 */
async function detectGpusLspci(): Promise<
  Array<{ name: string; pciId: string; pciSlot: string; devicePath: string }>
> {
  try {
    const { stdout } = await execAsync(
      "lspci -nn -mm 2>/dev/null | grep -iE 'vga|display|3d|0300'"
    );
    const lines = stdout.split("\n").filter(Boolean);
    const gpus: Array<{ name: string; pciId: string; pciSlot: string; devicePath: string }> = [];

    for (const line of lines) {
      // Match full PCI slot address (e.g., "65:00.0")
      const slotMatch = line.match(/^([0-9a-f]{2}:[0-9a-f]{2}\.[0-9a-f])/i);
      if (!slotMatch) continue;

      const pciSlot = slotMatch[1];

      // Match vendor:device ID (e.g., "1002:150e" OR just "150e" when vendor is omitted)
      // First try vendor:device pattern
      const idMatch = line.match(/([0-9a-f]{4}:[0-9a-f]{4})/i);
      let pciId: string;
      if (idMatch) {
        pciId = idMatch[1].replace(/^0000:/i, "");
      } else {
        // Fall back to just device ID (e.g., "150e" from "Device [150e]")
        const deviceIdMatch = line.match(/Device\s*\[([0-9a-f]{4})\]/i);
        if (deviceIdMatch) {
          const deviceId = deviceIdMatch[1];
          // Try to find vendor from the same line, default to AMD
          const vendorMatch = line.match(/Vendor\s*\[([0-9a-f]{4})\]/i);
          const vendorId = vendorMatch?.[1] ?? "1002";
          pciId = `${vendorId}:${deviceId}`;
        } else {
          continue;
        }
      }

      const parts = line.split('"');
      const name = parts.length > 1 ? parts[1].trim() : "Unknown GPU";

      // Find corresponding DRM device path
      const devicePath = await findDrmDeviceForPciSlot(pciSlot);

      gpus.push({ name, pciId, pciSlot, devicePath });
    }

    return gpus;
  } catch {
    return [];
  }
}

/**
 * Find DRM device path for a given PCI slot address (e.g., "65:00.0")
 */
async function findDrmDeviceForPciSlot(pciSlot: string): Promise<string> {
  try {
    const { stdout } = await execAsync("ls /sys/class/drm/ 2>/dev/null");
    const cards = stdout.split("\n").filter((l) => l.startsWith("card") && !l.includes("-"));

    for (const card of cards) {
      const devicePath = `/sys/class/drm/${card}/device`;
      const ueventPath = await readSysfsFile(join(devicePath, "uevent"));

      // PCI_SLOT_NAME in uevent is like "0000:65:00.0"
      if (ueventPath?.includes(pciSlot)) {
        return devicePath;
      }
    }
  } catch {
    // Ignore
  }
  return "";
}

/**
 * Main GPU detection function - detects all GPUs without ROCm
 */
export async function detectBasicGPU(): Promise<BasicGPUInfo[]> {
  const lspciGpus = await detectGpusLspci();
  const gpus: BasicGPUInfo[] = [];

  for (let i = 0; i < lspciGpus.length; i++) {
    const { pciId, devicePath } = lspciGpus[i];

    // Only process display controllers (not audio, etc.)
    if (!pciId.startsWith("1002") && !pciId.startsWith("8086") && !pciId.startsWith("10de")) {
      continue;
    }

    const sysfsInfo = devicePath ? await getDrmSysfsInfo(devicePath) : null;
    const clocks = devicePath ? await getGpuClocks(devicePath) : null;
    const temperature = devicePath ? await getGpuTemperature(devicePath) : null;
    const resolvedName = await getGpuName(devicePath || "", pciId);
    const driver = await readSysfsFile(
      devicePath ? join(devicePath, "driver", "module", "name") : ""
    ).catch(() => null);

    gpus.push({
      index: i,
      name: resolvedName,
      pciId,
      vendor: getVendorFromPciId(pciId),
      driver,
      vramBytes: sysfsInfo?.vramTotal ?? null,
      vramUsedBytes: sysfsInfo?.vramUsed ?? null,
      currentClockMHz: clocks?.currentSclkMHz ?? null,
      maxClockMHz: clocks?.maxSclkMHz ?? null,
      currentTemp: temperature,
      gpuUtilPercent: sysfsInfo?.gpuBusy ?? null,
      memoryUtilPercent: null, // Not reliably available without ROCm
      powerWatts: null,        // Not available without ROCm
      currentMemoryClockMHz: clocks?.currentMclkMHz ?? null,
      maxMemoryClockMHz: clocks?.maxMclkMHz ?? null,
      drmDevicePath: devicePath || null,
      isActive: true,
    });
  }

  return gpus;
}

