import type { AvatarSource } from "@/features/agents/state/store";

export type AgentCreateModalSubmitPayload = {
  name: string;
  avatarSeed?: string;
  avatarSource?: AvatarSource;
  defaultAvatarIndex?: number;
  avatarUrl?: string;
};
