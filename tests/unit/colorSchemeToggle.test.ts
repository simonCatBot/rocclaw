import { describe, expect, it, vi, afterEach, beforeEach, beforeAll } from "vitest";
import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

// Must mock matchMedia before importing the component (top-level code uses it)
beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === "(prefers-color-scheme: dark)",
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

// Dynamic import after matchMedia is mocked
let ColorSchemeToggle: React.FC;

beforeAll(async () => {
  const mod = await import("@/components/ColorSchemeToggle");
  ColorSchemeToggle = mod.ColorSchemeToggle;
});

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  localStorage.clear();
  document.documentElement.dataset.colorScheme = "coral";
  document.documentElement.classList.add("dark");
});

describe("ColorSchemeToggle", () => {
  it("renders the theme toggle button", () => {
    render(createElement(ColorSchemeToggle));
    expect(screen.getByLabelText(/Switch to (light|dark) mode/)).toBeInTheDocument();
  });

  it("renders the color scheme picker button", () => {
    render(createElement(ColorSchemeToggle));
    expect(screen.getByLabelText("Change color scheme")).toBeInTheDocument();
  });

  it("has aria-expanded=false on scheme picker when closed", () => {
    render(createElement(ColorSchemeToggle));
    const picker = screen.getByLabelText("Change color scheme");
    expect(picker).toHaveAttribute("aria-expanded", "false");
  });

  it("has aria-haspopup=true on scheme picker", () => {
    render(createElement(ColorSchemeToggle));
    const picker = screen.getByLabelText("Change color scheme");
    expect(picker).toHaveAttribute("aria-haspopup", "true");
  });

  it("opens the dropdown when scheme picker is clicked", () => {
    render(createElement(ColorSchemeToggle));
    fireEvent.click(screen.getByLabelText("Change color scheme"));
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("has aria-expanded=true when dropdown is open", () => {
    render(createElement(ColorSchemeToggle));
    const picker = screen.getByLabelText("Change color scheme");
    fireEvent.click(picker);
    expect(picker).toHaveAttribute("aria-expanded", "true");
  });

  it("renders all 5 color scheme options in menu", () => {
    render(createElement(ColorSchemeToggle));
    fireEvent.click(screen.getByLabelText("Change color scheme"));
    const items = screen.getAllByRole("menuitem");
    expect(items).toHaveLength(5);
  });

  it("shows scheme labels in the menu", () => {
    render(createElement(ColorSchemeToggle));
    fireEvent.click(screen.getByLabelText("Change color scheme"));
    expect(screen.getByText("Coral")).toBeInTheDocument();
    expect(screen.getByText("Nord")).toBeInTheDocument();
    expect(screen.getByText("Dracula")).toBeInTheDocument();
    expect(screen.getByText("Solarized")).toBeInTheDocument();
    expect(screen.getByText("Gruvbox")).toBeInTheDocument();
  });

  it("closes the dropdown when a scheme is selected", () => {
    render(createElement(ColorSchemeToggle));
    fireEvent.click(screen.getByLabelText("Change color scheme"));
    fireEvent.click(screen.getByText("Nord"));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("closes the dropdown on Escape key", () => {
    render(createElement(ColorSchemeToggle));
    fireEvent.click(screen.getByLabelText("Change color scheme"));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("toggles theme mode when theme button is clicked", () => {
    render(createElement(ColorSchemeToggle));
    const themeButton = screen.getByLabelText(/Switch to (light|dark) mode/);
    const initialLabel = themeButton.getAttribute("aria-label");
    fireEvent.click(themeButton);
    expect(themeButton.getAttribute("aria-label")).not.toBe(initialLabel);
  });

  it("stores selected scheme in localStorage", () => {
    render(createElement(ColorSchemeToggle));
    fireEvent.click(screen.getByLabelText("Change color scheme"));
    fireEvent.click(screen.getByText("Dracula"));
    expect(localStorage.getItem("rocclaw-color-scheme")).toBe("dracula");
  });

  it("stores theme mode in localStorage", () => {
    render(createElement(ColorSchemeToggle));
    const themeButton = screen.getByLabelText(/Switch to (light|dark) mode/);
    fireEvent.click(themeButton);
    expect(localStorage.getItem("theme")).toBeTruthy();
  });

  it("has aria-label on the menu container", () => {
    render(createElement(ColorSchemeToggle));
    fireEvent.click(screen.getByLabelText("Change color scheme"));
    expect(screen.getByRole("menu")).toHaveAttribute("aria-label", "Color schemes");
  });
});
