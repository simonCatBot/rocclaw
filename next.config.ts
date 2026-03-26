import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  serverExternalPackages: ["ws", "better-sqlite3", "systeminformation"],
  webpack: (config, { isServer }) => {
    // Suppress warnings about optional macOS dependencies
    config.ignoreWarnings = [
      { module: /osx-temperature-sensor/ },
      { module: /macos-temperature-sensor/ },
    ];
    return config;
  },
};

export default nextConfig;