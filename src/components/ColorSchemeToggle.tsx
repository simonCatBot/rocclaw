// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

"use client";

import { useEffect, useRef, useState } from "react";
import { Palette, Moon, Sun } from "lucide-react";

const SCHEME_KEY = "rocclaw-color-scheme";

type ColorSchemeId = "coral" | "nord" | "dracula" | "solarized" | "gruvbox";

interface ColorScheme {
  id: ColorSchemeId;
  label: string;
  primary: string;
  accent: string;
  bg: string;
}

const SCHEMES: ColorScheme[] = [
  { id: "coral", label: "Coral", primary: "#FF4D4D", accent: "#FF4D4D", bg: "#0a0a0a" },
  { id: "nord", label: "Nord", primary: "#81a1c1", accent: "#88c0d0", bg: "#2e3440" },
  { id: "dracula", label: "Dracula", primary: "#bd93f9", accent: "#ff79c6", bg: "#282a36" },
  { id: "solarized", label: "Solarized", primary: "#268bd2", accent: "#2aa198", bg: "#002b36" },
  { id: "gruvbox", label: "Gruvbox", primary: "#fb4934", accent: "#fabd2f", bg: "#282828" },
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
  window.dispatchEvent(new Event("rocclaw-theme-change"));
}

// Apply stored values before first paint — avoids flash of wrong theme
if (typeof document !== "undefined") {
  const storedScheme = localStorage.getItem(SCHEME_KEY) as ColorSchemeId | null;
  if (storedScheme && SCHEMES.find((s) => s.id === storedScheme)) {
    document.documentElement.dataset.colorScheme = storedScheme;
  } else {
    document.documentElement.dataset.colorScheme = "coral";
  }
  const storedTheme = localStorage.getItem(THEME_KEY) as ThemeMode | null;
  if (storedTheme === "light" || storedTheme === "dark") {
    document.documentElement.classList.toggle("dark", storedTheme === "dark");
  } else {
    document.documentElement.classList.toggle("dark", window.matchMedia("(prefers-color-scheme: dark)").matches);
  }
}

function getInitialScheme(): ColorSchemeId {
  if (typeof window === "undefined") return "coral";
  const el = document.documentElement;
  const stored = localStorage.getItem(SCHEME_KEY) as ColorSchemeId | null;
  if (stored && SCHEMES.find((s) => s.id === stored)) return stored;
  return (el.dataset.colorScheme as ColorSchemeId) ?? "coral";
}

function getInitialTheme(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function ColorSchemeToggle() {
  const [open, setOpen] = useState(false);
  const [activeScheme, setActiveScheme] = useState<ColorSchemeId>(getInitialScheme);
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Sync with external theme changes (e.g. from SettingsPanel)
  useEffect(() => {
    const sync = () => setTheme(getInitialTheme());
    window.addEventListener("rocclaw-theme-change", sync);
    return () => window.removeEventListener("rocclaw-theme-change", sync);
  }, []);

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
        className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface-2 text-muted-foreground hover:border-border/80 hover:text-foreground"
        aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
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
          className="flex h-8 items-center gap-2 rounded-md border border-border bg-surface-2 px-2 text-muted-foreground hover:border-border/80 hover:text-foreground"
          aria-label="Change color scheme"
          aria-expanded={open}
          aria-haspopup="true"
          title="Change color scheme"
        >
          <div
            className="h-3 w-3 rounded-full ring-1 ring-white/20"
            style={{ background: active.primary }}
          />
          <Palette className="h-3.5 w-3.5" />
        </button>

        {open ? (
          <div role="menu" aria-label="Color schemes" className="ui-card absolute bottom-full right-0 z-[300] mb-2 min-w-48 p-2">
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
                    role="menuitem"
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
