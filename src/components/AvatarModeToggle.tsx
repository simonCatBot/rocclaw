// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

"use client";

import { useEffect, useRef, useState } from "react";
import { ImageIcon, Shuffle, Smile } from "lucide-react";
import { useAvatarMode, useSetAvatarMode } from "@/components/AvatarModeContext";
import type { AvatarDisplayMode } from "@/components/AvatarModeContext";

export type { AvatarDisplayMode } from "@/components/AvatarModeContext";

const MODES: { id: AvatarDisplayMode; label: string; description: string }[] = [
  {
    id: "auto",
    label: "Auto",
    description: "Procedural multiavatar",
  },
  {
    id: "default",
    label: "Default",
    description: "Profile image library",
  },
  {
    id: "custom",
    label: "Custom",
    description: "Custom image URL",
  },
];

export function AvatarModeToggle() {
  const [open, setOpen] = useState(false);
  const activeMode = useAvatarMode();
  const setMode = useSetAvatarMode();
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const handleSelect = (id: AvatarDisplayMode) => {
    setMode(id);
    setOpen(false);
  };

  const active = MODES.find((m) => m.id === activeMode)!;

  const iconMap: Record<AvatarDisplayMode, React.ReactNode> = {
    auto: <Shuffle className="h-3.5 w-3.5" />,
    default: <Smile className="h-3.5 w-3.5" />,
    custom: <ImageIcon className="h-3.5 w-3.5" />,
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface-2 text-muted-foreground hover:border-border/80 hover:text-foreground"
        aria-label={`Avatar mode: ${active.label}`}
        aria-expanded={open}
        aria-haspopup="true"
        title={`Avatar mode: ${active.label}`}
      >
        {iconMap[activeMode]}
      </button>

      {open ? (
        <div role="menu" aria-label="Avatar modes" className="ui-card absolute bottom-full right-0 z-[300] mb-2 min-w-52 p-2">
          <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Avatar mode
          </p>
          <div className="flex flex-col gap-1">
            {MODES.map((mode) => {
              const isActive = mode.id === activeMode;
              return (
                <button
                  key={mode.id}
                  type="button"
                  role="menuitem"
                  onClick={() => handleSelect(mode.id)}
                  className={`flex items-center gap-3 rounded-lg px-2 py-2 text-left text-xs transition-colors ${
                    isActive
                      ? "bg-surface-selected/20 text-foreground"
                      : "text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                  }`}
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-md border border-border/60 bg-surface-1">
                    {iconMap[mode.id]}
                  </span>
                  <span className="flex flex-col">
                    <span className={isActive ? "font-semibold text-foreground" : ""}>
                      {mode.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{mode.description}</span>
                  </span>
                  {isActive && (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
