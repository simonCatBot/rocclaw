import { describe, expect, it, vi, afterEach } from "vitest";
import { createElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { HeaderBar } from "@/features/agents/components/HeaderBar";

// Mock next/image to render plain img
vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => createElement("img", props),
}));

afterEach(() => {
  cleanup();
});

describe("HeaderBar", () => {
  it("renders a header element", () => {
    render(createElement(HeaderBar));
    expect(screen.getByRole("banner")).toBeInTheDocument();
  });

  it("contains the skip-to-main-content link", () => {
    render(createElement(HeaderBar));
    const skipLink = screen.getByText("Skip to main content");
    expect(skipLink).toBeInTheDocument();
    expect(skipLink.tagName).toBe("A");
    expect(skipLink).toHaveAttribute("href", "#main-content");
  });

  it("skip link has sr-only class by default", () => {
    render(createElement(HeaderBar));
    const skipLink = screen.getByText("Skip to main content");
    expect(skipLink.className).toContain("sr-only");
  });

  it("renders the logo image", () => {
    render(createElement(HeaderBar));
    const logo = screen.getByAltText("rocCLAW control");
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveAttribute("src", "/logo.png");
  });

  it("logo image has expected dimensions", () => {
    render(createElement(HeaderBar));
    const logo = screen.getByAltText("rocCLAW control");
    expect(logo).toHaveAttribute("width", "400");
    expect(logo).toHaveAttribute("height", "112");
  });
});
