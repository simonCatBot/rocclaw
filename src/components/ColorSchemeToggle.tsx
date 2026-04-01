"use client";

import { useEffect, useRef, useState } from "react";
import { Palette, Moon, Sun } from "lucide-react";

const SCHEME_KEY = "rocclaw-color-scheme";

export type ColorSchemeId = "coral" | "nord" | "dracula" | "catppuccin" | "monokai";

interface ColorScheme {
  id: ColorSchemeId;
  label: string;
  primary: string;
  accent: string;
  bg: string;
}

const SCHEMES: ColorScheme[] = [
  { id: "coral", label: "Coral", primary: "#FF4D4D", accent: "#00e5cc", bg: "#0a0a0a" },
  { id: "nord", label: "Nord", primary: "#81a1c1", accent: "#88c0d0", bg: "#2e3440" },
  { id: "dracula", label: "Dracula", primary: "#bd93f9", accent: "#ff79c6", bg: "#282a36" },
  { id: "catppuccin", label: "Catppuccin", primary: "#cba6f7", accent: "#f5c2e7", bg: "#1e1e2e" },
  { id: "monokai", label: "Monokai", primary: "#e5c07b", accent: "#56b6c2", bg: "#272822" },
];

const THEME_KEY = "theme";

type ThemeMode = "light" | "dark";

function applyScheme(id: ColorSchemeId) {
  document.documentElement.dataset.colorScheme = id;
  localStorage.setItem(SCHEME_KEY, id);
}

function applyTheme(mode: ThemeMode) {
  document.documentElement.classList.toggle("dark", mode === "dark");
  localStorage.setItem(THEME_KEY, mode);
}

// Apply stored values before first paint
if (typeof document !== "undefined") {
  const storedScheme = localStorage.getItem(SCHEME_KEY) as ColorSchemeId | null;
  if (storedScheme && SCHEMES.find((s) => s.id === storedScheme)) {
    document.documentElement.dataset.colorScheme = storedScheme;
  } else {
    document.documentElement.dataset.colorScheme = "coral";
  }
  const storedTheme = localStorage.getItem(THEME_KEY) as ThemeMode | null;
  if (storedTheme === "light" || storedTheme === "dark") {
    applyTheme(storedTheme);
  } else {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(prefersDark ? "dark" : "light");
  }
}

export function ColorSchemeToggle() {
  const [open, setOpen] = useState(false);
  const [activeScheme, setActiveScheme] = useState<ColorSchemeId>("coral");
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const storedScheme = localStorage.getItem(SCHEME_KEY) as ColorSchemeId | null;
    if (storedScheme && SCHEMES.find((s) => s.id === storedScheme)) {
      setActiveScheme(storedScheme);
    }
    const storedTheme = localStorage.getItem(THEME_KEY) as ThemeMode | null;
    if (storedTheme === "light" || storedTheme === "dark") {
      setTheme(storedTheme);
    } else {
      setTheme(window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    }
  }, []);

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

  const handleSchemeSelect = (id: ColorSchemeId) => {
    setActiveScheme(id);
    applyScheme(id);
  };

  const handleThemeToggle = () => {
    const next: ThemeMode = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  };

  const active = SCHEMES.find((s) => s.id === activeScheme)!;

  return (
    <div className="flex items-center gap-2">
      {/* Day / Night toggle */}
      <button
        type="button"
        onClick={handleThemeToggle}
        className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-surface-2 text-muted-foreground hover:border-border/80 hover:text-foreground"
        title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      >
        {theme === "dark" ? (
          <Moon className="h-3.5 w-3.5" />
        ) : (
          <Sun className="h-3.5 w-3.5" />
        )}
      </button>

      {/* Color scheme picker */}
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex h-7 items-center gap-2 rounded-md border border-border bg-surface-2 px-2 text-muted-foreground hover:border-border/80 hover:text-foreground"
          title="Change color scheme"
        >
          <div
            className="h-3 w-3 rounded-full ring-1 ring-white/20"
            style={{ background: active.primary }}
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
                const isActive = scheme.id === activeScheme;
                return (
                  <button
                    key={scheme.id}
                    type="button"
                    onClick={() => { handleSchemeSelect(scheme.id); setOpen(false); }}
                    className={`flex items-center gap-3 rounded-lg px-2 py-2 text-left text-xs transition-colors ${
                      isActive
                        ? "bg-surface-selected/20 text-foreground"
                        : "text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                    }`}
                  >
                    {/* Two-tone swatch */}
                    <div
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                      style={{ background: scheme.bg }}
                    >
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ background: scheme.primary }}
                      />
                    </div>
                    <span className={isActive ? "font-semibold text-foreground" : ""}>
                      {scheme.label}
                    </span>
                    {isActive && (
                      <span
                        className="ml-auto h-1.5 w-1.5 rounded-full"
                        style={{ background: scheme.primary }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
