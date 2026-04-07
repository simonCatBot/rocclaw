import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // TODO: Set to false and fix all type errors before a major release.
    // Left as true temporarily to unblock development while type coverage
    // catches up to the runtime behavior. Type errors will still fail CI
    // via `npm run typecheck` (tsc --noEmit).
    ignoreBuildErrors: true,
  },
  serverExternalPackages: ["ws", "better-sqlite3", "systeminformation"],
  // Turbopack configuration for Next.js 16+
  turbopack: {
    // Migrate webpack ignoreWarnings to Turbopack
    resolveAlias: {},
  },
  webpack: (config) => {
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
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
    ],
  },
};

export default nextConfig;
