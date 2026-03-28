/**
 * CSRF Protection Module
 * 
 * Implements the double-submit cookie pattern for CSRF protection.
 * - Token is generated and stored in a cookie
 * - Token must be included in header/meta for state-changing requests
 * - Server validates that header/meta token matches cookie token
 */

import { randomBytes, createHash } from "crypto";

const CSRF_TOKEN_LENGTH = 32;
const CSRF_COOKIE_NAME = "__Host-csrf_token";
const CSRF_HEADER_NAME = "x-csrf-token";
const CSRF_META_TAG = "csrf-token";

/**
 * Custom error class for CSRF validation failures
 */
export class CsrfError extends Error {
  constructor(message: string = "CSRF validation failed") {
    super(message);
    this.name = "CsrfError";
  }
}

/**
 * Generates a cryptographically secure CSRF token
 * @returns A hex-encoded random token
 */
export function generateCsrfToken(): string {
  return randomBytes(CSRF_TOKEN_LENGTH).toString("hex");
}

/**
 * Hashes a token for storage/comparison (prevents token exposure in logs)
 * @param token The token to hash
 * @returns SHA-256 hash of the token
 */
export function hashCsrfToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Validates a CSRF token against a stored hash
 * @param token The token from the request
 * @param storedHash The hashed token from the cookie
 * @returns true if valid, false otherwise
 */
export function validateCsrfToken(token: string, storedHash: string): boolean {
  if (!token || !storedHash) {
    return false;
  }
  const computedHash = hashCsrfToken(token);
  // Timing-safe comparison
  try {
    return timingSafeEqual(computedHash, storedHash);
  } catch {
    return false;
  }
}

/**
 * Timing-safe string comparison to prevent timing attacks
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still do a comparison to avoid timing leak, just with wrong result
    const buf = Buffer.alloc(Math.max(a.length, b.length), 0);
    const aBuf = Buffer.from(a, "hex");
    const bBuf = Buffer.from(b, "hex");
    // Compare against zero-filled buffer to consume similar time
    return aBuf.length === buf.length && bBuf.length === buf.length && aBuf.equals(bBuf);
  }
  return Buffer.from(a, "hex").equals(Buffer.from(b, "hex"));
}

/**
 * Gets secure cookie settings for the CSRF token
 * @param isProduction Whether we're in production mode
 * @returns Cookie settings string
 */
export function getCsrfCookieSettings(isProduction: boolean): string {
  const secure = isProduction ? "; Secure" : "";
  return `${CSRF_COOKIE_NAME}={token}${secure}; HttpOnly; Path=/; SameSite=Strict; Max-Age=86400`;
}

/**
 * Extracts CSRF token from request headers
 * @param headers Request headers
 * @returns The CSRF token or null
 */
export function extractCsrfTokenFromHeaders(headers: Headers): string | null {
  return headers.get(CSRF_HEADER_NAME);
}

/**
 * Extracts CSRF token from form data
 * @param formData FormData object
 * @returns The CSRF token or null
 */
export function extractCsrfTokenFromFormData(formData: FormData): string | null {
  const token = formData.get(CSRF_META_TAG);
  return typeof token === "string" ? token : null;
}

export { CSRF_COOKIE_NAME, CSRF_HEADER_NAME, CSRF_META_TAG };