// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import { describe, it, expect } from "vitest";

/**
 * Tests for the rocm.ts GPU info merge logic.
 *
 * Bug fix: when getGpuUsage() fails to read temperature (e.g., --showtemperature
 * is invalid on some rocm-smi versions), the metrics merge must NOT overwrite
 * a valid temperature from rocm-smi -a with undefined.
 *
 * The fix: only overwrite fields from metrics when they are actually defined.
 */

interface GpuInfo {
  usage?: number;
  temperature?: number;
  power?: number;
  memory?: { total: number; used: number };
}

interface MetricsData {
  usage?: number;
  temperature?: number;
  power?: number;
  memoryTotal?: number;
  memoryUsed?: number;
}

/**
 * Mirrors the merge logic from detectROCm() in rocm.ts.
 * Old (buggy): unconditionally overwrites with metrics values.
 * New (fixed): only overwrites when values are defined.
 */
function mergeGpuMetricsOld(gpu: GpuInfo, metrics: MetricsData): GpuInfo {
  // OLD BUGGY LOGIC: unconditional overwrite
  gpu.usage = metrics.usage;
  gpu.temperature = metrics.temperature;
  gpu.power = metrics.power;
  if (metrics.memoryTotal !== undefined) {
    gpu.memory = {
      total: metrics.memoryTotal || 0,
      used: metrics.memoryUsed || 0,
    };
  }
  return gpu;
}

function mergeGpuMetricsFixed(gpu: GpuInfo, metrics: MetricsData): GpuInfo {
  // FIXED LOGIC: only overwrite when defined
  if (metrics.usage !== undefined) gpu.usage = metrics.usage;
  if (metrics.temperature !== undefined) gpu.temperature = metrics.temperature;
  if (metrics.power !== undefined) gpu.power = metrics.power;
  if (metrics.memoryTotal !== undefined) {
    gpu.memory = {
      total: metrics.memoryTotal || 0,
      used: metrics.memoryUsed || 0,
    };
  }
  return gpu;
}

describe("rocm GPU metrics merge: temperature preservation", () => {
  it("OLD BUG: overwrites valid temperature with undefined from failed --showtemperature", () => {
    const gpu: GpuInfo = { usage: 3, temperature: 46, power: 31 };
    // --showtemperature failed: temperature is undefined
    const metrics: MetricsData = { usage: 3, temperature: undefined, power: 31 };
    const result = mergeGpuMetricsOld(gpu, metrics);
    expect(result.temperature).toBeUndefined();
    expect(result.usage).toBe(3);
  });

  it("FIXED: preserves valid temperature when metrics.temperature is undefined", () => {
    const gpu: GpuInfo = { usage: 3, temperature: 46, power: 31 };
    const metrics: MetricsData = { usage: 3, temperature: undefined, power: 31 };
    const result = mergeGpuMetricsFixed(gpu, metrics);
    expect(result.temperature).toBe(46);
    expect(result.usage).toBe(3);
  });

  it("FIXED: overwrites temperature when metrics provides a new value", () => {
    const gpu: GpuInfo = { usage: 3, temperature: 46, power: 31 };
    const metrics: MetricsData = { usage: 5, temperature: 48, power: 33 };
    const result = mergeGpuMetricsFixed(gpu, metrics);
    expect(result.temperature).toBe(48);
    expect(result.usage).toBe(5);
    expect(result.power).toBe(33);
  });

  it("OLD BUG: overwrites valid power with undefined", () => {
    const gpu: GpuInfo = { usage: 3, temperature: 46, power: 31 };
    const metrics: MetricsData = { usage: 3, power: undefined };
    const result = mergeGpuMetricsOld(gpu, metrics);
    expect(result.power).toBeUndefined();
  });

  it("FIXED: preserves valid power when metrics.power is undefined", () => {
    const gpu: GpuInfo = { usage: 3, temperature: 46, power: 31 };
    const metrics: MetricsData = { usage: 3, power: undefined };
    const result = mergeGpuMetricsFixed(gpu, metrics);
    expect(result.power).toBe(31);
  });

  it("FIXED: preserves valid usage when metrics.usage is undefined", () => {
    const gpu: GpuInfo = { usage: 3, temperature: 46, power: 31 };
    const metrics: MetricsData = { usage: undefined };
    const result = mergeGpuMetricsFixed(gpu, metrics);
    expect(result.usage).toBe(3);
  });

  it("FIXED: handles all fields undefined in metrics", () => {
    const gpu: GpuInfo = { usage: 3, temperature: 46, power: 31, memory: { total: 32, used: 8 } };
    const metrics: MetricsData = {};
    const result = mergeGpuMetricsFixed(gpu, metrics);
    expect(result.usage).toBe(3);
    expect(result.temperature).toBe(46);
    expect(result.power).toBe(31);
    expect(result.memory).toEqual({ total: 32, used: 8 });
  });

  it("FIXED: updates memory when metrics provides it", () => {
    const gpu: GpuInfo = { usage: 3, temperature: 46, power: 31 };
    const metrics: MetricsData = { memoryTotal: 32, memoryUsed: 10 };
    const result = mergeGpuMetricsFixed(gpu, metrics);
    expect(result.memory).toEqual({ total: 32, used: 10 });
  });

  it("FIXED: does not set memory when metrics.memoryTotal is undefined", () => {
    const gpu: GpuInfo = { usage: 3, temperature: 46, power: 31 };
    const metrics: MetricsData = { memoryTotal: undefined };
    const result = mergeGpuMetricsFixed(gpu, metrics);
    expect(result.memory).toBeUndefined();
  });

  it("real-world scenario: --showtemperature fails, usage and power succeed", () => {
    // This is the exact scenario from the bug:
    // - rocm-smi -a returns temperature=46
    // - --showtemperature fails (invalid flag)
    // - --showuse succeeds: usage=3
    // - --showpower succeeds: power=31
    const gpuFromComprehensive: GpuInfo = { temperature: 46, power: 31, usage: 0 };
    const metricsFromRealtime: MetricsData = { usage: 3, temperature: undefined, power: 31 };

    const buggy = mergeGpuMetricsOld({ ...gpuFromComprehensive }, metricsFromRealtime);
    expect(buggy.temperature).toBeUndefined(); // BUG: lost the valid 46!

    const fixed = mergeGpuMetricsFixed({ ...gpuFromComprehensive }, metricsFromRealtime);
    expect(fixed.temperature).toBe(46); // FIXED: preserved
    expect(fixed.usage).toBe(3);
    expect(fixed.power).toBe(31);
  });
});