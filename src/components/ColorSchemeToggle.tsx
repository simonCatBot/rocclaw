"use client";

import { useEffect, useRef, useState } from "react";
import { Palette } from "lucide-react";

const SCHEME_KEY = "rocclaw-color-scheme";

export type ColorSchemeId = "coral" | "ocean" | "violet" | "amber";

interface ColorScheme {
  id: ColorSchemeId;
  label: string;
  primary: string;
  accent: string;
  bg: string;
  bgAccent: string;
}

const SCHEMES: ColorScheme[] = [
  {
    id: "coral",
    label: "Coral",
    primary: "#FF4D4D",
    accent: "#00e5cc",
    bg: "#0a0a0a",
    bgAccent: "#004d40",
  },
  {
    id: "ocean",
    label: "Ocean",
    primary: "#0ea5e9",
    accent: "#6ee7b7",
    bg: "#0a0a0a",
    bgAccent: "#022c22",
  },
  {
    id: "violet",
    label: "Violet",
    primary: "#a855f7",
    accent: "#f472b6",
    bg: "#0a0a0a",
    bgAccent: "#2e1065",
  },
  {
    id: "amber",
    label: "Amber",
    primary: "#f59e0b",
    accent: "#fb923c",
    bg: "#0a0a0a",
    bgAccent: "#292524",
  },
];

function applyScheme(id: ColorSchemeId) {
  document.documentElement.dataset.colorScheme = id;
  localStorage.setItem(SCHEME_KEY, id);
}

// Apply stored scheme before first paint to avoid flash
if (typeof document !== "undefined") {
  const stored = localStorage.getItem(SCHEME_KEY) as ColorSchemeId | null;
  if (stored && SCHEMES.find((s) => s.id === stored)) {
    document.documentElement.dataset.colorScheme = stored;
  }
}

export function ColorSchemeToggle() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<ColorSchemeId>("coral");
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Sync active state from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(SCHEME_KEY) as ColorSchemeId | null;
    if (stored && SCHEMES.find((s) => s.id === stored)) {
      setActive(stored);
      applyScheme(stored);
    }
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open]);

  const handleSelect = (id: ColorSchemeId) => {
    setActive(id);
    applyScheme(id);
    setOpen(false);
  };

  const activeScheme = SCHEMES.find((s) => s.id === active)!;

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-7 items-center gap-2 rounded-md border border-border bg-surface-2 px-2 text-muted-foreground hover:border-border/80 hover:text-foreground"
        title="Change color scheme"
      >
        <div
          className="h-3 w-3 rounded-full ring-1 ring-black/20"
          style={{ background: activeScheme.primary }}
        />
        <Palette className="h-3.5 w-3.5" />
      </button>

      {open ? (
        <div className="ui-card absolute bottom-full right-0 z-[300] mb-2 min-w-48 p-2">
          <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Color scheme
          </p>
          <div className="flex flex-col gap-1">
            {SCHEMES.map((scheme) => {
              const isActive = scheme.id === active;
              return (
                <button
                  key={scheme.id}
                  type="button"
                  onClick={() => handleSelect(scheme.id)}
                  className={`flex items-center gap-3 rounded-lg px-2 py-2 text-left text-xs transition-colors ${
                    isActive
                      ? "bg-surface-selected/20 text-foreground"
                      : "text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                  }`}
                >
                  {/* Swatch */}
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
                    <div
                      className="flex h-5 w-5 items-center justify-center rounded-full ring-1 ring-white/20"
                      style={{ background: scheme.primary }}
                    >
                      <div
                        className="h-2 w-2 rounded-full"
                        style={{ background: scheme.accent }}
                      />
                    </div>
                  </div>

                  {/* Label */}
                  <span className={isActive ? "font-semibold text-foreground" : ""}>
                    {scheme.label}
                  </span>

                  {/* Active checkmark */}
                  {isActive && (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full" style={{ background: scheme.primary }} />
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
