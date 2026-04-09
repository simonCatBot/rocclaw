// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { GatewayStatus } from "@/lib/gateway/gateway-status";
import { readDomainAgentFile, writeDomainAgentFile } from "@/lib/controlplane/domain-runtime-client";
import {
  AGENT_FILE_NAMES,
  type AgentFileName,
  createAgentFilesState,
  isAgentFileName,
} from "@/lib/agents/agentFiles";

type AgentFilesState = ReturnType<typeof createAgentFilesState>;

export type UseAgentFilesEditorResult = {
  agentFiles: AgentFilesState;
  agentFilesLoading: boolean;
  agentFilesSaving: boolean;
  agentFilesDirty: boolean;
  agentFilesError: string | null;
  setAgentFileContent: (name: AgentFileName, value: string) => void;
  saveAgentFiles: () => Promise<boolean>;
  discardAgentFileChanges: () => void;
};

export const useAgentFilesEditor = (params: {
  agentId: string | null | undefined;
  gatewayStatus: GatewayStatus;
}): UseAgentFilesEditorResult => {
  const { agentId, gatewayStatus } = params;
  const [agentFiles, setAgentFiles] = useState(createAgentFilesState);
  const [agentFilesLoading, setAgentFilesLoading] = useState(false);
  const [agentFilesSaving, setAgentFilesSaving] = useState(false);
  const [agentFilesDirty, setAgentFilesDirty] = useState(false);
  const [agentFilesError, setAgentFilesError] = useState<string | null>(null);
  const savedAgentFilesRef = useRef<AgentFilesState>(createAgentFilesState());

  const cloneAgentFilesState = useCallback((source: AgentFilesState): AgentFilesState => {
    const next = createAgentFilesState();
    for (const name of AGENT_FILE_NAMES) {
      next[name] = { ...source[name] };
    }
    return next;
  }, []);

  const loadAgentFiles = useCallback(async () => {
    setAgentFilesLoading(true);
    setAgentFilesError(null);
    try {
      const trimmedAgentId = agentId?.trim();
      if (!trimmedAgentId) {
        const emptyState = createAgentFilesState();
        savedAgentFilesRef.current = emptyState;
        setAgentFiles(emptyState);
        setAgentFilesDirty(false);
        setAgentFilesError("Agent ID is missing for this agent.");
        return;
      }
      if (gatewayStatus !== "connected") {
        if (gatewayStatus === "connecting") {
          setAgentFilesError(null);
        } else {
          setAgentFilesError("Gateway is not connected.");
        }
        return;
      }
      const results = await Promise.all(
        AGENT_FILE_NAMES.map(async (name) => {
          const file = await readDomainAgentFile({ agentId: trimmedAgentId, name });
          return { name, content: file.content, exists: file.exists };
        })
      );
      const nextState = createAgentFilesState();
      for (const file of results) {
        if (!isAgentFileName(file.name)) continue;
        nextState[file.name] = {
          content: file.content ?? "",
          exists: Boolean(file.exists),
        };
      }
      savedAgentFilesRef.current = nextState;
      setAgentFiles(nextState);
      setAgentFilesDirty(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load agent files.";
      setAgentFilesError(message);
    } finally {
      setAgentFilesLoading(false);
    }
  }, [agentId, gatewayStatus]);

  const saveAgentFiles = useCallback(async () => {
    setAgentFilesSaving(true);
    setAgentFilesError(null);
    try {
      const trimmedAgentId = agentId?.trim();
      if (!trimmedAgentId) {
        setAgentFilesError("Agent ID is missing for this agent.");
        return false;
      }
      if (gatewayStatus !== "connected") {
        setAgentFilesError("Gateway is not connected.");
        return false;
      }
      await Promise.all(
        AGENT_FILE_NAMES.map(async (name) => {
          await writeDomainAgentFile({
            agentId: trimmedAgentId,
            name,
            content: agentFiles[name].content,
          });
        })
      );
      const nextState = createAgentFilesState();
      for (const name of AGENT_FILE_NAMES) {
        nextState[name] = {
          content: agentFiles[name].content,
          exists: true,
        };
      }
      savedAgentFilesRef.current = nextState;
      setAgentFiles(nextState);
      setAgentFilesDirty(false);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save agent files.";
      setAgentFilesError(message);
      return false;
    } finally {
      setAgentFilesSaving(false);
    }
  }, [agentFiles, agentId, gatewayStatus]);

  const setAgentFileContent = useCallback((name: AgentFileName, value: string) => {
    if (!isAgentFileName(name)) return;
    setAgentFiles((prev) => ({
      ...prev,
      [name]: { ...prev[name], content: value },
    }));
    setAgentFilesDirty(true);
  }, []);

  const discardAgentFileChanges = useCallback(() => {
    setAgentFiles(cloneAgentFilesState(savedAgentFilesRef.current));
    setAgentFilesDirty(false);
    setAgentFilesError(null);
  }, [cloneAgentFilesState]);

  useEffect(() => {
    void loadAgentFiles();
  }, [loadAgentFiles]);

  return {
    agentFiles,
    agentFilesLoading,
    agentFilesSaving,
    agentFilesDirty,
    agentFilesError,
    setAgentFileContent,
    saveAgentFiles,
    discardAgentFileChanges,
  };
};
