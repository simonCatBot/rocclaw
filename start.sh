#!/bin/bash
set -e

echo "Starting rocCLAW..."
echo "Make sure you have Node.js 20.9+ installed"

# Install dependencies (--include=dev required so TypeScript is available to
# transpile next.config.ts at startup; omitting dev deps causes a MODULE_NOT_FOUND
# error for 'typescript' in the Next.js config transpiler)
npm ci --include=dev

# Start the server
node server/index.js
