// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AgentChatPanel } from "@/features/agents/components/AgentChatPanel";
import { AgentCreateModal } from "@/features/agents/components/AgentCreateModal";
import { FleetSidebar } from "@/features/agents/components/FleetSidebar";
import { HeaderBar } from "@/features/agents/components/HeaderBar";
import { FooterBar } from "@/components/FooterBar";
import { EmptyStatePanel } from "@/features/agents/components/EmptyStatePanel";
import { BootScreen } from "@/features/agents/components/BootScreen";
import { LoadingScreen } from "@/features/agents/components/LoadingScreen";
import { ConnectionSetupView } from "@/features/agents/components/ConnectionSetupView";
import { SettingsRoutePanel } from "@/features/agents/components/SettingsRoutePanel";
import { CreateAgentBlockModal, RestartingMutationBlockModal } from "@/features/agents/components/MutationBlockingModals";
import { SystemMetricsDashboard } from "@/components/SystemMetricsDashboard";
import { SystemGraphView } from "@/components/SystemGraphView";
import { TasksDashboard } from "@/components/TasksDashboard";
import { TokenUsageDashboard } from "@/components/TokenUsageDashboard";
import { SettingsPanel } from "@/components/SettingsPanel";
import { ConnectionPage } from "@/components/ConnectionPage";
import { SkillsDashboard } from "@/components/SkillsDashboard";
import { TabBar, type TabId, getDefaultActiveTabs, VALID_TAB_IDS } from "@/components/TabBar";
import {
  isHeartbeatPrompt,
} from "@/lib/text/message-extract";
import type { ControlPlaneOutboxEntry } from "@/lib/controlplane/contracts";
import {
  type GatewayModelChoice,
  type GatewayModelPolicySnapshot,
} from "@/lib/gateway/models";
import {
  AgentStoreProvider,
  agentStoreReducer,
  getFilteredAgents,
  getSelectedAgent,
  type FocusFilter,
  useAgentStore,
} from "@/features/agents/state/store";
import { createGatewayRuntimeEventHandler } from "@/features/agents/state/gatewayRuntimeEventHandler";
import {
  type CronJobSummary,
  formatCronJobDisplay,
  resolveLatestCronJobForAgent,
} from "@/lib/cron/types";
import {
  readConfigAgentList,
} from "@/lib/gateway/agentConfig";
import { randomUUID } from "@/lib/uuid";
import { useGatewayConnectionOrchestrator } from "@/features/agents/operations/useGatewayConnectionOrchestrator";
import { applySessionSettingMutation } from "@/features/agents/state/sessionSettingsMutations";
import type { AgentCreateModalSubmitPayload } from "@/features/agents/creation/types";
import {
  isGatewayDisconnectLikeError,
} from "@/lib/gateway/gateway-disconnect";
import type { EventFrame } from "@/lib/gateway/gateway-frames";
import {
  useConfigMutationQueue,
  type ConfigMutationKind,
} from "@/features/agents/operations/useConfigMutationQueue";
import { useGatewayConfigSyncController } from "@/features/agents/operations/useGatewayConfigSyncController";
import { isLocalGatewayUrl } from "@/lib/gateway/local-gateway";
import type { ExecApprovalDecision, PendingExecApproval } from "@/features/agents/approvals/types";
import {
  planAwaitingUserInputPatches,
  planPendingPruneDelay,
  planPrunedPendingState,
} from "@/features/agents/approvals/execApprovalControlLoopWorkflow";
import {
  runGatewayEventIngressOperation,
  runPauseRunForExecApprovalOperation,
  runResolveExecApprovalOperation,
} from "@/features/agents/approvals/execApprovalRunControlOperation";
import {
  mergePendingApprovalsForFocusedAgent,
} from "@/features/agents/approvals/pendingStore";
import { createSpecialLatestUpdateOperation } from "@/features/agents/operations/specialLatestUpdateOperation";
import { buildLatestUpdateTriggerMarker } from "@/features/agents/operations/latestUpdateWorkflow";
import {
  resolveAgentPermissionsDraft,
} from "@/features/agents/operations/agentPermissionsOperation";
import {
  executeROCclawBootstrapLoadCommands,
  executeROCclawFocusedPatchCommands,
  executeROCclawFocusedPreferenceLoadCommands,
  runROCclawBootstrapLoadOperation,
  runROCclawFocusFilterPersistenceOperation,
  runROCclawFocusedPreferenceLoadOperation,
  runROCclawFocusedSelectionPersistenceOperation,
} from "@/features/agents/operations/bootstrapOperation";
import { planStartupFleetBootstrapIntent } from "@/features/agents/operations/bootstrapWorkflow";
import {
  CREATE_AGENT_DEFAULT_PERMISSIONS,
  applyCreateAgentBootstrapPermissions,
  executeCreateAgentBootstrapCommands,
  runCreateAgentBootstrapOperation,
} from "@/features/agents/operations/createAgentBootstrapOperation";
import {
  buildQueuedMutationBlock,
  isCreateBlockTimedOut,
  resolveConfigMutationStatusLine,
  runCreateAgentMutationLifecycle,
  type CreateAgentBlockState,
} from "@/features/agents/operations/mutationLifecycleWorkflow";
import { useAgentSettingsMutationController } from "@/features/agents/operations/useAgentSettingsMutationController";
import { useRuntimeSyncController } from "@/features/agents/operations/useRuntimeSyncController";
import { useChatInteractionController } from "@/features/agents/operations/useChatInteractionController";
import {
  SETTINGS_ROUTE_AGENT_ID_QUERY_PARAM,
  parseSettingsRouteAgentIdFromQueryParam,
  parseSettingsRouteAgentIdFromPathname,
  type InspectSidebarState,
  type SettingsRouteTab,
} from "@/features/agents/operations/settingsRouteWorkflow";
import { useSettingsRouteController } from "@/features/agents/operations/useSettingsRouteController";
import {
  loadDomainAgentHistoryWindow,
  listDomainCronJobs,
} from "@/lib/controlplane/domain-runtime-client";
import { useRuntimeEventStream } from "@/features/agents/state/useRuntimeEventStream";
import {
  PENDING_EXEC_APPROVAL_PRUNE_GRACE_MS,
  RESERVED_MAIN_AGENT_ID,
  resolveControlUiUrl,
  resolveNextNewAgentName,
} from "@/features/agents/operations/pageUtilities";

