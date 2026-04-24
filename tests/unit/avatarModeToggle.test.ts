import { describe, expect, it, vi, afterEach } from "vitest";
import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AvatarModeToggle } from "@/components/AvatarModeToggle";

// Mock AvatarModeContext
vi.mock("@/components/AvatarModeContext", () => ({
  useAvatarMode: () => "auto",
  useSetAvatarMode: () => vi.fn(),
}));

afterEach(() => {
  cleanup();
});

describe("AvatarModeToggle", () => {
  it("renders the toggle button", () => {
    render(createElement(AvatarModeToggle));
    expect(screen.getByLabelText(/Avatar mode:/)).toBeInTheDocument();
  });

  it("has aria-expanded=false when closed", () => {
    render(createElement(AvatarModeToggle));
    const button = screen.getByLabelText(/Avatar mode:/);
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("has aria-haspopup=true", () => {
    render(createElement(AvatarModeToggle));
    const button = screen.getByLabelText(/Avatar mode:/);
    expect(button).toHaveAttribute("aria-haspopup", "true");
  });

  it("opens the dropdown on click", () => {
    render(createElement(AvatarModeToggle));
    fireEvent.click(screen.getByLabelText(/Avatar mode:/));
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("has aria-expanded=true when open", () => {
    render(createElement(AvatarModeToggle));
    const button = screen.getByLabelText(/Avatar mode:/);
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
  });

  it("renders 3 avatar mode options", () => {
    render(createElement(AvatarModeToggle));
    fireEvent.click(screen.getByLabelText(/Avatar mode:/));
    const items = screen.getAllByRole("menuitem");
    expect(items).toHaveLength(3);
  });

  it("shows mode labels", () => {
    render(createElement(AvatarModeToggle));
    fireEvent.click(screen.getByLabelText(/Avatar mode:/));
    expect(screen.getByText("Auto")).toBeInTheDocument();
    expect(screen.getByText("Default")).toBeInTheDocument();
    expect(screen.getByText("Custom")).toBeInTheDocument();
  });

  it("shows mode descriptions", () => {
    render(createElement(AvatarModeToggle));
    fireEvent.click(screen.getByLabelText(/Avatar mode:/));
    expect(screen.getByText("Procedural multiavatar")).toBeInTheDocument();
    expect(screen.getByText("Profile image library")).toBeInTheDocument();
    expect(screen.getByText("Custom image URL")).toBeInTheDocument();
  });

  it("closes the dropdown when a mode is selected", () => {
    render(createElement(AvatarModeToggle));
    fireEvent.click(screen.getByLabelText(/Avatar mode:/));
    fireEvent.click(screen.getByText("Default"));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("closes the dropdown on Escape key", () => {
    render(createElement(AvatarModeToggle));
    fireEvent.click(screen.getByLabelText(/Avatar mode:/));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("has aria-label on the menu container", () => {
    render(createElement(AvatarModeToggle));
    fireEvent.click(screen.getByLabelText(/Avatar mode:/));
    expect(screen.getByRole("menu")).toHaveAttribute("aria-label", "Avatar modes");
  });

  it("shows current mode in aria-label", () => {
    render(createElement(AvatarModeToggle));
    const button = screen.getByLabelText(/Avatar mode:/);
    expect(button.getAttribute("aria-label")).toContain("Auto");
  });
});
