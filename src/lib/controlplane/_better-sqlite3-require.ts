// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

/**
 * CommonJS require shim for better-sqlite3.
 *
 * This file exists because:
 * 1. The `src/` directory uses ESM (import/export), but better-sqlite3 is a CJS-only package.
 * 2. `createRequire(import.meta.url)` bridges the two module systems inside webpack builds.
 * 3. Isolating this into a single file makes the CJS→ESM boundary explicit and easy to find.
 *
 * Note: This pattern is specific to Next.js/webpack. It will not work in bare ESM runtimes
 * without additional configuration (e.g., `package.json` `{"type": "module"}` would break it).
 * If the bundler or runtime target changes, revisit this shim.
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const BetterSqlite3 = require("better-sqlite3") as typeof import("better-sqlite3");

export default BetterSqlite3;
