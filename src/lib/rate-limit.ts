// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

/**
 * Simple in-process rate limiter for intent routes.
 *
 * Uses a sliding window per client IP. This is intentionally simple — it is not
 * a distributed rate limiter and will not synchronize across multiple server
 * instances behind a load balancer. For a single-instance setup (the common dev
 * and small-deployment case) this is sufficient.
 *
 * If you need distributed rate limiting, consider replacing this with a Redis-
 * backed implementation using a consistent keying scheme.
 */

type RateLimitKey = string;

/** Sliding window state for a given key. */
type SlidingWindow = Map<number, number>;

const DEFAULT_WINDOW_MS = 1_000; // 1 second
const DEFAULT_MAX_REQUESTS = 60; // 60 req/s per key (matches typical SSE keep-alive)

const globalState = new Map<RateLimitKey, SlidingWindow>();
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

const startCleanupIfNeeded = () => {
  if (cleanupTimer !== null) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, window] of globalState) {
      // Remove timestamps older than the window
      for (const [ts] of window) {
        if (ts < now - DEFAULT_WINDOW_MS * 2) {
          window.delete(ts);
        }
      }
      // Evict empty windows
      if (window.size === 0) {
        globalState.delete(key);
      }
    }
    // Stop cleaner if map is empty
    if (globalState.size === 0 && cleanupTimer !== null) {
      clearInterval(cleanupTimer);
      cleanupTimer = null;
    }
  }, DEFAULT_WINDOW_MS * 4);
};

/**
 * Returns `true` if the request is allowed, `false` if it should be rejected.
 *
 * @param key     - Identifier for the rate limit bucket (e.g. client IP).
 * @param limit   - Maximum number of events permitted per window.
 * @param windowMs - Window size in milliseconds (default: 1000).
 */
export const checkRateLimit = (
  key: RateLimitKey,
  limit: number = DEFAULT_MAX_REQUESTS,
  windowMs: number = DEFAULT_WINDOW_MS
): boolean => {
  const now = Date.now();
  const windowStart = now - windowMs;

  startCleanupIfNeeded();

  let window = globalState.get(key);
  if (!window) {
    window = new Map();
    globalState.set(key, window);
  }

  // Count requests within the current window
  let total = 0;
  for (const [ts, count] of window) {
    if (ts >= windowStart) {
      total += count;
    } else {
      window.delete(ts); // Already expired, clean up now
    }
  }

  if (total >= limit) {
    return false;
  }

  // Record this request at the current timestamp
  const bucket = Math.floor(now / 100) * 100; // 100ms bucketing to avoid Map bloat
  window.set(bucket, (window.get(bucket) ?? 0) + 1);

  return true;
};

/**
 * Returns the number of requests remaining in the current window for a key.
 * Useful for debugging and for setting `Retry-After` / `X-RateLimit-Remaining`
 * response headers in production.
 */
export const rateLimitRemaining = (
  key: RateLimitKey,
  limit: number = DEFAULT_MAX_REQUESTS,
  windowMs: number = DEFAULT_WINDOW_MS
): number => {
  const now = Date.now();
  const windowStart = now - windowMs;

  const window = globalState.get(key);
  if (!window) return limit;

  let total = 0;
  for (const [ts, count] of window) {
    if (ts >= windowStart) total += count;
  }

  return Math.max(0, limit - total);
};
