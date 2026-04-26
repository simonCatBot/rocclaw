// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

"use client";

import { useCallback, useRef } from "react";
import {
  Users,
  MessageSquare,
  Server,
  Coins,
  Settings,
  ListTodo,
  Link,
  TrendingUp,
  Puzzle,
  type LucideIcon
} from "lucide-react";

export type TabId = "agents" | "chat" | "system" | "graph" | "tasks" | "tokens" | "settings" | "connection" | "skills";

interface TabConfig {
  id: TabId;
  label: string;
  icon: LucideIcon;
  defaultActive: boolean;
}

const AVAILABLE_TABS: TabConfig[] = [
  { id: "agents", label: "Agents", icon: Users, defaultActive: true },
  { id: "chat", label: "Chat", icon: MessageSquare, defaultActive: false },
  { id: "connection", label: "Connection", icon: Link, defaultActive: false },
  { id: "skills", label: "Skills", icon: Puzzle, defaultActive: false },
  { id: "system", label: "System", icon: Server, defaultActive: true },
  { id: "graph", label: "System Graph", icon: TrendingUp, defaultActive: true },
  { id: "tasks", label: "Tasks", icon: ListTodo, defaultActive: false },
  { id: "tokens", label: "Tokens", icon: Coins, defaultActive: false },
  { id: "settings", label: "Settings", icon: Settings, defaultActive: false },
];

interface TabBarProps {
  activeTabs: TabId[];
  onTabToggle: (tabId: TabId) => void;
}

export function TabBar({ activeTabs, onTabToggle }: TabBarProps) {
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const focusTab = useCallback((index: number) => {
    const tab = AVAILABLE_TABS[index];
    if (tab) {
      tabRefs.current.get(tab.id)?.focus();
    }
  }, []);

  const handleKeyDown = useCallback((event: React.KeyboardEvent, currentIndex: number) => {
    let nextIndex: number | null = null;

    switch (event.key) {
      case "ArrowRight":
        nextIndex = (currentIndex + 1) % AVAILABLE_TABS.length;
        break;
      case "ArrowLeft":
        nextIndex = (currentIndex - 1 + AVAILABLE_TABS.length) % AVAILABLE_TABS.length;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = AVAILABLE_TABS.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    focusTab(nextIndex);
  }, [focusTab]);

  return (
    <nav aria-label="Dashboard navigation" className="border-b border-border bg-surface-1/50 px-3 py-2 sm:px-4 md:px-5">
      <div
        role="toolbar"
        aria-label="Dashboard panels"
        className="flex items-center gap-1 overflow-x-auto scrollbar-hide"
      >
        {AVAILABLE_TABS.map((tab, index) => {
          const Icon = tab.icon;
          const isActive = activeTabs.includes(tab.id);

          return (
            <button
              key={tab.id}
              ref={(node) => {
                if (node) {
                  tabRefs.current.set(tab.id, node);
                } else {
                  tabRefs.current.delete(tab.id);
                }
              }}
              aria-pressed={isActive}
              tabIndex={0}
              onClick={() => onTabToggle(tab.id)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className={`
                flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium
                transition-all duration-200 whitespace-nowrap
                ${isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-surface-2"
                }
              `}
              aria-label={isActive ? `Hide ${tab.label}` : `Show ${tab.label}`}
              title={isActive ? `Hide ${tab.label}` : `Show ${tab.label}`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export const VALID_TAB_IDS: ReadonlySet<string> = new Set(AVAILABLE_TABS.map(tab => tab.id));

export function getDefaultActiveTabs(): TabId[] {
  return AVAILABLE_TABS
    .filter(tab => tab.defaultActive)
    .map(tab => tab.id);
}
