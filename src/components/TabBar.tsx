// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

"use client";

import { 
  Users, 
  MessageSquare, 
  Server, 
  Coins,
  Settings,
  ListTodo,
  Link,
  type LucideIcon
} from "lucide-react";

export type TabId = "agents" | "chat" | "system" | "tasks" | "tokens" | "settings" | "connection";

interface TabConfig {
  id: TabId;
  label: string;
  icon: LucideIcon;
  defaultActive: boolean;
}

const AVAILABLE_TABS: TabConfig[] = [
  { id: "agents", label: "Agents", icon: Users, defaultActive: true },
  { id: "chat", label: "Chat", icon: MessageSquare, defaultActive: false },
  { id: "connection", label: "Connection", icon: Link, defaultActive: true },
  { id: "system", label: "System", icon: Server, defaultActive: true },
  { id: "tasks", label: "Tasks", icon: ListTodo, defaultActive: false },
  { id: "tokens", label: "Tokens", icon: Coins, defaultActive: false },
  { id: "settings", label: "Settings", icon: Settings, defaultActive: false },
];

interface TabBarProps {
  activeTabs: TabId[];
  onTabToggle: (tabId: TabId) => void;
}

export function TabBar({ activeTabs, onTabToggle }: TabBarProps) {
  return (
    <div className="border-b border-border bg-surface-1/50 px-3 py-2 sm:px-4 md:px-5">
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
        {AVAILABLE_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTabs.includes(tab.id);
          
          return (
            <button
              key={tab.id}
              onClick={() => onTabToggle(tab.id)}
              className={`
                flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium
                transition-all duration-200 whitespace-nowrap
                ${isActive 
                  ? "bg-primary text-primary-foreground shadow-sm" 
                  : "text-muted-foreground hover:text-foreground hover:bg-surface-2"
                }
              `}
              title={isActive ? `Hide ${tab.label}` : `Show ${tab.label}`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function getDefaultActiveTabs(): TabId[] {
  return AVAILABLE_TABS
    .filter(tab => tab.defaultActive)
    .map(tab => tab.id);
}


