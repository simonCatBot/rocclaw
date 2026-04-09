#!/bin/bash
# rocCLAW startup script for Linux/macOS
# This script starts the rocCLAW server

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed or not in PATH"
    echo "Please install Node.js 20.9.0 or higher from https://nodejs.org/"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "Error: Node.js version 20.9.0 or higher is required"
    echo "Current version: $(node --version)"
    exit 1
fi

# Verify native runtime dependencies
echo "Verifying native runtime dependencies..."
node scripts/verify-native-runtime.mjs --check || {
    echo "Attempting to repair native runtime dependencies..."
    node scripts/verify-native-runtime.mjs --repair
}

# Start the server
echo "Starting rocCLAW server..."
exec node server/index.js "$@"
