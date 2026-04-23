// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import { describe, expect, it } from "vitest";

import { rewriteMediaLinesToMarkdown } from "@/lib/text/media-markdown";

describe("media-markdown", () => {
  it("rewrites MEDIA: lines pointing to images into markdown images", () => {
    const input = "Hello\nMEDIA: /home/ubuntu/.openclaw/workspace-agent/foo.png\nDone";
    const out = rewriteMediaLinesToMarkdown(input);

    expect(out).toContain("![](/api/runtime/media?path=");
    expect(out).toContain("MEDIA: /home/ubuntu/.openclaw/workspace-agent/foo.png");
    expect(out).toContain("Hello");
    expect(out).toContain("Done");
  });

  it("rewrites MEDIA: with the image path on the next line", () => {
    const input = "Hello\nMEDIA:\n/home/ubuntu/.openclaw/workspace-agent/foo.png\nDone";
    const out = rewriteMediaLinesToMarkdown(input);

    expect(out).toContain("![](/api/runtime/media?path=");
    expect(out).toContain("MEDIA: /home/ubuntu/.openclaw/workspace-agent/foo.png");
    expect(out).toContain("Hello");
    expect(out).toContain("Done");
  });

  it("does not rewrite inside fenced code blocks", () => {
    const input = "```\nMEDIA: /home/ubuntu/.openclaw/workspace-agent/foo.png\n```";
    const out = rewriteMediaLinesToMarkdown(input);
    expect(out).toBe(input);
  });

  it("strips markdown images with empty URLs to prevent <img src=>", () => {
    const input = "Hello ![alt]() world";
    const out = rewriteMediaLinesToMarkdown(input);
    expect(out).toBe("Hello alt world");
  });

  it("removes markdown images with empty alt and empty URLs", () => {
    const input = "Hello ![]() world";
    const out = rewriteMediaLinesToMarkdown(input);
    expect(out).toBe("Hello  world");
  });

  it("preserves markdown images with non-empty URLs", () => {
    const input = "Hello ![alt](https://example.com/img.png) world";
    const out = rewriteMediaLinesToMarkdown(input);
    expect(out).toBe("Hello ![alt](https://example.com/img.png) world");
  });
});
