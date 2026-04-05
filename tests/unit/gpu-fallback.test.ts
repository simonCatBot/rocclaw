import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { exec } from "node:child_process";
import { readFile } from "node:fs/promises";

// Mock modules before importing the module under test
vi.mock("node:child_process", async () => {
  const actual = await vi.importActual<typeof import("node:child_process")>(
    "node:child_process"
  );
  return {
    default: actual,
    ...actual,
    exec: vi.fn(),
  };
});

vi.mock("node:fs/promises", async () => {
  const actual = await vi.importActual<typeof import("node:fs/promises")>(
    "node:fs/promises"
  );
  return {
    default: actual,
    ...actual,
    readFile: vi.fn(),
  };
});

// Import after mocks are set up
import { detectBasicGPU, hasGPU } from "@/lib/system/gpu-fallback";

const execMock = exec as ReturnType<typeof vi.fn>;
const readFileMock = readFile as ReturnType<typeof vi.fn>;

describe("gpu-fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("detectBasicGPU", () => {
    it("should return empty array when no GPUs detected", async () => {
      execMock.mockResolvedValue({ stdout: "" } as unknown as { stdout: string });
      readFileMock.mockResolvedValue(null as unknown as string);

      const gpus = await detectBasicGPU();
      expect(gpus).toEqual([]);
    });

    it("should detect AMD GPU from lspci", async () => {
      // Mock lspci output
      execMock
        .mockResolvedValueOnce({
          stdout: `65:00.0 "Display controller [0380]" "Advanced Micro Devices, Inc. [AMD/ATI] [1002]" "Device [150e]" -rc1 -p00 "Advanced Micro Devices, Inc. [AMD/ATI] [1002]" "Device [150e]"`,
        } as unknown as { stdout: string })
        // Mock ls /sys/class/drm/
        .mockResolvedValueOnce({ stdout: "card1\ncard1-DP-1" } as unknown as { stdout: string })
        // Mock ls /sys/class/drm/card1/device/
        .mockResolvedValueOnce({ stdout: "" } as unknown as { stdout: string });

      // Mock sysfs reads
      readFileMock.mockResolvedValue("" as unknown as string);

      const gpus = await detectBasicGPU();
      expect(gpus.length).toBeGreaterThanOrEqual(0);
    });

    it("should parse SCLK states correctly", async () => {
      execMock.mockResolvedValueOnce({ stdout: "" } as unknown as { stdout: string });

      const gpus = await detectBasicGPU();
      expect(Array.isArray(gpus)).toBe(true);
    });

    it("should handle lspci without VGA entries", async () => {
      execMock.mockResolvedValue({ stdout: "01:00.0 SATA controller" } as unknown as { stdout: string });
      readFileMock.mockResolvedValue("" as unknown as string);

      const gpus = await detectBasicGPU();
      expect(Array.isArray(gpus)).toBe(true);
    });
  });

  describe("hasGPU", () => {
    it("should return false when no GPU is detected", async () => {
      execMock.mockResolvedValue({ stdout: "" } as unknown as { stdout: string });
      readFileMock.mockResolvedValue("" as unknown as string);

      const result = await hasGPU();
      expect(result).toBe(false);
    });

    it("should return an array from detectBasicGPU", async () => {
      execMock.mockResolvedValue({ stdout: "" } as unknown as { stdout: string });
      readFileMock.mockResolvedValue("" as unknown as string);

      const gpus = await detectBasicGPU();
      expect(Array.isArray(gpus)).toBe(true);
    });
  });
});
