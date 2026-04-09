// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import { describe, it, expect } from "vitest";
import {
  checkRateLimit,
  rateLimitRemaining,
} from "@/lib/rate-limit";

// Each test uses a unique key to avoid cross-test state pollution
let keyCounter = 0;
const uniqueKey = (prefix = "test") => `${prefix}-${++keyCounter}-${Date.now()}`;

describe("rate-limit", () => {
  describe("checkRateLimit", () => {
    it("allows requests under the limit", () => {
      const key = uniqueKey();
      const limit = 5;
      const windowMs = 1_000;

      for (let i = 0; i < limit; i++) {
        expect(checkRateLimit(key, limit, windowMs)).toBe(true);
      }
    });

    it("blocks requests that exceed the limit", () => {
      const key = uniqueKey();
      const limit = 3;
      const windowMs = 1_000;

      checkRateLimit(key, limit, windowMs);
      checkRateLimit(key, limit, windowMs);
      checkRateLimit(key, limit, windowMs);

      expect(checkRateLimit(key, limit, windowMs)).toBe(false);
    });

    it("enforces separate limits per key", () => {
      const limit = 2;
      const windowMs = 1_000;
      const keyA = uniqueKey("client-a");
      const keyB = uniqueKey("client-b");

      checkRateLimit(keyA, limit, windowMs);
      checkRateLimit(keyA, limit, windowMs);
      expect(checkRateLimit(keyA, limit, windowMs)).toBe(false);

      expect(checkRateLimit(keyB, limit, windowMs)).toBe(true);
    });

    it("resets after the window expires", async () => {
      const key = uniqueKey();
      const limit = 2;
      const windowMs = 100;

      checkRateLimit(key, limit, windowMs);
      checkRateLimit(key, limit, windowMs);
      expect(checkRateLimit(key, limit, windowMs)).toBe(false);

      await new Promise((resolve) => setTimeout(resolve, windowMs + 50));

      expect(checkRateLimit(key, limit, windowMs)).toBe(true);
    });

    it("defaults to 60 req/s when called with no arguments", () => {
      const key = uniqueKey();
      for (let i = 0; i < 60; i++) {
        expect(checkRateLimit(key)).toBe(true);
      }
      expect(checkRateLimit(key)).toBe(false);
    });

    it("chat.send has its own higher limit", () => {
      const key = uniqueKey("chat");
      for (let i = 0; i < 30; i++) {
        expect(checkRateLimit(key, 30)).toBe(true);
      }
      expect(checkRateLimit(key, 30)).toBe(false);
    });
  });

  describe("rateLimitRemaining", () => {
    it("returns the full limit when no requests have been made", () => {
      expect(rateLimitRemaining(uniqueKey(), 10)).toBe(10);
    });

    it("decrements as requests are made", () => {
      const key = uniqueKey();
      const limit = 5;
      checkRateLimit(key, limit);
      expect(rateLimitRemaining(key, limit)).toBe(4);
      checkRateLimit(key, limit);
      expect(rateLimitRemaining(key, limit)).toBe(3);
    });

    it("returns 0 when the limit is exhausted", () => {
      const key = uniqueKey();
      const limit = 2;
      checkRateLimit(key, limit);
      checkRateLimit(key, limit);
      expect(rateLimitRemaining(key, limit)).toBe(0);
    });

    it("does not go negative if over-requests somehow occur", () => {
      const key = uniqueKey();
      const limit = 2;
      for (let i = 0; i < 10; i++) {
        checkRateLimit(key, limit);
      }
      expect(rateLimitRemaining(key, limit)).toBe(0);
    });
  });

});
