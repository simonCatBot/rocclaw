// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import { useCallback, useEffect, useRef } from "react";

import {
  planBackToChatCommands,
  planFleetSelectCommands,
  planNonRouteSelectionSyncCommands,
  planOpenSettingsRouteCommands,
  planSettingsRouteSyncCommands,
  planSettingsTabChangeCommands,
  shouldConfirmDiscardPersonalityChanges,
  type InspectSidebarState,
  type SettingsRouteNavCommand,
  type SettingsRouteTab,
} from "@/features/agents/operations/settingsRouteWorkflow";

type UseSettingsRouteControllerParams = {
  settingsRouteActive: boolean;
  settingsRouteAgentId: string | null;
  status: "disconnected" | "connecting" | "connected";
  agentsLoadedOnce: boolean;
  selectedAgentId: string | null;
  focusedAgentId: string | null;
  focusedPreferencesLoaded: boolean;
  personalityHasUnsavedChanges: boolean;
  activeTab: SettingsRouteTab;
  inspectSidebar: InspectSidebarState;
  agents: Array<{ agentId: string }>;
  flushPendingDraft: (agentId: string | null) => void;
  dispatchSelectAgent: (agentId: string | null) => void;
  setInspectSidebar: (
    next: InspectSidebarState | ((current: InspectSidebarState) => InspectSidebarState)
  ) => void;
  setMobilePaneChat: () => void;
  setPersonalityHasUnsavedChanges: (next: boolean) => void;
  push: (href: string) => void;
  replace: (href: string) => void;
  confirmDiscard: () => boolean;
};

export type SettingsRouteController = {
  handleBackToChat: () => void;
  handleSettingsRouteTabChange: (nextTab: SettingsRouteTab) => void;
  handleOpenAgentSettingsRoute: (agentId: string) => void;
  handleFleetSelectAgent: (agentId: string) => void;
};

const executeSettingsRouteCommands = (
  commands: SettingsRouteNavCommand[],
  params: Pick<
    UseSettingsRouteControllerParams,
    | "dispatchSelectAgent"
    | "setInspectSidebar"
    | "setMobilePaneChat"
    | "setPersonalityHasUnsavedChanges"
    | "flushPendingDraft"
    | "push"
    | "replace"
  >
) => {
  for (const command of commands) {
    switch (command.kind) {
      case "select-agent":
        params.dispatchSelectAgent(command.agentId);
        break;
      case "set-inspect-sidebar":
        params.setInspectSidebar(command.value);
        break;
      case "set-mobile-pane-chat":
        params.setMobilePaneChat();
        break;
      case "set-personality-dirty":
        params.setPersonalityHasUnsavedChanges(command.value);
        break;
      case "flush-pending-draft":
        params.flushPendingDraft(command.agentId);
        break;
      case "push":
        params.push(command.href);
        break;
      case "replace":
        params.replace(command.href);
        break;
      default: {
        const _exhaustive: never = command;
        throw new Error(`Unsupported settings route command: ${_exhaustive}`);
      }
    }
  }
};

