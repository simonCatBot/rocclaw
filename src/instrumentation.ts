// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import { registerOTel } from "@vercel/otel";

export const register = () => {
  registerOTel({ serviceName: "openclaw-rocclaw" });
};
