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
  });

  it("should detect AMD GPU when lspci returns proper GPU line", async () => {
    execMock
      .mockResolvedValueOnce({ stdout: `65:00.0 "Display controller [0380]" "Advanced Micro Devices, Inc. [AMD/ATI] [1002]" "Device [150e]"` } as unknown as { stdout: string })
      .mockResolvedValueOnce({ stdout: "card1" } as unknown as { stdout: string });

    readFileMock.mockResolvedValue("" as unknown as string);

    const gpus = await detectBasicGPU();
    expect(gpus.length).toBe(1);
    expect(gpus[0].pciId).toBe("1002:150e");
    expect(gpus[0].vendor).toBe("AMD");
  });

  it("should return true when hasGPU finds at least one GPU", async () => {
    execMock
      .mockResolvedValueOnce({ stdout: `65:00.0 "Display controller" "AMD/ATI" "Device [150e]"` } as unknown as { stdout: string })
      .mockResolvedValueOnce({ stdout: "card1" } as unknown as { stdout: string });

    readFileMock.mockResolvedValue("" as unknown as string);

    const result = await hasGPU();
    expect(result).toBe(true);
  });
});