export function useSettingsRouteController(
  params: UseSettingsRouteControllerParams
): SettingsRouteController {
  const {
    settingsRouteActive,
    settingsRouteAgentId,
    status,
    agentsLoadedOnce,
    selectedAgentId,
    focusedAgentId,
    focusedPreferencesLoaded,
    personalityHasUnsavedChanges,
    activeTab,
    inspectSidebar,
    agents,
    flushPendingDraft,
    dispatchSelectAgent,
    setInspectSidebar,
    setMobilePaneChat,
    setPersonalityHasUnsavedChanges,
    push,
    replace,
    confirmDiscard,
  } = params;

  const applyCommands = useCallback(
    (commands: SettingsRouteNavCommand[]) => {
      executeSettingsRouteCommands(commands, {
        dispatchSelectAgent,
        setInspectSidebar,
        setMobilePaneChat,
        setPersonalityHasUnsavedChanges,
        flushPendingDraft,
        push,
        replace,
      });
    },
    [
      dispatchSelectAgent,
      flushPendingDraft,
      push,
      replace,
      setInspectSidebar,
      setMobilePaneChat,
      setPersonalityHasUnsavedChanges,
    ]
  );

  const handleBackToChat = useCallback(() => {
    const needsDiscardConfirmation = shouldConfirmDiscardPersonalityChanges({
      settingsRouteActive,
      activeTab,
      personalityHasUnsavedChanges,
    });
    const discardConfirmed = needsDiscardConfirmation ? confirmDiscard() : true;
    const commands = planBackToChatCommands({
      settingsRouteActive,
      activeTab,
      personalityHasUnsavedChanges,
      discardConfirmed,
    });
    applyCommands(commands);
  }, [activeTab, applyCommands, confirmDiscard, personalityHasUnsavedChanges, settingsRouteActive]);

  const handleSettingsRouteTabChange = useCallback(
    (nextTab: SettingsRouteTab) => {
      const currentTab = inspectSidebar?.tab ?? "personality";
      const needsDiscardConfirmation =
        currentTab === "personality" &&
        nextTab !== "personality" &&
        shouldConfirmDiscardPersonalityChanges({
          settingsRouteActive,
          activeTab: currentTab,
          personalityHasUnsavedChanges,
        });
      const discardConfirmed = needsDiscardConfirmation ? confirmDiscard() : true;

      const commands = planSettingsTabChangeCommands({
        nextTab,
        currentInspectSidebar: inspectSidebar,
        settingsRouteAgentId,
        settingsRouteActive,
        personalityHasUnsavedChanges,
        discardConfirmed,
      });
      applyCommands(commands);
    },
    [
      applyCommands,
      confirmDiscard,
      inspectSidebar,
      personalityHasUnsavedChanges,
      settingsRouteActive,
      settingsRouteAgentId,
    ]
  );

  const handleOpenAgentSettingsRoute = useCallback(
    (agentId: string) => {
      const commands = planOpenSettingsRouteCommands({
        agentId,
        currentInspectSidebar: inspectSidebar,
        focusedAgentId,
      });
      applyCommands(commands);
    },
    [applyCommands, focusedAgentId, inspectSidebar]
  );

  useEffect(() => {
    const routeAgentId = (settingsRouteAgentId ?? "").trim();
    const hasRouteAgent = routeAgentId
      ? agents.some((agent) => agent.agentId === routeAgentId)
      : false;

    const commands = planSettingsRouteSyncCommands({
      settingsRouteActive,
      settingsRouteAgentId,
      status,
      agentsLoadedOnce,
      selectedAgentId,
      hasRouteAgent,
      currentInspectSidebar: inspectSidebar,
    });

    applyCommands(commands);
  }, [
    applyCommands,
    agents,
    agentsLoadedOnce,
    inspectSidebar,
    selectedAgentId,
    settingsRouteActive,
    settingsRouteAgentId,
    status,
  ]);

  // Track user-initiated selection changes to avoid overwriting them.
  // isUserInitiatedRef.current starts false. On user click (FleetSidebar →
  // handleFleetSelectAgent → dispatchSelectAgent), we set it true BEFORE
  // dispatch, then the sync effect runs and resets it to false.
  // This lets the sync tell apart user clicks from fleet/envelope changes.
  const isUserInitiatedRef = useRef(false);

  // Track the previously synced focusedAgentId and whether the initial bypass
  // (for the null→default transition) has been done. This prevents the default
  // focusedAgentId (first agent) from overwriting the selection before the
  // focused preferences envelope has loaded.
  const prevFocusedAgentIdRef = useRef<string | null>(null);
  const initialBypassDoneRef = useRef(false);

  useEffect(() => {
    // Only run the sync when focused preferences are loaded AND agents exist.
    if (!focusedPreferencesLoaded || agents.length === 0) {
      return;
    }

    // Bypass the initial null→default focusedAgentId transition so it doesn't
    // overwrite the selection before focused preferences load.
    if (prevFocusedAgentIdRef.current === null && !initialBypassDoneRef.current) {
      prevFocusedAgentIdRef.current = focusedAgentId;
      initialBypassDoneRef.current = true;
      return;
    }

    // Skip if focusedAgentId hasn't actually changed.
    if (prevFocusedAgentIdRef.current === focusedAgentId) {
      return;
    }

    // If user just clicked, preserve their choice and skip the sync.
    // Reset the flag so future focusedAgentId changes can sync normally.
    if (isUserInitiatedRef.current) {
      isUserInitiatedRef.current = false;
      prevFocusedAgentIdRef.current = focusedAgentId;
      return;
    }

    // Skip if selectedAgentId already matches focusedAgentId — nothing to sync.
    // This handles the case where the envelope loaded and changed selectedAgentId
    // to match focusedAgentId — we shouldn't then sync again.
    if (selectedAgentId === focusedAgentId) {
      prevFocusedAgentIdRef.current = focusedAgentId;
      return;
    }

    prevFocusedAgentIdRef.current = focusedAgentId;

    const hasSelectedAgentInAgents = selectedAgentId
      ? agents.some((agent) => agent.agentId === selectedAgentId)
      : false;
    const hasInspectSidebarAgent = inspectSidebar?.agentId
      ? agents.some((agent) => agent.agentId === inspectSidebar?.agentId)
      : false;

    const commands = planNonRouteSelectionSyncCommands({
      settingsRouteActive,
      selectedAgentId,
      focusedAgentId,
      hasSelectedAgentInAgents,
      currentInspectSidebar: inspectSidebar,
      hasInspectSidebarAgent,
    });

    applyCommands(commands);
  }, [
    applyCommands,
    agents,
    focusedAgentId,
    focusedPreferencesLoaded,
    inspectSidebar,
    selectedAgentId,
    settingsRouteActive,
  ]);

  // Wrap handleFleetSelectAgent to track user-initiated selections so the sync
  // effect doesn't overwrite them with a stale focusedAgentId.
  const handleFleetSelectAgentWithTracking = useCallback(
    (agentId: string) => {
      isUserInitiatedRef.current = true;
      // Preserve the original fleet-select behavior.
      const commands = planFleetSelectCommands({
        agentId,
        currentInspectSidebar: inspectSidebar,
        focusedAgentId,
      });
      applyCommands(commands);
    },
    [applyCommands, focusedAgentId, inspectSidebar]
  );

  useEffect(() => {
    const hasSelectedAgentInAgents = selectedAgentId
      ? agents.some((agent) => agent.agentId === selectedAgentId)
      : false;
    const hasInspectSidebarAgent = inspectSidebar?.agentId
      ? agents.some((agent) => agent.agentId === inspectSidebar?.agentId)
      : false;

    const commands = planNonRouteSelectionSyncCommands({
      settingsRouteActive,
      selectedAgentId,
      focusedAgentId,
      hasSelectedAgentInAgents,
      currentInspectSidebar: inspectSidebar,
      hasInspectSidebarAgent,
    });

    applyCommands(commands);
  }, [
    applyCommands,
    agents,
    focusedAgentId,
    inspectSidebar,
    selectedAgentId,
    settingsRouteActive,
  ]);

  return {
    handleBackToChat,
    handleSettingsRouteTabChange,
    handleOpenAgentSettingsRoute,
    handleFleetSelectAgent: handleFleetSelectAgentWithTracking,
  };
}
