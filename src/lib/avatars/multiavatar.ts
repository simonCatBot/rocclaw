// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import multiavatar from "@multiavatar/multiavatar/esm";

const buildAvatarSvg = (seed: string): string => {
  const trimmed = seed.trim();
  if (!trimmed) {
    throw new Error("Avatar seed is required.");
  }
  return multiavatar(trimmed, true);
};

export const buildAvatarDataUrl = (seed: string): string => {
  const svg = buildAvatarSvg(seed);
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};
