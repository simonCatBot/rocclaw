// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import { describe, it, expect } from "vitest";

/**
 * Tests for SystemGraphView data formatting and computation logic.
 *
 * These test the same formatting helpers and data transformations used
 * in SystemGraphView to ensure accuracy and consistency with SystemMetricsDashboard.
 */

// ─── Formatting helpers (mirrored from SystemGraphView) ──────────────

const formatGB = (gb: number) => `${gb.toFixed(1)} GB`;
const formatMHz = (mhz: number) => mhz >= 1000 ? `${(mhz / 1000).toFixed(2)} GHz` : `${mhz} MHz`;

// ─── Data transformation (mirrored from SystemGraphView fetchMetrics) ──

interface RawMetrics {
  cpu: { usage: number; temperature: number | null; currentSpeedMHz: number };
  memory: { usage: number; used: number; total: number };
  gpu: Array<{
    usage: number | null;
    temperature: number | null;
    power: number | null;
    currentClockMHz: number | null;
    memory: { total: number | null; used: number | null };
  }>;
}

interface FormattedSample {
  cpu: number;
  cpuTemp: number | null;
  cpuSpeedMHz: number;
  memory: number;
  memoryUsedGB: number;
  memoryTotalGB: number;
  gpu: number | null;
  gpuTemp: number | null;
  gpuVram: number | null;
  gpuVramUsedGB: number | null;
  gpuVramTotalGB: number | null;
  gpuPower: number | null;
  gpuClockMHz: number | null;
}

