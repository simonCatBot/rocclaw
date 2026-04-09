// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

"use client";

import { type ReactNode } from "react";
import { AvatarModeProvider } from "@/components/AvatarModeContext";

export function Providers({ children }: { children: ReactNode }) {
  return <AvatarModeProvider>{children}</AvatarModeProvider>;
}
