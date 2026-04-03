import Image from "next/image";
import { useMemo } from "react";

import { buildAvatarDataUrl } from "@/lib/avatars/multiavatar";
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
  const src = useMemo(() => {
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
  }, [avatarSource, avatarUrl, seed, defaultAvatarIndex]);

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
