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
  size?: number;
  isSelected?: boolean;
};

const DEFAULT_AVATAR_COUNT = 6;

export const buildDefaultAvatarUrl = (index: number): string => {
  const safeIndex = ((index % DEFAULT_AVATAR_COUNT) + DEFAULT_AVATAR_COUNT) % DEFAULT_AVATAR_COUNT;
  return `/avatars/profile-${safeIndex + 1}.jpg`;
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
  // Global footer/display mode — overrides per-agent avatarSource when not "auto"
  const footerMode = useAvatarMode();

  const src = useMemo(() => {
    // Footer mode takes precedence when explicitly set to default or custom
    if (footerMode === "default") {
      return buildDefaultAvatarUrl(defaultAvatarIndex);
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
        return buildDefaultAvatarUrl(defaultAvatarIndex);
      case "auto":
      default:
        return buildAvatarDataUrl(seed);
    }
  }, [footerMode, avatarSource, avatarUrl, seed, defaultAvatarIndex]);

  return (
    <div
      className={`flex items-center justify-center overflow-hidden rounded-lg border border-border/80 bg-card transition-transform duration-300 ${isSelected ? "agent-avatar-selected scale-[1.02]" : ""}`}
      style={{ width: size, height: size }}
    >
      <Image
        className="pointer-events-none h-full w-full select-none"
        src={src}
        alt={`Avatar for ${name}`}
        width={size}
        height={size}
        unoptimized
        draggable={false}
      />
    </div>
  );
};