function formatMetricsSample(m: RawMetrics): FormattedSample {
  const primaryGpu = m.gpu?.[0];
  const gpuVramPercent =
    primaryGpu?.memory?.total && primaryGpu?.memory?.used
      ? Math.round((primaryGpu.memory.used / primaryGpu.memory.total) * 100)
      : null;

  return {
    cpu: Math.round(m.cpu?.usage ?? 0),
    cpuTemp: m.cpu?.temperature ?? null,
    cpuSpeedMHz: Math.round(m.cpu?.currentSpeedMHz ?? 0),
    memory: Math.round(m.memory?.usage ?? 0),
    memoryUsedGB: Math.round((m.memory?.used ?? 0) * 10) / 10,
    memoryTotalGB: Math.round((m.memory?.total ?? 0) * 10) / 10,
    gpu: primaryGpu?.usage != null ? Math.round(primaryGpu.usage) : null,
    gpuTemp: primaryGpu?.temperature != null ? Math.round(primaryGpu.temperature) : null,
    gpuVram: gpuVramPercent,
    gpuVramUsedGB: primaryGpu?.memory?.used != null ? Math.round(primaryGpu.memory.used * 10) / 10 : null,
    gpuVramTotalGB: primaryGpu?.memory?.total != null ? Math.round(primaryGpu.memory.total * 10) / 10 : null,
    gpuPower: primaryGpu?.power != null ? Math.round(primaryGpu.power * 10) / 10 : null,
    gpuClockMHz: primaryGpu?.currentClockMHz != null ? Math.round(primaryGpu.currentClockMHz) : null,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────

describe("formatGB: memory formatting", () => {
  it("formats whole GB values", () => {
    expect(formatGB(32)).toBe("32.0 GB");
  });

  it("formats fractional GB values", () => {
    expect(formatGB(8.81)).toBe("8.8 GB");
    expect(formatGB(94.07)).toBe("94.1 GB");
  });

  it("formats zero GB", () => {
    expect(formatGB(0)).toBe("0.0 GB");
  });

  it("formats large GB values", () => {
    expect(formatGB(128)).toBe("128.0 GB");
  });
});

describe("formatMHz: frequency formatting", () => {
  it("formats MHz values below 1000 as MHz", () => {
    expect(formatMHz(990)).toBe("990 MHz");
    expect(formatMHz(500)).toBe("500 MHz");
  });

  it("formats 1000 MHz as GHz", () => {
    expect(formatMHz(1000)).toBe("1.00 GHz");
  });

  it("formats high frequencies as GHz", () => {
    expect(formatMHz(2590)).toBe("2.59 GHz");
    expect(formatMHz(5000)).toBe("5.00 GHz");
  });

  it("formats 2900 MHz correctly", () => {
    expect(formatMHz(2900)).toBe("2.90 GHz");
  });
});

describe("formatMetricsSample: CPU values", () => {
  it("rounds CPU usage to integer", () => {
    const sample = formatMetricsSample({
      cpu: { usage: 7.3, temperature: 67, currentSpeedMHz: 2590 },
      memory: { usage: 35, used: 32.54, total: 94.07 },
      gpu: [],
    });
    expect(sample.cpu).toBe(7);
  });

  it("keeps CPU temperature as-is (server-side rounded)", () => {
    const sample = formatMetricsSample({
      cpu: { usage: 7, temperature: 67, currentSpeedMHz: 2590 },
      memory: { usage: 35, used: 32.54, total: 94.07 },
      gpu: [],
    });
    expect(sample.cpuTemp).toBe(67);
  });

  it("rounds GPU temperature to integer", () => {
    const sample = formatMetricsSample({
      cpu: { usage: 7, temperature: 59, currentSpeedMHz: 2590 },
      memory: { usage: 35, used: 32.54, total: 94.07 },
      gpu: [{ usage: 3, temperature: 43.7, power: 31, currentClockMHz: 995, memory: { total: 32, used: 8.81 } }],
    });
    expect(sample.gpuTemp).toBe(44);
  });

  it("rounds CPU speed to nearest MHz", () => {
    const sample = formatMetricsSample({
      cpu: { usage: 7, temperature: 59, currentSpeedMHz: 2590.4 },
      memory: { usage: 35, used: 32.54, total: 94.07 },
      gpu: [],
    });
    expect(sample.cpuSpeedMHz).toBe(2590);
  });
});

describe("formatMetricsSample: memory values", () => {
  it("rounds memory usage to integer percentage", () => {
    const sample = formatMetricsSample({
      cpu: { usage: 7, temperature: 59, currentSpeedMHz: 2590 },
      memory: { usage: 34.6, used: 32.54, total: 94.07 },
      gpu: [],
    });
    expect(sample.memory).toBe(35);
  });

  it("formats memory GB with one decimal place", () => {
    const sample = formatMetricsSample({
      cpu: { usage: 7, temperature: 59, currentSpeedMHz: 2590 },
      memory: { usage: 35, used: 32.54, total: 94.07 },
      gpu: [],
    });
    expect(sample.memoryUsedGB).toBe(32.5);
    expect(sample.memoryTotalGB).toBe(94.1);
    // Verify display format
    expect(formatGB(sample.memoryUsedGB)).toBe("32.5 GB");
    expect(formatGB(sample.memoryTotalGB)).toBe("94.1 GB");
  });
});

describe("formatMetricsSample: GPU values", () => {
  it("rounds GPU usage to integer", () => {
    const sample = formatMetricsSample({
      cpu: { usage: 7, temperature: 59, currentSpeedMHz: 2590 },
      memory: { usage: 35, used: 32.54, total: 94.07 },
      gpu: [{ usage: 2.8, temperature: 43, power: 31.002, currentClockMHz: 995, memory: { total: 32, used: 8.81 } }],
    });
    expect(sample.gpu).toBe(3);
  });

  it("computes GPU VRAM percentage", () => {
    const sample = formatMetricsSample({
      cpu: { usage: 7, temperature: 59, currentSpeedMHz: 2590 },
      memory: { usage: 35, used: 32.54, total: 94.07 },
      gpu: [{ usage: 3, temperature: 43, power: 31, currentClockMHz: 995, memory: { total: 32, used: 8.81 } }],
    });
    expect(sample.gpuVram).toBe(28); // 8.81/32 * 100 = 27.5 → 28
  });

  it("formats GPU VRAM GB with one decimal", () => {
    const sample = formatMetricsSample({
      cpu: { usage: 7, temperature: 59, currentSpeedMHz: 2590 },
      memory: { usage: 35, used: 32.54, total: 94.07 },
      gpu: [{ usage: 3, temperature: 43, power: 31, currentClockMHz: 995, memory: { total: 32, used: 8.81 } }],
    });
    expect(sample.gpuVramUsedGB).toBe(8.8);
    expect(sample.gpuVramTotalGB).toBe(32.0);
    expect(formatGB(sample.gpuVramUsedGB!)).toBe("8.8 GB");
    expect(formatGB(sample.gpuVramTotalGB!)).toBe("32.0 GB");
  });

  it("rounds GPU power to one decimal", () => {
    const sample = formatMetricsSample({
      cpu: { usage: 7, temperature: 59, currentSpeedMHz: 2590 },
      memory: { usage: 35, used: 32.54, total: 94.07 },
      gpu: [{ usage: 3, temperature: 43, power: 31.002, currentClockMHz: 995, memory: { total: 32, used: 8.81 } }],
    });
    expect(sample.gpuPower).toBe(31.0);
  });

  it("rounds GPU clock speed to nearest MHz", () => {
    const sample = formatMetricsSample({
      cpu: { usage: 7, temperature: 59, currentSpeedMHz: 2590 },
      memory: { usage: 35, used: 32.54, total: 94.07 },
      gpu: [{ usage: 3, temperature: 43, power: 31, currentClockMHz: 995.7, memory: { total: 32, used: 8.81 } }],
    });
    expect(sample.gpuClockMHz).toBe(996);
  });

  it("handles null GPU values", () => {
    const sample = formatMetricsSample({
      cpu: { usage: 7, temperature: 59, currentSpeedMHz: 2590 },
      memory: { usage: 35, used: 32.54, total: 94.07 },
      gpu: [{ usage: null, temperature: null, power: null, currentClockMHz: null, memory: { total: null, used: null } }],
    });
    expect(sample.gpu).toBeNull();
    expect(sample.gpuTemp).toBeNull();
    expect(sample.gpuVram).toBeNull();
    expect(sample.gpuVramUsedGB).toBeNull();
    expect(sample.gpuVramTotalGB).toBeNull();
    expect(sample.gpuPower).toBeNull();
    expect(sample.gpuClockMHz).toBeNull();
  });

  it("handles empty GPU array", () => {
    const sample = formatMetricsSample({
      cpu: { usage: 7, temperature: 59, currentSpeedMHz: 2590 },
      memory: { usage: 35, used: 32.54, total: 94.07 },
      gpu: [],
    });
    expect(sample.gpu).toBeNull();
    expect(sample.gpuTemp).toBeNull();
    expect(sample.gpuVram).toBeNull();
  });
});

describe("formatMetricsSample: GPU subtitle display", () => {
  it("formats GPU subtitle with frequency and wattage", () => {
    const sample = formatMetricsSample({
      cpu: { usage: 7, temperature: 59, currentSpeedMHz: 2590 },
      memory: { usage: 35, used: 32.54, total: 94.07 },
      gpu: [{ usage: 3, temperature: 43, power: 31.0, currentClockMHz: 995, memory: { total: 32, used: 8.81 } }],
    });
    const subtitle = [
      sample.gpuClockMHz !== null ? formatMHz(sample.gpuClockMHz) : null,
      sample.gpuPower !== null ? `${sample.gpuPower}W` : null,
    ].filter(Boolean).join(" • ");
    expect(subtitle).toBe("995 MHz • 31W");
  });

  it("formats GPU subtitle with GHz frequency", () => {
    const sample = formatMetricsSample({
      cpu: { usage: 7, temperature: 59, currentSpeedMHz: 2590 },
      memory: { usage: 35, used: 32.54, total: 94.07 },
      gpu: [{ usage: 80, temperature: 70, power: 250, currentClockMHz: 2500, memory: { total: 24, used: 20 } }],
    });
    const subtitle = [
      sample.gpuClockMHz !== null ? formatMHz(sample.gpuClockMHz) : null,
      sample.gpuPower !== null ? `${sample.gpuPower}W` : null,
    ].filter(Boolean).join(" • ");
    expect(subtitle).toBe("2.50 GHz • 250W");
  });
});