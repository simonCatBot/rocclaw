import { describe, it, expect, beforeEach } from "vitest";
import {
  checkRateLimit,
  rateLimitRemaining,
  resetRateLimit,
} from "@/lib/rate-limit";

describe("rate-limit", () => {
  beforeEach(() => {
    // Reset all rate limit state before each test to ensure test isolation.
    // In production, only individual keys are reset via resetRateLimit(key).
    // This test file is the only consumer of the internal Map.
    resetRateLimit("test-client");
    resetRateLimit("other-client");
    resetRateLimit("chat-client");
  });

  describe("checkRateLimit", () => {
    it("allows requests under the limit", () => {
      const key = "test-client";
      const limit = 5;
      const windowMs = 1_000;

      for (let i = 0; i < limit; i++) {
        expect(checkRateLimit(key, limit, windowMs)).toBe(true);
      }
    });

    it("blocks requests that exceed the limit", () => {
      const key = "test-client";
      const limit = 3;
      const windowMs = 1_000;

      // Exhaust the limit
      checkRateLimit(key, limit, windowMs);
      checkRateLimit(key, limit, windowMs);
      checkRateLimit(key, limit, windowMs);

      // Next one should be blocked
      expect(checkRateLimit(key, limit, windowMs)).toBe(false);
    });

    it("enforces separate limits per key", () => {
      const limit = 2;
      const windowMs = 1_000;

      // Exhaust client A's limit
      checkRateLimit("client-a", limit, windowMs);
      checkRateLimit("client-a", limit, windowMs);
      expect(checkRateLimit("client-a", limit, windowMs)).toBe(false);

      // Client B should still be allowed
      expect(checkRateLimit("client-b", limit, windowMs)).toBe(true);
    });

    it("resets after the window expires", async () => {
      const key = "test-client";
      const limit = 2;
      const windowMs = 100; // Short window for testing

      checkRateLimit(key, limit, windowMs);
      checkRateLimit(key, limit, windowMs);
      expect(checkRateLimit(key, limit, windowMs)).toBe(false);

      // Wait for window to expire (add buffer for timing variations)
      await new Promise((resolve) => setTimeout(resolve, windowMs + 50));

      expect(checkRateLimit(key, limit, windowMs)).toBe(true);
    });

    it("defaults to 60 req/s when called with no arguments", () => {
      const key = "test-client";
      for (let i = 0; i < 60; i++) {
        expect(checkRateLimit(key)).toBe(true);
      }
      expect(checkRateLimit(key)).toBe(false);
    });

    it("chat.send has its own higher limit", () => {
      const key = "chat-client";
      // chat.send limit is 30 req/s
      for (let i = 0; i < 30; i++) {
        expect(checkRateLimit(key, 30)).toBe(true);
      }
      expect(checkRateLimit(key, 30)).toBe(false);
    });
  });

  describe("rateLimitRemaining", () => {
    it("returns the full limit when no requests have been made", () => {
      expect(rateLimitRemaining("test-client", 10)).toBe(10);
    });

    it("decrements as requests are made", () => {
      const key = "test-client";
      const limit = 5;
      checkRateLimit(key, limit);
      expect(rateLimitRemaining(key, limit)).toBe(4);
      checkRateLimit(key, limit);
      expect(rateLimitRemaining(key, limit)).toBe(3);
    });

    it("returns 0 when the limit is exhausted", () => {
      const key = "test-client";
      const limit = 2;
      checkRateLimit(key, limit);
      checkRateLimit(key, limit);
      expect(rateLimitRemaining(key, limit)).toBe(0);
    });

    it("does not go negative if over-requests somehow occur", () => {
      const key = "test-client";
      const limit = 2;
      // Even if called more times than limit, remaining should not go negative
      for (let i = 0; i < 10; i++) {
        checkRateLimit(key, limit);
      }
      expect(rateLimitRemaining(key, limit)).toBe(0);
    });
  });

  describe("resetRateLimit", () => {
    it("resets the count for a specific key", () => {
      const key = "test-client";
      const limit = 2;
      checkRateLimit(key, limit);
      checkRateLimit(key, limit);
      expect(checkRateLimit(key, limit)).toBe(false);

      resetRateLimit(key);

      // Should be allowed again
      expect(checkRateLimit(key, limit)).toBe(true);
    });

    it("does not affect other keys", () => {
      const limit = 2;
      checkRateLimit("client-a", limit);
      checkRateLimit("client-a", limit);
      resetRateLimit("client-a");

      // client-a should be fresh
      expect(checkRateLimit("client-a", limit)).toBe(true);

      // client-b should still be untouched
      expect(checkRateLimit("client-b", limit)).toBe(true);
    });
  });
});
