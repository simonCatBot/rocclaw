// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

"use client";

import { forwardRef, useCallback, useImperativeHandle, useState } from "react";
import { Shuffle, Check, ChevronRight } from "lucide-react";
import { AgentAvatar, buildDefaultAvatarUrl } from "./AgentAvatar";
import { randomUUID } from "@/lib/uuid";
import type { AvatarSource } from "@/features/agents/state/store";

export type { AvatarSource };

export interface AvatarSelectorHandle {
  getValue: () => AvatarSelectorValue;
}

export type AvatarSelectorValue = {
  avatarSource: AvatarSource;
  avatarSeed: string;
  defaultAvatarIndex: number;
  avatarUrl: string;
};

const DEFAULT_AVATAR_COUNT = 24;

const AVATAR_TABS = ["auto", "default", "custom"] as const;
type Tab = (typeof AVATAR_TABS)[number];

type AvatarSelectorProps = {
  name: string;
  value: AvatarSelectorValue;
  onChange: (value: AvatarSelectorValue) => void;
  disabled?: boolean;
};

export const AvatarSelector = forwardRef<AvatarSelectorHandle, AvatarSelectorProps>(
  ({ name, value, onChange, disabled = false }, ref) => {
    const [activeTab, setActiveTab] = useState<Tab>(
      AVATAR_TABS.includes(value.avatarSource as Tab) ? (value.avatarSource as Tab) : "auto"
    );

    useImperativeHandle(ref, () => ({
      getValue: () => value,
    }));

    const handleTabChange = useCallback(
      (tab: Tab) => {
        setActiveTab(tab);
        const updates: Partial<AvatarSelectorValue> = { avatarSource: tab as AvatarSource };
        if (tab === "auto") {
          updates.avatarSeed = value.avatarSeed || randomUUID();
        } else if (tab === "default") {
          // Use explicit index if set, otherwise derive from seed so something shows immediately
          updates.defaultAvatarIndex =
            value.defaultAvatarIndex !== UNSET_AVATAR_INDEX ? value.defaultAvatarIndex : 0;
        } else if (tab === "custom") {
          // Keep existing custom URL if any
        }
        onChange({ ...value, ...updates });
      },
      [value, onChange]
    );

    const handleShuffle = useCallback(() => {
      onChange({ ...value, avatarSeed: randomUUID() });
    }, [value, onChange]);

    const handleCycle = useCallback(() => {
      onChange({
        ...value,
        defaultAvatarIndex: (value.defaultAvatarIndex + 1) % DEFAULT_AVATAR_COUNT,
      });
    }, [value, onChange]);

    const handleDefaultSelect = useCallback(
      (index: number) => {
        onChange({ ...value, defaultAvatarIndex: index });
      },
      [value, onChange]
    );

    const handleCustomUrlChange = useCallback(
      (url: string) => {
        onChange({ ...value, avatarUrl: url });
      },
      [value, onChange]
    );

    const showAvatarPreview = activeTab !== "default" || true;

    return (
      <div className="flex flex-col gap-3">
        {/* Tab bar */}
        <div className="flex gap-1 rounded-lg border border-border bg-surface-2 p-0.5">
          {AVATAR_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              disabled={disabled}
              onClick={() => handleTabChange(tab)}
              className={`flex-1 rounded-md px-3 py-1.5 font-mono text-[10px] font-semibold tracking-wide transition-colors ${
                activeTab === tab
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-surface-1 hover:text-foreground disabled:cursor-not-allowed"
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Avatar preview */}
        <div className="flex items-center justify-center gap-3">
          {showAvatarPreview && (
            <AgentAvatar
              seed={value.avatarSeed}
              name={name}
              avatarUrl={activeTab === "custom" ? value.avatarUrl : null}
              avatarSource={activeTab === "custom" ? "custom" : activeTab === "default" ? "default" : "auto"}
              defaultAvatarIndex={value.defaultAvatarIndex}
              size={80}
              isSelected
            />
          )}

          {/* Auto controls */}
          {activeTab === "auto" && (
            <button
              type="button"
              aria-label="Shuffle avatar"
              className="ui-btn-secondary inline-flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground disabled:cursor-not-allowed"
              onClick={handleShuffle}
              disabled={disabled}
            >
              <Shuffle className="h-3.5 w-3.5" />
              Shuffle
            </button>
          )}

          {/* Default controls */}
          {activeTab === "default" && (
            <button
              type="button"
              aria-label="Cycle to next avatar"
              className="ui-btn-secondary inline-flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground disabled:cursor-not-allowed"
              onClick={handleCycle}
              disabled={disabled}
            >
              <ChevronRight className="h-3.5 w-3.5" />
              Cycle
            </button>
          )}

          {/* Custom URL input */}
          {activeTab === "custom" && (
            <input
              type="url"
              value={value.avatarUrl}
              onChange={(e) => handleCustomUrlChange(e.target.value)}
              placeholder="https://example.com/avatar.jpg"
              disabled={disabled}
              className="ui-input h-8 w-48 rounded-md px-2 text-xs text-foreground outline-none placeholder:text-muted-foreground/50"
            />
          )}
        </div>

        {/* Default avatar grid */}
        {activeTab === "default" && (
          <div className="grid grid-cols-6 gap-2">
            {Array.from({ length: DEFAULT_AVATAR_COUNT }, (_, i) => {
              const isSelected = value.defaultAvatarIndex === i;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={disabled}
                  onClick={() => handleDefaultSelect(i)}
                  className={`group relative overflow-hidden rounded-md border-2 transition-all ${
                    isSelected
                      ? "border-primary ring-2 ring-primary/30"
                      : "border-transparent hover:border-border"
                  }`}
                  title={`Avatar ${i + 1}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={buildDefaultAvatarUrl(i)}
                    alt={`Default avatar ${i + 1}`}
                    className="aspect-square w-full object-cover"
                  />
                  {isSelected && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <Check className="h-4 w-4 text-white" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }
);

AvatarSelector.displayName = "AvatarSelector";

const UNSET_AVATAR_INDEX = -1;

export const buildDefaultAvatarSelectorValue = (seed?: string): AvatarSelectorValue => ({
  avatarSource: "auto",
  avatarSeed: seed || randomUUID(),
  defaultAvatarIndex: UNSET_AVATAR_INDEX,
  avatarUrl: "",
});
