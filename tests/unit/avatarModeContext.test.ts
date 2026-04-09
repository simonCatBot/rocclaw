// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

import {
  AvatarModeProvider,
  useAvatarMode,
  useSetAvatarMode,
} from "@/components/AvatarModeContext";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: () => {
      store = {};
    },
  };
})();
Object.defineProperty(window, "localStorage", { value: localStorageMock });

describe("AvatarModeContext", () => {
  afterEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  describe("useAvatarMode", () => {
    it("defaults to 'auto' when nothing is stored", () => {
      // @ts-expect-error -- localStorage getItem returns string|null
      localStorageMock.getItem.mockReturnValue(null);
      const { result } = renderHook(() => useAvatarMode(), {
        wrapper: AvatarModeProvider,
      });
      expect(result.current).toBe("auto");
    });

    it("returns stored 'default' mode", () => {
      localStorageMock.getItem.mockReturnValue("default");
      const { result } = renderHook(() => useAvatarMode(), {
        wrapper: AvatarModeProvider,
      });
      expect(result.current).toBe("default");
    });

    it("returns stored 'custom' mode", () => {
      localStorageMock.getItem.mockReturnValue("custom");
      const { result } = renderHook(() => useAvatarMode(), {
        wrapper: AvatarModeProvider,
      });
      expect(result.current).toBe("custom");
    });

    it("returns 'auto' for unknown stored values", () => {
      localStorageMock.getItem.mockReturnValue("unknown-mode");
      const { result } = renderHook(() => useAvatarMode(), {
        wrapper: AvatarModeProvider,
      });
      expect(result.current).toBe("auto");
    });
  });

  describe("useSetAvatarMode", () => {
    it("persists mode to localStorage", () => {
      const { result } = renderHook(() => useSetAvatarMode(), {
        wrapper: AvatarModeProvider,
      });
      result.current("default");
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        "rocclaw-footer-avatar-mode",
        "default"
      );
    });

    it("persists 'custom' to localStorage", () => {
      const { result } = renderHook(() => useSetAvatarMode(), {
        wrapper: AvatarModeProvider,
      });
      result.current("custom");
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        "rocclaw-footer-avatar-mode",
        "custom"
      );
    });
  });

  describe("AvatarModeProvider integration", () => {
    it("changing mode via useSetAvatarMode updates useAvatarMode", async () => {
      const { result } = renderHook(
        () => ({
          mode: useAvatarMode(),
          setMode: useSetAvatarMode(),
        }),
        { wrapper: AvatarModeProvider }
      );

      expect(result.current.mode).toBe("auto");
      result.current.setMode("default");

      await waitFor(() => {
        expect(result.current.mode).toBe("default");
      });
    });

    it("round-trips: auto → default → custom → auto", async () => {
      const { result } = renderHook(
        () => ({ mode: useAvatarMode(), setMode: useSetAvatarMode() }),
        { wrapper: AvatarModeProvider }
      );

      expect(result.current.mode).toBe("auto");

      result.current.setMode("default");
      await waitFor(() => expect(result.current.mode).toBe("default"));

      result.current.setMode("custom");
      await waitFor(() => expect(result.current.mode).toBe("custom"));

      result.current.setMode("auto");
      await waitFor(() => expect(result.current.mode).toBe("auto"));
    });
  });
});
