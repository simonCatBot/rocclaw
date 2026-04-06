import { describe, it, expect, vi, beforeEach } from "vitest";
import { exec } from "node:child_process";
import { readFile } from "node:fs/promises";

vi.mock("node:child_process", async () => {
  const mod = await vi.importActual<typeof import("node:child_process")>("node:child_process");
  return {
    default: mod,
    exec: vi.fn(),
    ...mod,
  };
});

vi.mock("node:fs/promises", async () => {
  const mod = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  return {
    default: mod,
    readFile: vi.fn(),
    ...mod,
  };
});

const execMock = vi.mocked(exec);
const readFileMock = vi.mocked(readFile);

// Import the module after mocks are set up
import { detectBasicGPU, hasGPU } from "@/lib/system/gpu-fallback";

describe("gpu-fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock implementations for fs/promises
    readFileMock.mockImplementation((path: string) => {
      if (path.includes("vbios_version")) {
        return Promise.resolve("113-STRIXEMU-001");
      }
      if (path.includes("driver")) {
        return Promise.resolve("amdgpu");
      }
      if (path.includes("mem_info_vram_total")) {
        return Promise.resolve("8589934592");
      }
      if (path.includes("mem_info_vram_used")) {
        return Promise.resolve("1073741824");
      }
      if (path.includes("gpu_busy_percent")) {
        return Promise.resolve("5");
      }
      if (path.includes("pp_dpm_sclk")) {
        return Promise.resolve("0: 600Mhz \n1: 798Mhz * \n2: 2900Mhz");
      }
      if (path.includes("pp_dpm_mclk")) {
        return Promise.resolve("0: 400Mhz \n1: 800Mhz *");
      }
      if (path.includes("vendor")) {
        return Promise.resolve("0x1002");
      }
      return Promise.resolve("");
    });
  });

  it("should detect AMD GPU when lspci returns proper GPU line", async () => {
    // Mock exec for lspci and ls /sys/class/drm/
    execMock
      .mockResolvedValueOnce({
        stdout: `65:00.0 "Display controller [0380]" "Advanced Micro Devices, Inc. [AMD/ATI] [1002]" "Device [150e]"`,
      } as unknown as { stdout: string })
      .mockResolvedValueOnce({ stdout: "card1" } as unknown as { stdout: string });

    const gpus = await detectBasicGPU();
    expect(gpus.length).toBe(1);
    expect(gpus[0].pciId).toBe("1002:150e");
    expect(gpus[0].vendor).toBe("AMD");
  });

  it("should return true when hasGPU finds at least one GPU", async () => {
    execMock
      .mockResolvedValueOnce({
        stdout: `65:00.0 "Display controller" "AMD/ATI" "Device [150e]"`,
      } as unknown as { stdout: string })
      .mockResolvedValueOnce({ stdout: "card1" } as unknown as { stdout: string });

    const result = await hasGPU();
    expect(result).toBe(true);
  });
});
