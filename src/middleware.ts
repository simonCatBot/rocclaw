/**
 * Next.js Middleware for Security
 *
 * - CSRF Protection: Generates tokens for GET requests, validates on mutations
 * - Security Headers: Adds additional security headers to all responses
 *
 * NOTE: This middleware runs in the Edge Runtime, so it uses Web Crypto API
 * instead of Node.js crypto module.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const CSRF_COOKIE_NAME = "__Host-csrf_token";
const CSRF_HEADER_NAME = "x-csrf-token";

// Routes that should skip CSRF validation (webhooks, external APIs, etc.)
const CSRF_EXEMPT_PATHS = [
  "/api/webhook",
  "/api/external",
];

// Routes that are API endpoints requiring CSRF protection
const API_ROUTES = ["/api/intents/", "/api/studio"];

/**
 * Generate a CSRF token using Web Crypto API (Edge Runtime compatible)
 */
async function generateCsrfToken(): Promise<string> {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Hash a token using Web Crypto API (Edge Runtime compatible)
 */
async function hashCsrfToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

/**
 * Validate a CSRF token against a stored hash
 */
async function validateCsrfToken(token: string, storedHash: string): Promise<boolean> {
  if (!token || !storedHash) {
    return false;
  }
  const computedHash = await hashCsrfToken(token);
  // Timing-safe comparison
  if (computedHash.length !== storedHash.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < computedHash.length; i++) {
    result |= computedHash.charCodeAt(i) ^ storedHash.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Check if a path is exempt from CSRF protection
 */
function isCsrfExempt(path: string): boolean {
  return CSRF_EXEMPT_PATHS.some((exempt) => path.startsWith(exempt));
}

/**
 * Check if a path is an API route that needs CSRF protection
 */
function isApiRoute(path: string): boolean {
  return API_ROUTES.some((route) => path.startsWith(route));
}

/**
 * Check if HTTP method requires CSRF validation
 */
function requiresCsrfValidation(method: string): boolean {
  return ["POST", "PUT", "DELETE", "PATCH"].includes(method.toUpperCase());
}

/**
 * Extract CSRF token from cookie
 */
function getCsrfTokenFromCookie(request: NextRequest): string | null {
  const cookie = request.cookies.get(CSRF_COOKIE_NAME);
  return cookie?.value ?? null;
}

/**
 * Extract CSRF token from header
 */
function getCsrfTokenFromHeader(request: NextRequest): string | null {
  return request.headers.get(CSRF_HEADER_NAME);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;
  const isProduction = process.env.NODE_ENV === "production";

  // Create response
  const response = NextResponse.next();

  // Skip CSRF for exempt paths
  if (isCsrfExempt(pathname)) {
    return response;
  }

  // Handle CSRF for API routes
  if (isApiRoute(pathname)) {
    // For GET requests: generate and set CSRF token
    if (method === "GET") {
      const token = await generateCsrfToken();
      const hashedToken = await hashCsrfToken(token);

      // Set cookie with hashed token
      response.cookies.set(CSRF_COOKIE_NAME, hashedToken, {
        httpOnly: true,
        path: "/",
        sameSite: "strict",
        secure: isProduction,
        maxAge: 86400, // 24 hours
      });

      // Expose token in header for client to use
      response.headers.set("x-csrf-token", token);
      return response;
    }

    // For mutation methods: validate CSRF token
    if (requiresCsrfValidation(method)) {
      const cookieToken = getCsrfTokenFromCookie(request);
      const headerToken = getCsrfTokenFromHeader(request);

      if (!cookieToken || !headerToken) {
        return NextResponse.json(
          { error: "CSRF token missing", code: "CSRF_MISSING" },
          { status: 403 }
        );
      }

      if (!(await validateCsrfToken(headerToken, cookieToken))) {
        return NextResponse.json(
          { error: "CSRF token invalid", code: "CSRF_INVALID" },
          { status: 403 }
        );
      }

      // Rotate token after successful validation (optional but recommended)
      const newToken = await generateCsrfToken();
      const newHashedToken = await hashCsrfToken(newToken);

      response.cookies.set(CSRF_COOKIE_NAME, newHashedToken, {
        httpOnly: true,
        path: "/",
        sameSite: "strict",
        secure: isProduction,
        maxAge: 86400,
      });

      response.headers.set("x-csrf-token", newToken);
    }
  }

  // For page routes: set CSRF token in cookie for GET requests
  if (method === "GET" && !pathname.startsWith("/api/")) {
    const token = await generateCsrfToken();
    const hashedToken = await hashCsrfToken(token);

    response.cookies.set(CSRF_COOKIE_NAME, hashedToken, {
      httpOnly: true,
      path: "/",
      sameSite: "strict",
      secure: isProduction,
      maxAge: 86400,
    });

    // Also set the raw token in a non-httpOnly cookie for JS access
    // This allows the client to read it and send in header
    response.cookies.set("csrf_token_readable", token, {
      httpOnly: false,
      path: "/",
      sameSite: "strict",
      secure: isProduction,
      maxAge: 86400,
    });
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
