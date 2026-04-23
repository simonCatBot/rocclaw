// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import type { ImgHTMLAttributes } from "react";

/**
 * Defensive markdown image renderer.
 * Returns null instead of <img src=""> to prevent the React warning:
 *   "An empty string was passed to the src attribute."
 */
export const MarkdownImage = ({
  src,
  alt,
  ...rest
}: ImgHTMLAttributes<HTMLImageElement>) => {
  if (!src) return null;
  return <img src={src} alt={alt ?? ""} {...rest} />;
};