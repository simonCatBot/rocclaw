// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import { executeRuntimeGatewayRead } from "@/lib/controlplane/runtime-read-route";

export const runtime = "nodejs";

export async function GET() {
  return await executeRuntimeGatewayRead("config.get", {});
}
