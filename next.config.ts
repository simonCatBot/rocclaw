import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";

/**
 * Generate a random nonce for CSP
 */
const generateNonce = (): string => {
  return Buffer.from(crypto.randomUUID()).toString("base64");
};

/**
 * Build CSP header value with nonce
 */
const buildCspHeader = (nonce: string): string => {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "connect-src 'self'",
    "media-src 'self'",
    "object-src 'none'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ];
  return directives.join("; ");
};

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  serverExternalPackages: ["ws", "better-sqlite3", "systeminformation"],
  // Explicitly use webpack mode

  webpack: (config, { isServer }) => {
    // Suppress warnings about optional macOS temperature-sensor dependencies
    // that are attempted to be loaded on Linux/Windows builds. These packages
    // are optional peer dependencies of `systeminformation` and do not affect
    // metrics collection on non-macOS hosts.
    config.ignoreWarnings = [
      { module: /osx-temperature-sensor/ },
      { module: /macos-temperature-sensor/ },
    ];
    return config;
  },
  async headers() {
    const nonce = generateNonce();

    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: buildCspHeader(nonce),
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()",
          },
          ...(isProduction
            ? [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=63072000; includeSubDomains; preload",
                },
              ]
            : []),
        ],
      },
    ];
  },
};

export default nextConfig;
