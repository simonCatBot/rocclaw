// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import Image from "next/image";
import { useMemo } from "react";

import { buildAvatarDataUrl } from "@/lib/avatars/multiavatar";
import { useAvatarMode } from "@/components/AvatarModeContext";
import type { AvatarSource } from "@/features/agents/state/store";

type AgentAvatarProps = {
  seed: string;
  name: string;
  avatarUrl?: string | null;
  avatarSource?: AvatarSource;
  defaultAvatarIndex?: number;
  size?: number | "fill";
  isSelected?: boolean;
};

const DEFAULT_AVATAR_COUNT = 24;

/** Sentinel for "not explicitly set" — derive from seed hash. */
const UNSET_INDEX = -1;

/** Derive a per-agent avatar index from the seed string so different agents always get different images.
 *  Blends explicitIndex (if set) with seed hash so:
 *    - same explicitIndex still yields different images for different agents
 *    - explicitIndex is used as a base offset within the image set */
export const deriveDefaultIndex = (seed: string, explicitIndex: number): number => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) & 0xffffffff;
  }
  // Blend the seed hash with the explicit index so every agent gets a unique image
  // even if they share the same explicitIndex (or both have 0)
  const base = explicitIndex !== UNSET_INDEX ? explicitIndex : 0;
  return ((Math.abs(hash) + base) % DEFAULT_AVATAR_COUNT + DEFAULT_AVATAR_COUNT) % DEFAULT_AVATAR_COUNT;
};

export const buildDefaultAvatarUrl = (index: number): string => {
  const safeIndex = ((index % DEFAULT_AVATAR_COUNT) + DEFAULT_AVATAR_COUNT) % DEFAULT_AVATAR_COUNT;
  if (safeIndex < 12) {
    return `/avatars/profile-${safeIndex + 1}.png`;
  }
  return `/avatars/cat-profile-${String(safeIndex - 11).padStart(2, "0")}.png`;
};

export const AgentAvatar = ({
  seed,
  name,
  avatarUrl,
  avatarSource = "auto",
  defaultAvatarIndex = 0,
  size = 112,
  isSelected = false,
}: AgentAvatarProps) => {
  // Derive a stable per-agent index from seed, used when in "default" mode
  const derivedIndex = deriveDefaultIndex(seed, defaultAvatarIndex);

  // Global footer/display mode — overrides per-agent avatarSource when not "auto"
  const footerMode = useAvatarMode();

  const src = useMemo(() => {
    // Footer mode takes precedence when explicitly set to default or custom
    if (footerMode === "default") {
      return buildDefaultAvatarUrl(derivedIndex);
    }
    if (footerMode === "custom") {
      const trimmed = avatarUrl?.trim();
      if (trimmed) return trimmed;
      // custom URL not set — fall back to auto avatar
      return buildAvatarDataUrl(seed);
    }
    // footerMode === "auto" — use each agent's stored avatarSource
    switch (avatarSource) {
      case "custom": {
        const trimmed = avatarUrl?.trim();
        if (trimmed) return trimmed;
        return buildAvatarDataUrl(seed);
      }
      case "default":
        return buildDefaultAvatarUrl(derivedIndex);
      case "auto":
      default:
        return buildAvatarDataUrl(seed);
    }
  }, [footerMode, avatarSource, avatarUrl, seed, derivedIndex]);

  // Ensure src is never empty — Next.js <Image> warns on src=""
  const safeSrc = src || buildAvatarDataUrl(seed || "default");

  const isFill = size === "fill";

  return (
    <div
      className={`overflow-hidden rounded-lg border border-border/80 bg-card transition-transform duration-300 ${isSelected ? "agent-avatar-selected scale-[1.02]" : ""} ${isFill ? "relative h-full w-full" : "relative flex items-center justify-center"}`}
      style={isFill ? undefined : { width: size, height: size }}
    >
      <Image
        className="pointer-events-none h-full w-full select-none object-cover"
        src={safeSrc}
        alt={`Avatar for ${name}`}
        width={isFill ? undefined : size}
        height={isFill ? undefined : size}
        fill={isFill}
        unoptimized
        draggable={false}
      />
    </div>
  );
};