const AgentROCclawPage = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const settingsRouteAgentId = useMemo(
    () =>
      parseSettingsRouteAgentIdFromQueryParam(
        searchParams.get(SETTINGS_ROUTE_AGENT_ID_QUERY_PARAM)
      ) ?? parseSettingsRouteAgentIdFromPathname(pathname ?? ""),
    [pathname, searchParams]
  );
  const settingsRouteActive = settingsRouteAgentId !== null;
  const {
    settingsCoordinator,
    client,
    gatewayUrl,
    draftGatewayUrl,
    token,
    localGatewayDefaults,
    localGatewayDefaultsHasToken,
    hasStoredToken,
    hasUnsavedChanges,
    installContext,
    statusReason,
    gatewayError,
    testResult,
    gatewaySaving,
    gatewayTesting,
    gatewayDisconnecting,
    saveSettings,
    testConnection,
    disconnect,
    useLocalGatewayDefaults,
    setGatewayUrl,
    setToken,
    applyRuntimeStatusEvent,
    clearGatewayError,
    gatewayStatus,
    gatewayConnected,
    gatewayConnectionStatus,
    coreConnected,
    coreStatus,
    runtimeStreamResumeKey,
    runtimeWriteTransport,
  } = useGatewayConnectionOrchestrator();

  const { state, dispatch, hydrateAgents, setError, setLoading } = useAgentStore();
  const [showConnectSetup, setShowConnectSetup] = useState(false);
  const [focusFilter, setFocusFilter] = useState<FocusFilter>("all");
  const [focusedPreferencesLoaded, setFocusedPreferencesLoaded] = useState(false);
  const [agentsLoadedOnce, setAgentsLoadedOnce] = useState(false);
  const [didAttemptGatewayConnect, setDidAttemptGatewayConnect] = useState(false);
  const stateRef = useRef(state);
  const dispatchAgentStoreAction = useCallback(
    (action: Parameters<typeof agentStoreReducer>[1]) => {
      stateRef.current = agentStoreReducer(stateRef.current, action);
      dispatch(action);
    },
    [dispatch]
  );
  const focusFilterTouchedRef = useRef(false);
  const [gatewayModels, setGatewayModels] = useState<GatewayModelChoice[]>([]);
  const [gatewayModelsError, setGatewayModelsError] = useState<string | null>(null);
  const [gatewayConfigSnapshot, setGatewayConfigSnapshot] =
    useState<GatewayModelPolicySnapshot | null>(null);
  const [createAgentBusy, setCreateAgentBusy] = useState(false);
  const [createAgentModalOpen, setCreateAgentModalOpen] = useState(false);
  const [createAgentModalError, setCreateAgentModalError] = useState<string | null>(null);
  const [activeTabs, setActiveTabs] = useState<TabId[]>(() => {
    if (typeof window === "undefined") return getDefaultActiveTabs();
    try {
      const stored = localStorage.getItem("rocclaw-active-tabs");
      if (stored) {
        const parsed = JSON.parse(stored) as TabId[];
        if (Array.isArray(parsed)) {
          const valid = parsed.filter((id) => VALID_TAB_IDS.has(id));
          if (valid.length > 0) return valid;
        }
      }
    } catch { /* use defaults */ }
    return getDefaultActiveTabs();
  });
  const [inspectSidebar, setInspectSidebar] = useState<InspectSidebarState>(null);
  const setMobilePaneChat = useCallback(() => {}, []);
  const [personalityHasUnsavedChanges, setPersonalityHasUnsavedChanges] = useState(false);
  const [createAgentBlock, setCreateAgentBlock] = useState<CreateAgentBlockState | null>(null);
  const [pendingExecApprovalsByAgentId, setPendingExecApprovalsByAgentId] = useState<
    Record<string, PendingExecApproval[]>
  >({});
  const [unscopedPendingExecApprovals, setUnscopedPendingExecApprovals] = useState<
    PendingExecApproval[]
  >([]);
  const pendingExecApprovalsByAgentIdRef = useRef(pendingExecApprovalsByAgentId);
  const unscopedPendingExecApprovalsRef = useRef(unscopedPendingExecApprovals);
  const specialUpdateRef = useRef<Map<string, string>>(new Map());
  const seenCronEventIdsRef = useRef<Set<string>>(new Set());
  const preferredSelectedAgentIdRef = useRef<string | null>(null);
  const [preferredSelectedAgentId, setPreferredSelectedAgentId] = useState<string | null>(null);
  const lastPersistedFocusedSelectionRef = useRef<{
    gatewayKey: string;
    selectedAgentId: string | null;
  } | null>(null);
  const runtimeEventHandlerRef = useRef<ReturnType<typeof createGatewayRuntimeEventHandler> | null>(
    null
  );
  const enqueueConfigMutationRef = useRef<
    (params: {
      kind: ConfigMutationKind;
      label: string;
      run: () => Promise<void>;
      requiresIdleAgents?: boolean;
    }) => Promise<void>
  >((input) => Promise.reject(new Error(`Config mutation queue not ready for "${input.kind}".`)));
  const approvalPausedRunIdByAgentRef = useRef<Map<string, string>>(new Map());
  const domainEventIngressRef = useRef<(event: EventFrame) => void>(() => {});
  const pendingDomainOutboxEntriesRef = useRef<ControlPlaneOutboxEntry[]>([]);
  const loadAgentsInFlightRef = useRef<Promise<void> | null>(null);
  const startupFleetBootstrapCompletedKeyRef = useRef<string | null>(null);
  const startupFleetBootstrapInFlightKeyRef = useRef<string | null>(null);

  const agents = state.agents;
  const selectedAgent = useMemo(() => getSelectedAgent(state), [state]);
  const filteredAgents = useMemo(
    () => getFilteredAgents(state, focusFilter),
    [focusFilter, state]
  );
  const focusedAgent = useMemo(() => {
    if (filteredAgents.length === 0) return null;
    const selectedInFilter = selectedAgent
      ? filteredAgents.find((entry) => entry.agentId === selectedAgent.agentId)
      : null;
    return selectedInFilter ?? filteredAgents[0] ?? null;
  }, [filteredAgents, selectedAgent]);
  const focusedAgentId = focusedAgent?.agentId ?? null;
  const focusedAgentStopDisabledReason = useMemo(() => {
    if (!focusedAgent) return null;
    if (focusedAgent.status !== "running") return null;
    const lastMessage = focusedAgent.lastUserMessage?.trim() ?? "";
    if (!lastMessage || !isHeartbeatPrompt(lastMessage)) return null;
    return "This task is running as an automatic heartbeat check. Stopping heartbeat runs from rocCLAW isn't available yet (coming soon).";
  }, [focusedAgent]);
  const inspectSidebarAgentId = inspectSidebar?.agentId ?? null;
  const inspectSidebarTab = inspectSidebar?.tab ?? null;
  const effectiveSettingsTab: SettingsRouteTab = inspectSidebarTab ?? "personality";
  const inspectSidebarAgent = useMemo(() => {
    if (!inspectSidebarAgentId) return null;
    return agents.find((entry) => entry.agentId === inspectSidebarAgentId) ?? null;
  }, [agents, inspectSidebarAgentId]);
  const settingsAgentPermissionsDraft = useMemo(() => {
    if (!inspectSidebarAgent) return null;
    const baseConfig =
      gatewayConfigSnapshot?.config &&
      typeof gatewayConfigSnapshot.config === "object" &&
      !Array.isArray(gatewayConfigSnapshot.config)
        ? (gatewayConfigSnapshot.config as Record<string, unknown>)
        : undefined;
    const list = readConfigAgentList(baseConfig);
    const configEntry = list.find((entry) => entry.id === inspectSidebarAgent.agentId) ?? null;
    const toolsRaw =
      configEntry && typeof (configEntry as Record<string, unknown>).tools === "object"
        ? ((configEntry as Record<string, unknown>).tools as unknown)
        : null;
    const tools =
      toolsRaw && typeof toolsRaw === "object" && !Array.isArray(toolsRaw)
        ? (toolsRaw as Record<string, unknown>)
        : null;
    return resolveAgentPermissionsDraft({
      agent: inspectSidebarAgent,
      existingTools: tools,
    });
  }, [gatewayConfigSnapshot, inspectSidebarAgent]);
  const focusedPendingExecApprovals = useMemo(() => {
    if (!focusedAgentId) return unscopedPendingExecApprovals;
    const scoped = pendingExecApprovalsByAgentId[focusedAgentId] ?? [];
    return mergePendingApprovalsForFocusedAgent({
      scopedApprovals: scoped,
      unscopedApprovals: unscopedPendingExecApprovals,
    });
  }, [focusedAgentId, pendingExecApprovalsByAgentId, unscopedPendingExecApprovals]);
  const suggestedCreateAgentName = useMemo(() => {
    try {
      return resolveNextNewAgentName(state.agents);
    } catch {
      return "New Agent";
    }
  }, [state.agents]);
  const rawErrorMessage = state.error ?? gatewayError ?? gatewayModelsError;
  const [dismissedError, setDismissedError] = useState<string | null>(null);
  const errorMessage = rawErrorMessage && rawErrorMessage !== dismissedError ? rawErrorMessage : null;
  const rocclawCliUpdateWarning = useMemo(() => {
    const rocclawCli = installContext.rocclawCli;
    if (!rocclawCli.installed || !rocclawCli.updateAvailable) return null;
    const current = rocclawCli.currentVersion?.trim() || "current";
    const latest = rocclawCli.latestVersion?.trim() || "latest";
    return `openclaw-rocclaw CLI ${current} is installed on this host, but ${latest} is available. Run npx -y openclaw-rocclaw@latest to update.`;
  }, [installContext]);
  const runningAgentCount = useMemo(
    () => agents.filter((agent) => agent.status === "running").length,
    [agents]
  );
  const hasRunningAgents = runningAgentCount > 0;
  const isLocalGateway = useMemo(() => isLocalGatewayUrl(gatewayUrl), [gatewayUrl]);
  const controlUiUrl = useMemo(
    () => resolveControlUiUrl({ gatewayUrl, configSnapshot: gatewayConfigSnapshot }),
    [gatewayConfigSnapshot, gatewayUrl]
  );
  const settingsHeaderModel = (inspectSidebarAgent?.model ?? "").trim() || "Default";
  const settingsHeaderThinkingRaw = (inspectSidebarAgent?.thinkingLevel ?? "").trim() || "low";
  const settingsHeaderThinking =
    settingsHeaderThinkingRaw.charAt(0).toUpperCase() + settingsHeaderThinkingRaw.slice(1);

  const resolveCronJobForAgent = useCallback((jobs: CronJobSummary[], agentId: string) => {
    return resolveLatestCronJobForAgent(jobs, agentId);
  }, []);

  const specialLatestUpdate = useMemo(() => {
    return createSpecialLatestUpdateOperation({
      loadAgentHistoryWindow: loadDomainAgentHistoryWindow,
      listCronJobs: () => listDomainCronJobs({ includeDisabled: true }),
      resolveCronJobForAgent,
      formatCronJobDisplay,
      dispatchUpdateAgent: (agentId, patch) => {
        dispatch({ type: "updateAgent", agentId, patch });
      },
      isDisconnectLikeError: isGatewayDisconnectLikeError,
      logError: (message) => console.error(message),
    });
  }, [dispatch, resolveCronJobForAgent]);

  const loadAgents = useCallback(async () => {
    const inFlight = loadAgentsInFlightRef.current;
    if (inFlight) {
      await inFlight;
      return;
    }
    const run = (async () => {
      if (!coreConnected) return;
      setLoading(true);
      try {
        const commands = await runROCclawBootstrapLoadOperation({
          cachedConfigSnapshot: gatewayConfigSnapshot,
          preferredSelectedAgentId: preferredSelectedAgentIdRef.current,
          hasCurrentSelection: Boolean(stateRef.current.selectedAgentId),
        });
        executeROCclawBootstrapLoadCommands({
          commands,
          setGatewayConfigSnapshot,
          hydrateAgents,
          dispatchUpdateAgent: (agentId, patch) => {
            dispatch({ type: "updateAgent", agentId, patch });
          },
          setError,
        });
      } finally {
        setLoading(false);
        setAgentsLoadedOnce(true);
      }
    })();
    loadAgentsInFlightRef.current = run;
    try {
      await run;
    } finally {
      if (loadAgentsInFlightRef.current === run) {
        loadAgentsInFlightRef.current = null;
      }
    }
  }, [
    dispatch,
    hydrateAgents,
    setError,
    setLoading,
    gatewayConfigSnapshot,
    coreConnected,
  ]);

  const enqueueConfigMutationFromRef = useCallback(
    (mutation: { kind: ConfigMutationKind; label: string; run: () => Promise<void> }) => {
      return enqueueConfigMutationRef.current(mutation);
    },
    []
  );

  const { refreshGatewayConfigSnapshot } = useGatewayConfigSyncController({
    status: gatewayConnectionStatus,
    settingsRouteActive,
    inspectSidebarAgentId,
    setGatewayConfigSnapshot,
    setGatewayModels,
    setGatewayModelsError,
    isDisconnectLikeError: isGatewayDisconnectLikeError,
  });

  const settingsMutationController = useAgentSettingsMutationController({
    client,
    runtimeWriteTransport,
    status: gatewayConnectionStatus,
    isLocalGateway,
    agents,
    hasCreateBlock: Boolean(createAgentBlock),
    enqueueConfigMutation: enqueueConfigMutationFromRef,
    gatewayConfigSnapshot,
    settingsRouteActive,
    inspectSidebarAgentId,
    inspectSidebarTab,
    loadAgents,
    refreshGatewayConfigSnapshot,
    clearInspectSidebar: () => {
      setInspectSidebar(null);
    },
    setInspectSidebarCapabilities: (agentId) => {
      setInspectSidebar((current) => {
        if (current?.agentId === agentId) return current;
        return { agentId, tab: "capabilities" };
      });
    },
    dispatchUpdateAgent: (agentId, patch) => {
      dispatch({
        type: "updateAgent",
        agentId,
        patch,
      });
    },
    setMobilePaneChat,
    setError,
    useDomainIntents: true,
    gatewayUrl,
    schedulePatch: settingsCoordinator.schedulePatch.bind(settingsCoordinator),
  });

  const hasRenameMutationBlock = settingsMutationController.hasRenameMutationBlock;
  const hasDeleteMutationBlock = settingsMutationController.hasDeleteMutationBlock;
  const restartingMutationBlock = settingsMutationController.restartingMutationBlock;
  const hasRestartBlockInProgress = Boolean(
    settingsMutationController.hasRestartBlockInProgress ||
      (createAgentBlock && createAgentBlock.phase !== "queued")
  );

  const {
    enqueueConfigMutation,
    queuedCount: queuedConfigMutationCount,
    queuedBlockedByRunningAgents,
    activeConfigMutation,
  } = useConfigMutationQueue({
    status: gatewayConnectionStatus,
    hasRunningAgents,
    hasRestartBlockInProgress,
  });
  enqueueConfigMutationRef.current = enqueueConfigMutation;

  // Persist active tabs to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("rocclaw-active-tabs", JSON.stringify(activeTabs));
    } catch { /* best-effort */ }
  }, [activeTabs]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    pendingExecApprovalsByAgentIdRef.current = pendingExecApprovalsByAgentId;
  }, [pendingExecApprovalsByAgentId]);

  useEffect(() => {
    unscopedPendingExecApprovalsRef.current = unscopedPendingExecApprovals;
  }, [unscopedPendingExecApprovals]);

  useEffect(() => {
    if (coreConnected) return;
    setAgentsLoadedOnce(false);
  }, [coreConnected, gatewayUrl]);

  useEffect(() => {
    const key = gatewayUrl.trim();
    if (!key) {
      preferredSelectedAgentIdRef.current = null;
      lastPersistedFocusedSelectionRef.current = null;
      setFocusedPreferencesLoaded(true);
      return;
    }
    setFocusedPreferencesLoaded(false);
    focusFilterTouchedRef.current = false;
    preferredSelectedAgentIdRef.current = null;
    lastPersistedFocusedSelectionRef.current = null;
    // Use promise chain instead of async/await to avoid cancellation issues
    runROCclawFocusedPreferenceLoadOperation({
      gatewayUrl,
      loadROCclawSettings: settingsCoordinator.loadSettings.bind(settingsCoordinator),
      isFocusFilterTouched: () => focusFilterTouchedRef.current,
    }).then((commands) => {
      executeROCclawFocusedPreferenceLoadCommands({
        commands,
        setFocusedPreferencesLoaded,
        setPreferredSelectedAgentId: (agentId) => {
          preferredSelectedAgentIdRef.current = agentId;
          setPreferredSelectedAgentId(agentId);
          const normalizedAgentId = agentId?.trim() ?? "";
          lastPersistedFocusedSelectionRef.current = {
            gatewayKey: key,
            selectedAgentId: normalizedAgentId.length > 0 ? normalizedAgentId : null,
          };
        },
        setFocusFilter,
        logError: (message, error) => console.error(message, error),
      });
    });
  }, [gatewayUrl, settingsCoordinator]);


  useEffect(() => {
    const commands = runROCclawFocusFilterPersistenceOperation({
      gatewayUrl,
      focusFilterTouched: focusFilterTouchedRef.current,
      focusFilter,
    });
    executeROCclawFocusedPatchCommands({
      commands,
      schedulePatch: settingsCoordinator.schedulePatch.bind(settingsCoordinator),
      applyPatchNow: settingsCoordinator.applyPatchNow.bind(settingsCoordinator),
      logError: (message, error) => console.error(message, error),
    });
  }, [focusFilter, gatewayUrl, settingsCoordinator]);

  useEffect(() => {
    const normalizedGatewayKey = gatewayUrl.trim();
    const normalizedSelectedAgentId = (state.selectedAgentId?.trim() ?? "") || null;
    const lastPersistedSelection = lastPersistedFocusedSelectionRef.current;
    const lastPersistedSelectedAgentId =
      lastPersistedSelection && lastPersistedSelection.gatewayKey === normalizedGatewayKey
        ? lastPersistedSelection.selectedAgentId
        : null;
    const commands = runROCclawFocusedSelectionPersistenceOperation({
      gatewayUrl,
      status: coreStatus,
      focusedPreferencesLoaded,
      agentsLoadedOnce,
      selectedAgentId: state.selectedAgentId,
      lastPersistedSelectedAgentId,
    });
    executeROCclawFocusedPatchCommands({
      commands,
      schedulePatch: settingsCoordinator.schedulePatch.bind(settingsCoordinator),
      applyPatchNow: async (patch) => {
        await settingsCoordinator.applyPatchNow(patch);
        lastPersistedFocusedSelectionRef.current = {
          gatewayKey: normalizedGatewayKey,
          selectedAgentId: normalizedSelectedAgentId,
        };
      },
      logError: (message, error) => console.error(message, error),
    });
  }, [
    agentsLoadedOnce,
    focusedPreferencesLoaded,
    gatewayUrl,
    settingsCoordinator,
    coreStatus,
    state.selectedAgentId,
  ]);

  useEffect(() => {
    const intent = planStartupFleetBootstrapIntent({
      coreConnected,
      focusedPreferencesLoaded,
      hasRestartingMutationBlock: Boolean(
        restartingMutationBlock && restartingMutationBlock.phase !== "queued"
      ),
      hasCreateAgentBlock: Boolean(createAgentBlock && createAgentBlock.phase !== "queued"),
      gatewayUrl,
      lastCompletedKey: startupFleetBootstrapCompletedKeyRef.current,
      inFlightKey: startupFleetBootstrapInFlightKeyRef.current,
    });
    if (intent.kind !== "load") return;
    startupFleetBootstrapInFlightKeyRef.current = intent.key;
    void (async () => {
      try {
        await loadAgents();
        startupFleetBootstrapCompletedKeyRef.current = intent.key;
      } finally {
        if (startupFleetBootstrapInFlightKeyRef.current === intent.key) {
          startupFleetBootstrapInFlightKeyRef.current = null;
        }
      }
    })();
  }, [
    coreConnected,
    createAgentBlock,
    focusedPreferencesLoaded,
    gatewayUrl,
    loadAgents,
    preferredSelectedAgentId,
    restartingMutationBlock,
  ]);

  useEffect(() => {
    if (coreConnected && focusedPreferencesLoaded) return;
    startupFleetBootstrapCompletedKeyRef.current = null;
    startupFleetBootstrapInFlightKeyRef.current = null;
  }, [coreConnected, focusedPreferencesLoaded]);

  useEffect(() => {
    startupFleetBootstrapCompletedKeyRef.current = null;
    startupFleetBootstrapInFlightKeyRef.current = null;
  }, [gatewayUrl]);

  useEffect(() => {
    if (!coreConnected) {
      setLoading(false);
    }
  }, [coreConnected, setLoading]);

  useEffect(() => {
    const nowMs = Date.now();
    const delayMs = planPendingPruneDelay({
      pendingState: {
        approvalsByAgentId: pendingExecApprovalsByAgentId,
        unscopedApprovals: unscopedPendingExecApprovals,
      },
      nowMs,
      graceMs: PENDING_EXEC_APPROVAL_PRUNE_GRACE_MS,
    });
    if (delayMs === null) return;
    const timerId = window.setTimeout(() => {
      const pendingState = planPrunedPendingState({
        pendingState: {
          approvalsByAgentId: pendingExecApprovalsByAgentIdRef.current,
          unscopedApprovals: unscopedPendingExecApprovalsRef.current,
        },
        nowMs: Date.now(),
        graceMs: PENDING_EXEC_APPROVAL_PRUNE_GRACE_MS,
      });
      pendingExecApprovalsByAgentIdRef.current = pendingState.approvalsByAgentId;
      unscopedPendingExecApprovalsRef.current = pendingState.unscopedApprovals;
      setPendingExecApprovalsByAgentId(pendingState.approvalsByAgentId);
      setUnscopedPendingExecApprovals(pendingState.unscopedApprovals);
    }, delayMs);
    return () => {
      window.clearTimeout(timerId);
    };
  }, [pendingExecApprovalsByAgentId, unscopedPendingExecApprovals]);

  useEffect(() => {
    const patches = planAwaitingUserInputPatches({
      agents,
      approvalsByAgentId: pendingExecApprovalsByAgentId,
    });
    for (const patch of patches) {
      dispatch({
        type: "updateAgent",
        agentId: patch.agentId,
        patch: { awaitingUserInput: patch.awaitingUserInput },
      });
    }
  }, [agents, dispatch, pendingExecApprovalsByAgentId]);

  useEffect(() => {
    for (const agent of agents) {
      const lastMessage = agent.lastUserMessage?.trim() ?? "";
      const key = agent.agentId;
      const marker = buildLatestUpdateTriggerMarker({
        message: lastMessage,
        lastAssistantMessageAt: agent.lastAssistantMessageAt,
      });
      const previous = specialUpdateRef.current.get(key);
      if (previous === marker) continue;
      specialUpdateRef.current.set(key, marker);
      void specialLatestUpdate.update(agent.agentId, agent, lastMessage);
    }
  }, [agents, specialLatestUpdate]);

  const ingestDomainOutboxEntries = useCallback((entries: ControlPlaneOutboxEntry[]) => {
    if (!Array.isArray(entries) || entries.length === 0) return;
    const handler = runtimeEventHandlerRef.current;
    const ingestEvent = domainEventIngressRef.current;
    if (!handler) {
      pendingDomainOutboxEntriesRef.current.push(...entries);
      const overflow = pendingDomainOutboxEntriesRef.current.length - 5_000;
      if (overflow > 0) {
        pendingDomainOutboxEntriesRef.current.splice(0, overflow);
      }
      return;
    }
    for (const entry of entries) {
      if (entry.event.type !== "gateway.event") continue;
      const frame: EventFrame = {
        type: "event",
        event: entry.event.event,
        payload: entry.event.payload,
        ...(typeof entry.event.seq === "number" ? { seq: entry.event.seq } : {}),
      };
      handler.handleEvent(frame);
      ingestEvent(frame);
    }
  }, []);

  const { loadAgentHistory, loadMoreAgentHistory, clearHistoryInFlight } = useRuntimeSyncController({
    status: coreStatus,
    gatewayUrl,
    agents,
    focusedAgentId,
    dispatch,
    isDisconnectLikeError: isGatewayDisconnectLikeError,
  });

  const {
    stopBusyAgentId,
    flushPendingDraft,
    handleDraftChange,
    handleSend,
    removeQueuedMessage,
    handleNewSession,
    handleStopRun,
    queueLivePatch,
    clearPendingLivePatch,
  } = useChatInteractionController({
    client,
    runtimeWriteTransport,
    status: gatewayConnectionStatus,
    agents,
    dispatch,
    setError,
    getAgents: () => stateRef.current.agents,
    clearRunTracking: (runId) => {
      runtimeEventHandlerRef.current?.clearRunTracking(runId);
    },
    clearHistoryInFlight,
    clearSpecialUpdateMarker: (agentId) => {
      specialUpdateRef.current.delete(agentId);
    },
    clearSpecialLatestUpdateInFlight: (agentId) => {
      specialLatestUpdate.clearInFlight(agentId);
    },
    setInspectSidebarNull: () => {
      setInspectSidebar(null);
    },
    setMobilePaneChat,
  });

  const handleFocusFilterChange = useCallback(
    (next: FocusFilter) => {
      flushPendingDraft(focusedAgent?.agentId ?? null);
      focusFilterTouchedRef.current = true;
      setFocusFilter(next);
    },
    [flushPendingDraft, focusedAgent]
  );

  const {
    handleBackToChat,
    handleSettingsRouteTabChange,
    handleOpenAgentSettingsRoute,
    handleFleetSelectAgent,
  } = useSettingsRouteController({
    settingsRouteActive,
    settingsRouteAgentId,
    status: gatewayConnectionStatus,
    agentsLoadedOnce,
    selectedAgentId: state.selectedAgentId,
    focusedAgentId: focusedAgent?.agentId ?? null,
    focusedPreferencesLoaded,
    personalityHasUnsavedChanges,
    activeTab: effectiveSettingsTab,
    inspectSidebar,
    agents,
    flushPendingDraft,
    dispatchSelectAgent: (agentId) => {
      dispatch({ type: "selectAgent", agentId });
    },
    setInspectSidebar,
    setMobilePaneChat,
    setPersonalityHasUnsavedChanges,
    push: router.push,
    replace: router.replace,
    confirmDiscard: () => window.confirm("Discard changes?"),
  });
  const handleOpenCreateAgentModal = useCallback(() => {
    if (createAgentBusy) return;
    if (createAgentBlock) return;
    if (restartingMutationBlock) return;
    setCreateAgentModalError(null);
    setCreateAgentModalOpen(true);
  }, [createAgentBlock, createAgentBusy, restartingMutationBlock]);

  const persistAvatarConfig = useCallback(
    (agentId: string, avatarSeed: string, avatarSource: string, defaultAvatarIndex: number, avatarUrl: string) => {
      const resolvedAgentId = agentId.trim();
      const resolvedAvatarSeed = avatarSeed.trim();
      const resolvedSource = avatarSource.trim();
      const resolvedUrl = avatarUrl.trim();
      const key = gatewayUrl.trim();
      if (!resolvedAgentId || !key) return;
      settingsCoordinator.schedulePatch(
        {
          avatars: {
            [key]: {
              [resolvedAgentId]: resolvedAvatarSeed || null,
            },
          },
          avatarSources: {
            [key]: {
              [resolvedAgentId]: {
                source: resolvedSource || "auto",
                defaultIndex: defaultAvatarIndex,
                url: resolvedUrl || null,
              },
            },
          },
        },
        0
      );
    },
    [gatewayUrl, settingsCoordinator]
  );

  const handleCreateAgentSubmit = useCallback(
    async (payload: AgentCreateModalSubmitPayload) => {
      await runCreateAgentMutationLifecycle(
        {
          payload,
          status: gatewayConnectionStatus,
          hasCreateBlock: Boolean(createAgentBlock),
          hasRenameBlock: hasRenameMutationBlock,
          hasDeleteBlock: hasDeleteMutationBlock,
          createAgentBusy,
        },
        {
          enqueueConfigMutation,
          createAgent: async (name, avatarSeed, avatarSource, defaultAvatarIndex, avatarUrl) => {
            const created = await runtimeWriteTransport.agentCreate({ name });
            persistAvatarConfig(
              created.id,
              avatarSeed ?? "",
              avatarSource ?? "auto",
              defaultAvatarIndex ?? 0,
              avatarUrl ?? ""
            );
            flushPendingDraft(focusedAgent?.agentId ?? null);
            focusFilterTouchedRef.current = true;
            setFocusFilter("all");
            dispatch({ type: "selectAgent", agentId: created.id });
            return { id: created.id };
          },
          setQueuedBlock: ({ agentName, startedAt }) => {
            const queuedCreateBlock = buildQueuedMutationBlock({
              kind: "create-agent",
              agentId: "",
              agentName,
              startedAt,
            });
            setCreateAgentBlock({
              agentName: queuedCreateBlock.agentName,
              phase: "queued",
              startedAt: queuedCreateBlock.startedAt,
            });
          },
          setCreatingBlock: (agentName) => {
            setCreateAgentBlock((current) => {
              if (!current || current.agentName !== agentName) return current;
              return { ...current, phase: "creating" };
            });
          },
          onCompletion: async (completion) => {
            const commands = await runCreateAgentBootstrapOperation({
              completion,
              focusedAgentId: focusedAgent?.agentId ?? null,
              loadAgents,
              findAgentById: (agentId) =>
                stateRef.current.agents.find((entry) => entry.agentId === agentId) ?? null,
              applyDefaultPermissions: async ({ agentId, sessionKey }) => {
                await applyCreateAgentBootstrapPermissions({
                  client,
                  runtimeWriteTransport,
                  agentId,
                  sessionKey,
                  draft: { ...CREATE_AGENT_DEFAULT_PERMISSIONS },
                  loadAgents,
                });
              },
              refreshGatewayConfigSnapshot,
            });
            executeCreateAgentBootstrapCommands({
              commands,
              setCreateAgentModalError,
              setGlobalError: setError,
              setCreateAgentBlock: (value) => {
                setCreateAgentBlock(value);
              },
              setCreateAgentModalOpen,
              flushPendingDraft,
              selectAgent: (agentId) => {
                dispatch({ type: "selectAgent", agentId });
              },
              setInspectSidebarCapabilities: (agentId) => {
                setInspectSidebar({ agentId, tab: "capabilities" });
              },
              setMobilePaneChat,
            });
          },
          setCreateAgentModalError,
          setCreateAgentBusy,
          clearCreateBlock: () => {
            setCreateAgentBlock(null);
          },
          onError: setError,
        }
      );
    },
    [
      client,
      createAgentBusy,
      createAgentBlock,
      dispatch,
      enqueueConfigMutation,
      flushPendingDraft,
      focusedAgent,
      hasDeleteMutationBlock,
      hasRenameMutationBlock,
      loadAgents,
      persistAvatarConfig,
      refreshGatewayConfigSnapshot,
      runtimeWriteTransport,
      setError,
      setMobilePaneChat,
      gatewayConnectionStatus,
    ]
  );

  useEffect(() => {
    if (!createAgentBlock || createAgentBlock.phase === "queued") return;
    const maxWaitMs = 90_000;
    const timeoutNow = isCreateBlockTimedOut({
      block: createAgentBlock,
      nowMs: Date.now(),
      maxWaitMs,
    });
    const handleTimeout = () => {
      setCreateAgentBlock(null);
      setCreateAgentModalOpen(false);
      void loadAgents();
      setError("Agent creation timed out.");
    };
    if (timeoutNow) {
      handleTimeout();
      return;
    }
    const elapsed = Date.now() - createAgentBlock.startedAt;
    const remaining = Math.max(0, maxWaitMs - elapsed);
    const timeoutId = window.setTimeout(() => {
      if (
        !isCreateBlockTimedOut({
          block: createAgentBlock,
          nowMs: Date.now(),
          maxWaitMs,
        })
      ) {
        return;
      }
      handleTimeout();
    }, remaining);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [createAgentBlock, loadAgents, setError]);

  const handleSessionSettingChange = useCallback(
    async (
      agentId: string,
      sessionKey: string,
      field: "model" | "thinkingLevel",
      value: string | null
    ) => {
      await applySessionSettingMutation({
        agents: stateRef.current.agents,
        dispatch,
        client,
        runtimeWriteTransport,
        agentId,
        sessionKey,
        field,
        value,
      });
    },
    [client, dispatch, runtimeWriteTransport]
  );

  const handleModelChange = useCallback(
    async (agentId: string, sessionKey: string, value: string | null) => {
      await handleSessionSettingChange(agentId, sessionKey, "model", value);
    },
    [handleSessionSettingChange]
  );

  const handleThinkingChange = useCallback(
    async (agentId: string, sessionKey: string, value: string | null) => {
      await handleSessionSettingChange(agentId, sessionKey, "thinkingLevel", value);
    },
    [handleSessionSettingChange]
  );


  const handleToolCallingToggle = useCallback(
    (agentId: string, enabled: boolean) => {
      dispatch({
        type: "updateAgent",
        agentId,
        patch: { toolCallingEnabled: enabled },
      });
    },
    [dispatch]
  );

  const handleThinkingTracesToggle = useCallback(
    (agentId: string, enabled: boolean) => {
      dispatch({
        type: "updateAgent",
        agentId,
        patch: { showThinkingTraces: enabled },
      });
      if (enabled) {
        void loadAgentHistory(agentId, { reason: "refresh" });
      }
    },
    [dispatch, loadAgentHistory]
  );

  const handleResolveExecApproval = useCallback(
    async (approvalId: string, decision: ExecApprovalDecision) => {
      await runResolveExecApprovalOperation({
        client,
        runtimeWriteTransport,
        approvalId,
        decision,
        getAgents: () => stateRef.current.agents,
        getPendingState: () => ({
          approvalsByAgentId: pendingExecApprovalsByAgentIdRef.current,
          unscopedApprovals: unscopedPendingExecApprovalsRef.current,
        }),
        setPendingExecApprovalsByAgentId: (next) => {
          setPendingExecApprovalsByAgentId((current) => {
            const resolved = typeof next === "function" ? next(current) : next;
            pendingExecApprovalsByAgentIdRef.current = resolved;
            return resolved;
          });
        },
        setUnscopedPendingExecApprovals: (next) => {
          setUnscopedPendingExecApprovals((current) => {
            const resolved = typeof next === "function" ? next(current) : next;
            unscopedPendingExecApprovalsRef.current = resolved;
            return resolved;
          });
        },
        requestHistoryRefresh: (agentId) => loadAgentHistory(agentId),
        pausedRunIdByAgentId: approvalPausedRunIdByAgentRef.current,
        dispatch: dispatchAgentStoreAction,
        isDisconnectLikeError: isGatewayDisconnectLikeError,
        logWarn: (message, error) => console.warn(message, error),
        clearRunTracking: (runId) => runtimeEventHandlerRef.current?.clearRunTracking(runId),
      });
    },
    [client, dispatchAgentStoreAction, loadAgentHistory, runtimeWriteTransport]
  );

  const pauseRunForExecApproval = useCallback(
    async (approval: PendingExecApproval, preferredAgentId?: string | null) => {
      await runPauseRunForExecApprovalOperation({
        status: gatewayStatus,
        runtimeWriteTransport,
        approval,
        preferredAgentId: preferredAgentId ?? null,
        getAgents: () => stateRef.current.agents,
        pausedRunIdByAgentId: approvalPausedRunIdByAgentRef.current,
        isDisconnectLikeError: isGatewayDisconnectLikeError,
        logWarn: (message, error) => console.warn(message, error),
      });
    },
    [gatewayStatus, runtimeWriteTransport]
  );

  const handleGatewayEventIngress = useCallback(
    (event: EventFrame) => {
      runGatewayEventIngressOperation({
        event,
        getAgents: () => stateRef.current.agents,
        getPendingState: () => ({
          approvalsByAgentId: pendingExecApprovalsByAgentIdRef.current,
          unscopedApprovals: unscopedPendingExecApprovalsRef.current,
        }),
        pausedRunIdByAgentId: approvalPausedRunIdByAgentRef.current,
        seenCronDedupeKeys: seenCronEventIdsRef.current,
        nowMs: Date.now(),
        replacePendingState: (pendingState) => {
          if (
            pendingState.approvalsByAgentId !==
            pendingExecApprovalsByAgentIdRef.current
          ) {
            pendingExecApprovalsByAgentIdRef.current =
              pendingState.approvalsByAgentId;
            setPendingExecApprovalsByAgentId(pendingState.approvalsByAgentId);
          }
          if (
            pendingState.unscopedApprovals !==
            unscopedPendingExecApprovalsRef.current
          ) {
            unscopedPendingExecApprovalsRef.current =
              pendingState.unscopedApprovals;
            setUnscopedPendingExecApprovals(pendingState.unscopedApprovals);
          }
        },
        pauseRunForApproval: (approval, commandPreferredAgentId) =>
          pauseRunForExecApproval(approval, commandPreferredAgentId),
        dispatch: dispatchAgentStoreAction,
        recordCronDedupeKey: (dedupeKey) => seenCronEventIdsRef.current.add(dedupeKey),
      });
    },
    [dispatchAgentStoreAction, pauseRunForExecApproval]
  );
  domainEventIngressRef.current = handleGatewayEventIngress;

  useEffect(() => {
    const handler = createGatewayRuntimeEventHandler({
      getAgents: () => stateRef.current.agents,
      dispatch: dispatchAgentStoreAction,
      queueLivePatch,
      clearPendingLivePatch,
      setTimeout: (fn, delayMs) => window.setTimeout(fn, delayMs),
      clearTimeout: (id) => window.clearTimeout(id),
      logWarn: (message, meta) => console.warn(message, meta),
      shouldSuppressRunAbortedLine: ({ agentId, runId, stopReason }) => {
        if (stopReason !== "rpc") return false;
        const normalizedRunId = runId?.trim() ?? "";
        if (!normalizedRunId) return false;
        const pausedRunId = approvalPausedRunIdByAgentRef.current.get(agentId)?.trim() ?? "";
        return pausedRunId.length > 0 && pausedRunId === normalizedRunId;
      },
      updateSpecialLatestUpdate: (agentId, agent, message) => {
        void specialLatestUpdate.update(agentId, agent, message);
      },
    });
    runtimeEventHandlerRef.current = handler;
    if (pendingDomainOutboxEntriesRef.current.length > 0) {
      const pendingEntries = pendingDomainOutboxEntriesRef.current;
      pendingDomainOutboxEntriesRef.current = [];
      ingestDomainOutboxEntries(pendingEntries);
    }
    return () => {
      runtimeEventHandlerRef.current = null;
      handler.dispose();
    };
  }, [
    dispatchAgentStoreAction,
    clearPendingLivePatch,
    queueLivePatch,
    specialLatestUpdate,
    ingestDomainOutboxEntries,
  ]);

  const gatewayConnecting = gatewayStatus === "connecting" || gatewayStatus === "reconnecting";

  useRuntimeEventStream({
    onGatewayEvent: (event) => {
      runtimeEventHandlerRef.current?.handleEvent(event);
      domainEventIngressRef.current(event);
    },
    onRuntimeStatus: (event) => {
      applyRuntimeStatusEvent(event);
    },
    resumeKey: runtimeStreamResumeKey ?? undefined,
  });

  const handleAvatarShuffle = useCallback(
    async (agentId: string) => {
      const avatarSeed = randomUUID();
      dispatch({
        type: "updateAgent",
        agentId,
        patch: { avatarSeed, avatarSource: "auto" as const },
      });
      persistAvatarConfig(agentId, avatarSeed, "auto", 0, "");
    },
    [dispatch, persistAvatarConfig]
  );

  const hasAnyAgents = agents.length > 0;
  const configMutationStatusLine = activeConfigMutation
    ? `Applying config change: ${activeConfigMutation.label}`
    : queuedConfigMutationCount > 0
      ? queuedBlockedByRunningAgents
        ? `Queued ${queuedConfigMutationCount} config change${queuedConfigMutationCount === 1 ? "" : "s"}; waiting for ${runningAgentCount} running agent${runningAgentCount === 1 ? "" : "s"} to finish`
        : !gatewayConnected
          ? `Queued ${queuedConfigMutationCount} config change${queuedConfigMutationCount === 1 ? "" : "s"}; waiting for gateway connection`
          : `Queued ${queuedConfigMutationCount} config change${queuedConfigMutationCount === 1 ? "" : "s"}`
      : null;
  const createBlockStatusLine = createAgentBlock
    ? createAgentBlock.phase === "queued"
      ? "Waiting for active runs to finish"
      : createAgentBlock.phase === "creating"
      ? "Submitting config change"
      : null
    : null;
  const restartingMutationStatusLine = resolveConfigMutationStatusLine({
    block: restartingMutationBlock
      ? {
          phase: restartingMutationBlock.phase,
          sawDisconnect: restartingMutationBlock.sawDisconnect,
        }
      : null,
    status: gatewayStatus,
  });

  useEffect(() => {
    if (gatewayStatus === "connecting" || gatewayStatus === "reconnecting") {
      setDidAttemptGatewayConnect(true);
    }
  }, [gatewayStatus]);

  useEffect(() => {
    if (gatewayError) {
      setDidAttemptGatewayConnect(true);
    }
  }, [gatewayError]);

  if (
    !agentsLoadedOnce &&
    !coreConnected &&
    !showConnectSetup &&
    (!didAttemptGatewayConnect || gatewayConnecting)
  ) {
    return (
      <BootScreen
        connecting={gatewayConnecting}
        installContext={installContext}
        onEditSettings={() => setShowConnectSetup(true)}
      />
    );
  }

  if (!coreConnected && !agentsLoadedOnce && (didAttemptGatewayConnect || showConnectSetup)) {
    return (
      <ConnectionSetupView
        settingsRouteActive={settingsRouteActive}
        onBackToChat={handleBackToChat}
        savedGatewayUrl={gatewayUrl}
        draftGatewayUrl={draftGatewayUrl}
        token={token}
        localGatewayDefaults={localGatewayDefaults}
        localGatewayDefaultsHasToken={localGatewayDefaultsHasToken}
        hasStoredToken={hasStoredToken}
        hasUnsavedChanges={hasUnsavedChanges}
        installContext={installContext}
        status={gatewayStatus}
        statusReason={statusReason}
        error={gatewayError}
        testResult={testResult}
        saving={gatewaySaving}
        testing={gatewayTesting}
        disconnecting={gatewayDisconnecting}
        onGatewayUrlChange={setGatewayUrl}
        onTokenChange={setToken}
        onUseLocalDefaults={useLocalGatewayDefaults}
        onSaveSettings={() => void saveSettings()}
        onTestConnection={() => void testConnection()}
        onDisconnect={() => void disconnect()}
        onClearError={clearGatewayError}
        onConnect={() => {
          setShowConnectSetup(false);
          void saveSettings();
        }}
      />
    );
  }

  if (coreConnected && !agentsLoadedOnce) {
    return <LoadingScreen />;
  }

  return (
    <div className="relative min-h-dvh w-screen overflow-hidden bg-background">
      {state.loading ? (
        <div className="pointer-events-none fixed bottom-4 left-0 right-0 z-50 flex justify-center px-3">
          <div className="glass-panel ui-card px-6 py-3 font-mono text-[11px] tracking-[0.08em] text-muted-foreground">
            Loading agents…
          </div>
        </div>
      ) : null}
      <div className="relative z-10 flex h-dvh flex-col">
        <HeaderBar />
        <TabBar activeTabs={activeTabs} onTabToggle={(tabId) => {
          setActiveTabs((current) => {
            // Tasks and Skills tabs are exclusive — selecting one replaces everything
            const exclusiveTabs: TabId[] = ["tasks", "skills"];
            if (exclusiveTabs.includes(tabId)) {
              return current.includes(tabId) ? getDefaultActiveTabs() : [tabId];
            }
            // Non-exclusive tabs: remove any exclusive tab if present, then normal toggle
            let next = current.includes(tabId)
              ? current.filter((t) => t !== tabId)
              : [...current, tabId];
            next = next.filter((t) => !exclusiveTabs.includes(t as TabId));
            // Don't allow deselecting the last tab
            if (next.length === 0) return current;
            return next;
          });
        }} />
        <main id="main-content" className="flex min-h-0 flex-1 flex-col gap-3 px-3 pb-3 pt-2 sm:px-4 sm:pb-4 sm:pt-3 md:px-5 md:pb-5 md:pt-3">
          {/* Tasks/Skills tabs take exclusive full-width focus — hide everything else */}
          {(activeTabs.length === 1 && activeTabs[0] === "tasks") ? (
            <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
              <TasksDashboard />
            </div>
          ) : (activeTabs.length === 1 && activeTabs[0] === "skills") ? (
            <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
              <SkillsDashboard />
            </div>
          ) : (
            <>
          {rocclawCliUpdateWarning ? (
            <div className="w-full">
              <div className="ui-alert-danger rounded-md px-4 py-2 text-sm">
                {rocclawCliUpdateWarning}
              </div>
            </div>
          ) : null}

          {errorMessage ? (
            <div className="w-full">
              <div className="ui-alert-danger flex items-center justify-between rounded-md px-4 py-2 text-sm">
                <span>{errorMessage}</span>
                <button type="button" onClick={() => setDismissedError(errorMessage)} aria-label="Dismiss error" className="ml-3 shrink-0 rounded p-0.5 opacity-60 hover:opacity-100">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
          ) : null}
          {configMutationStatusLine ? (
            <div className="w-full">
              <div className="ui-card px-4 py-2 font-mono text-[11px] tracking-[0.07em] text-muted-foreground">
                {configMutationStatusLine}
              </div>
            </div>
          ) : null}

          {settingsRouteActive ? (
            <SettingsRoutePanel
              agents={agents}
              inspectAgent={inspectSidebarAgent}
              activeTab={effectiveSettingsTab}
              settingsRouteAgentId={settingsRouteAgentId}
              personalityHasUnsavedChanges={personalityHasUnsavedChanges}
              settingsHeaderModel={settingsHeaderModel}
              settingsHeaderThinking={settingsHeaderThinking}
              gatewayStatus={gatewayStatus}
              permissionsDraft={settingsAgentPermissionsDraft ?? undefined}
              canDelete={inspectSidebarAgent?.agentId !== RESERVED_MAIN_AGENT_ID}
              controlUiUrl={controlUiUrl}
              cronJobs={settingsMutationController.settingsCronJobs}
              cronLoading={settingsMutationController.settingsCronLoading}
              cronError={settingsMutationController.settingsCronError}
              cronCreateBusy={settingsMutationController.cronCreateBusy}
              cronRunBusyJobId={settingsMutationController.cronRunBusyJobId}
              cronDeleteBusyJobId={settingsMutationController.cronDeleteBusyJobId}
              onBackToChat={handleBackToChat}
              onTabChange={handleSettingsRouteTabChange}
              onUnsavedChangesChange={setPersonalityHasUnsavedChanges}
              onAvatarChange={(agentId, value) => {
                settingsMutationController.handleUpdateAgentAvatar(
                  agentId,
                  value.avatarSource,
                  value.avatarSeed,
                  value.defaultAvatarIndex,
                  value.avatarUrl
                );
              }}
              onUpdatePermissions={(draft) => {
                if (!inspectSidebarAgent) return;
                settingsMutationController.handleUpdateAgentPermissions(
                  inspectSidebarAgent.agentId,
                  draft
                );
              }}
              onDelete={() => {
                if (!inspectSidebarAgent) return;
                settingsMutationController.handleDeleteAgent(inspectSidebarAgent.agentId);
              }}
              onCreateCronJob={(draft) => {
                if (!inspectSidebarAgent) return;
                settingsMutationController.handleCreateCronJob(inspectSidebarAgent.agentId, draft);
              }}
              onRunCronJob={(jobId) => {
                if (!inspectSidebarAgent) return;
                settingsMutationController.handleRunCronJob(inspectSidebarAgent.agentId, jobId);
              }}
              onDeleteCronJob={(jobId) => {
                if (!inspectSidebarAgent) return;
                settingsMutationController.handleDeleteCronJob(inspectSidebarAgent.agentId, jobId);
              }}
            />
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex min-h-0 flex-1 flex-row gap-4">
                {/* Agents Tab */}
                {activeTabs.includes("agents") ? (
                  <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
                    <FleetSidebar
                      agents={filteredAgents}
                      selectedAgentId={focusedAgent?.agentId ?? state.selectedAgentId}
                      filter={focusFilter}
                      onFilterChange={handleFocusFilterChange}
                      onCreateAgent={() => {
                        handleOpenCreateAgentModal();
                      }}
                      createDisabled={!gatewayConnected || createAgentBusy || state.loading}
                      createBusy={createAgentBusy}
                      onSelectAgent={(agentId) => {
                        handleFleetSelectAgent(agentId);
                        if (!activeTabs.includes("chat")) {
                          setActiveTabs((prev) => [...prev, "chat"]);
                        }
                      }}
                    />
                  </div>
                ) : null}

                {/* Chat Tab */}
                {activeTabs.includes("chat") ? (
                  <div
                    className="ui-panel ui-depth-workspace flex h-full min-h-0 flex-1 flex-col overflow-hidden"
                    data-testid="focused-agent-panel"
                  >
                    {focusedAgent ? (
                      <div className="flex h-full min-h-0 flex-1 flex-col">
                        <AgentChatPanel
                            agent={focusedAgent}
                            isSelected={false}
                            canSend={gatewayConnected}
                            models={gatewayModels}
                            stopBusy={stopBusyAgentId === focusedAgent.agentId}
                            stopDisabledReason={focusedAgentStopDisabledReason}
                            onLoadMoreHistory={() => loadMoreAgentHistory(focusedAgent.agentId)}
                            onOpenSettings={() => handleOpenAgentSettingsRoute(focusedAgent.agentId)}
                            onRename={(name) =>
                              settingsMutationController.handleRenameAgent(focusedAgent.agentId, name)
                            }
                            onNewSession={() => handleNewSession(focusedAgent.agentId)}
                            onModelChange={(value) =>
                              handleModelChange(focusedAgent.agentId, focusedAgent.sessionKey, value)
                            }
                            onThinkingChange={(value) =>
                              handleThinkingChange(focusedAgent.agentId, focusedAgent.sessionKey, value)
                            }
                            onToolCallingToggle={(enabled) =>
                              handleToolCallingToggle(focusedAgent.agentId, enabled)
                            }
                            onThinkingTracesToggle={(enabled) =>
                              handleThinkingTracesToggle(focusedAgent.agentId, enabled)
                            }
                            onDraftChange={(value) => handleDraftChange(focusedAgent.agentId, value)}
                            onSend={(message) =>
                              handleSend(focusedAgent.agentId, focusedAgent.sessionKey, message)
                            }
                            onRemoveQueuedMessage={(index) =>
                              removeQueuedMessage(focusedAgent.agentId, index)
                            }
                            onStopRun={() =>
                              handleStopRun(
                                focusedAgent.agentId,
                                focusedAgent.sessionKey,
                                focusedAgent.runId
                              )
                            }
                            onAvatarShuffle={() => handleAvatarShuffle(focusedAgent.agentId)}
                            pendingExecApprovals={focusedPendingExecApprovals}
                            onResolveExecApproval={(id, decision) => {
                              void handleResolveExecApproval(id, decision);
                            }}
                          />
                      </div>
                    ) : (
                      <EmptyStatePanel
                        title={hasAnyAgents ? "No agents match this filter." : "No agents available."}
                        description={
                          hasAnyAgents
                            ? undefined
                            : gatewayConnected
                              ? "Use New Agent in the sidebar to add your first agent."
                              : "Connect to your gateway to load agents into rocCLAW."
                        }
                        fillHeight
                        className="items-center p-6 text-center text-sm"
                      />
                    )}
                  </div>
                ) : null}

                {/* Connection Tab */}
                {activeTabs.includes("connection") ? (
                  <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
                    <ConnectionPage
                      savedGatewayUrl={gatewayUrl}
                      draftGatewayUrl={draftGatewayUrl}
                      token={token}
                      localGatewayDefaults={localGatewayDefaults}
                      localGatewayDefaultsHasToken={localGatewayDefaultsHasToken}
                      hasStoredToken={hasStoredToken}
                      hasUnsavedChanges={hasUnsavedChanges}
                      installContext={installContext}
                      status={gatewayStatus}
                      statusReason={statusReason}
                      error={gatewayError}
                      testResult={testResult}
                      saving={gatewaySaving}
                      testing={gatewayTesting}
                      disconnecting={gatewayDisconnecting}
                      onGatewayUrlChange={setGatewayUrl}
                      onTokenChange={setToken}
                      onUseLocalDefaults={useLocalGatewayDefaults}
                      onSaveSettings={() => void saveSettings()}
                      onTestConnection={() => void testConnection()}
                      onDisconnect={() => void disconnect()}
                      onClearError={clearGatewayError}
                      onConnect={() => void saveSettings()}
                    />
                  </div>
                ) : null}

                {/* System Tab — kept mounted so metrics data survives tab toggles */}
                <div className={`flex h-full min-h-0 flex-1 flex-col overflow-hidden ${activeTabs.includes("system") ? "" : "hidden"}`}>
                  <SystemMetricsDashboard />
                </div>

                {/* Graph Tab — kept mounted so history data survives tab toggles */}
                <div className={`flex h-full min-h-0 flex-1 flex-col overflow-hidden ${activeTabs.includes("graph") ? "" : "hidden"}`}>
                  <SystemGraphView />
                </div>

                {/* Tasks Tab */}
                {activeTabs.includes("tasks") ? (
                  <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
                    <TasksDashboard />
                  </div>
                ) : null}

                {/* Tokens Tab — kept mounted so usage data survives tab toggles */}
                <div className={`flex h-full min-h-0 flex-1 flex-col overflow-hidden ${activeTabs.includes("tokens") ? "" : "hidden"}`}>
                  <TokenUsageDashboard />
                </div>

                {/* Settings Tab */}
                {activeTabs.includes("settings") ? (
                  <div className="ui-panel ui-depth-workspace flex h-full min-h-0 flex-1 flex-col overflow-hidden">
                    <SettingsPanel />
                  </div>
                ) : null}
              </div>
            </div>
          )}
            </>
          )}
        </main>
        <FooterBar status={gatewayStatus} gatewayVersion={installContext?.localGateway?.runtimeVersion} onConnectionSettings={() => {
          setActiveTabs((current) => {
            // Toggle connection tab — remove exclusive tabs if present
            const exclusiveTabs: TabId[] = ["tasks", "skills"];
            if (current.includes("connection")) {
              const next = current.filter((t) => t !== "connection");
              return next.length === 0 ? getDefaultActiveTabs() : next;
            }
            return [...current.filter((t) => !exclusiveTabs.includes(t as TabId)), "connection"];
          });
        }} />
      </div>
      {createAgentModalOpen ? (
        <AgentCreateModal
          open={createAgentModalOpen}
          suggestedName={suggestedCreateAgentName}
          busy={createAgentBusy}
          submitError={createAgentModalError}
          onClose={() => {
            if (createAgentBusy) return;
            setCreateAgentModalError(null);
            setCreateAgentModalOpen(false);
          }}
          onSubmit={(payload) => {
            void handleCreateAgentSubmit(payload);
          }}
        />
      ) : null}
      {createAgentBlock ? (
        <CreateAgentBlockModal block={createAgentBlock} statusLine={createBlockStatusLine} />
      ) : null}
      {restartingMutationBlock && restartingMutationBlock.phase !== "queued" ? (
        <RestartingMutationBlockModal
          kind={restartingMutationBlock.kind}
          agentName={restartingMutationBlock.agentName}
          statusLine={restartingMutationStatusLine}
        />
      ) : null}
    </div>
  );
};
export default function Home() {
  return (
    <Suspense>
      <AgentStoreProvider>
        <AgentROCclawPage />
      </AgentStoreProvider>
    </Suspense>
  );
}
