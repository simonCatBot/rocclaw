// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ConnectionPage, type ConnectionPageProps } from "@/components/ConnectionPage";
import { defaultROCclawInstallContext } from "@/lib/rocclaw/install-context";

const buildProps = (overrides: Partial<ConnectionPageProps> = {}): ConnectionPageProps => ({
  savedGatewayUrl: "ws://127.0.0.1:18789",
  draftGatewayUrl: "ws://127.0.0.1:18789",
  token: "",
  localGatewayDefaults: null,
  localGatewayDefaultsHasToken: false,
  hasStoredToken: false,
  hasUnsavedChanges: false,
  installContext: defaultROCclawInstallContext(),
  status: "disconnected",
  statusReason: null,
  error: null,
  testResult: null,
  saving: false,
  testing: false,
  disconnecting: false,
  onGatewayUrlChange: vi.fn(),
  onTokenChange: vi.fn(),
  onUseLocalDefaults: vi.fn(),
  onSaveSettings: vi.fn(),
  onTestConnection: vi.fn(),
  onDisconnect: vi.fn(),
  onConnect: vi.fn(),
  onClearError: vi.fn(),
  ...overrides,
});

describe("ConnectionPage", () => {
  afterEach(() => {
    cleanup();
  });

  describe("environment detection banner", () => {
    it("shows 'no gateway detected' when probe is not healthy", () => {
      render(createElement(ConnectionPage, buildProps()));

      expect(screen.getByText("No local gateway detected")).toBeInTheDocument();
    });

    it("shows 'gateway detected' with Connect button when healthy", () => {
      const ctx = defaultROCclawInstallContext();
      ctx.localGateway.probeHealthy = true;
      ctx.localGateway.url = "ws://localhost:18789";

      render(createElement(ConnectionPage, buildProps({ installContext: ctx })));

      expect(screen.getByText("Local gateway detected")).toBeInTheDocument();
      // Banner has a Connect button
      const bannerConnect = screen.getAllByRole("button", { name: "Connect" });
      expect(bannerConnect.length).toBeGreaterThanOrEqual(1);
    });

    it("shows 'not responding' when CLI available but unhealthy", () => {
      const ctx = defaultROCclawInstallContext();
      ctx.localGateway.cliAvailable = true;
      ctx.localGateway.probeHealthy = false;

      render(createElement(ConnectionPage, buildProps({ installContext: ctx })));

      expect(screen.getByText("Gateway found but not responding")).toBeInTheDocument();
    });

    it("shows connected banner when status is connected", () => {
      render(createElement(ConnectionPage, buildProps({ status: "connected" })));

      expect(screen.getAllByText("Connected to OpenClaw").length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("error and test result display", () => {
    it("shows error display when error prop is set", () => {
      render(createElement(ConnectionPage, buildProps({ error: "Connection refused" })));

      expect(screen.getByText("Connection refused")).toBeInTheDocument();
    });

    it("shows success test result", () => {
      render(createElement(ConnectionPage, buildProps({
        testResult: { kind: "success", message: "Connection successful" },
      })));

      expect(screen.getByText("Connection successful")).toBeInTheDocument();
    });

    it("shows error test result", () => {
      render(createElement(ConnectionPage, buildProps({
        testResult: { kind: "error", message: "Timeout" },
      })));

      expect(screen.getByText("Timeout")).toBeInTheDocument();
    });
  });

  describe("token chips", () => {
    it("shows 'Stored' chip when hasStoredToken", () => {
      render(createElement(ConnectionPage, buildProps({ hasStoredToken: true })));

      expect(screen.getByText("Stored")).toBeInTheDocument();
    });

    it("shows 'Auto-detected' chip when localGatewayDefaultsHasToken", () => {
      render(createElement(ConnectionPage, buildProps({ localGatewayDefaultsHasToken: true })));

      expect(screen.getByText("Auto-detected")).toBeInTheDocument();
    });

    it("shows no chip when no token available", () => {
      render(createElement(ConnectionPage, buildProps()));

      expect(screen.queryByText("Stored")).not.toBeInTheDocument();
      expect(screen.queryByText("Auto-detected")).not.toBeInTheDocument();
    });
  });

  describe("primary button", () => {
    it("says 'Connect' when disconnected", () => {
      render(createElement(ConnectionPage, buildProps()));

      // The primary button in the form area
      const buttons = screen.getAllByRole("button", { name: "Connect" });
      expect(buttons.length).toBeGreaterThanOrEqual(1);
    });

    it("says 'Disconnect' when connected", () => {
      render(createElement(ConnectionPage, buildProps({ status: "connected" })));

      // Both the banner and the form have Disconnect
      const buttons = screen.getAllByRole("button", { name: "Disconnect" });
      expect(buttons.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("connection tabs", () => {
    it("shows Local tab content by default for local gateway URL", () => {
      render(createElement(ConnectionPage, buildProps()));

      expect(screen.getByText("Local Connection")).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /^Local$/ })).toHaveAttribute("aria-selected", "true");
    });

    it("switches to Client tab when clicked", () => {
      render(createElement(ConnectionPage, buildProps()));

      fireEvent.click(screen.getByRole("tab", { name: /^Client$/ }));

      expect(screen.getByText("Client Connection")).toBeInTheDocument();
    });

    it("shows all four tabs", () => {
      render(createElement(ConnectionPage, buildProps()));

      expect(screen.getByRole("tab", { name: /^Local$/ })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /^Client$/ })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /^Cloud$/ })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /^Remote$/ })).toBeInTheDocument();
    });
  });

  describe("unsaved changes", () => {
    it("shows unsaved changes indicator", () => {
      render(createElement(ConnectionPage, buildProps({ hasUnsavedChanges: true })));

      expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
    });
  });

  describe("Use Local Defaults button", () => {
    it("shows when localGatewayDefaults is set", () => {
      render(createElement(ConnectionPage, buildProps({
        localGatewayDefaults: { url: "ws://localhost:18789", token: "" },
      })));

      expect(screen.getByRole("button", { name: "Use Local Defaults" })).toBeInTheDocument();
    });

    it("is hidden when no localGatewayDefaults", () => {
      render(createElement(ConnectionPage, buildProps()));

      expect(screen.queryByRole("button", { name: "Use Local Defaults" })).not.toBeInTheDocument();
    });
  });
});
