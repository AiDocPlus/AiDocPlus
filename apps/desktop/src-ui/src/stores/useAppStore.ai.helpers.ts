import type { AIMessage } from '@aidocplus/shared-types';

export interface StreamState {
  unlistenFn: (() => void) | null;
  aborted: boolean;
  sessionId: number;
  requestId: string | null;
}

export function createDefaultStreamState(): StreamState {
  return {
    unlistenFn: null,
    aborted: false,
    sessionId: 0,
    requestId: null,
  };
}

export function getStreamState(
  streamStateByTab: Record<string, StreamState>,
  tabId: string,
): StreamState {
  return streamStateByTab[tabId] || createDefaultStreamState();
}

export function setAiMessagesForTab(
  aiMessagesByTab: Record<string, AIMessage[]>,
  tabId: string,
  messages: AIMessage[],
): Record<string, AIMessage[]> {
  return { ...aiMessagesByTab, [tabId]: messages };
}

export function appendAiMessageToTab(
  aiMessagesByTab: Record<string, AIMessage[]>,
  tabId: string,
  message: AIMessage,
): Record<string, AIMessage[]> {
  return {
    ...aiMessagesByTab,
    [tabId]: [...(aiMessagesByTab[tabId] || []), message],
  };
}

export function updateLastAiMessageInMap(
  aiMessagesByTab: Record<string, AIMessage[]>,
  tabId: string,
  fields: Partial<AIMessage>,
): Record<string, AIMessage[]> {
  const messages = aiMessagesByTab[tabId] || [];
  if (messages.length === 0) return aiMessagesByTab;

  const updated = [...messages];
  updated[updated.length - 1] = { ...updated[updated.length - 1], ...fields };
  return { ...aiMessagesByTab, [tabId]: updated };
}

export function clearAiMessagesForTab(
  aiMessagesByTab: Record<string, AIMessage[]>,
  tabId: string,
): Record<string, AIMessage[]> {
  return { ...aiMessagesByTab, [tabId]: [] };
}

export function removeAiMessagesTab(
  aiMessagesByTab: Record<string, AIMessage[]>,
  tabId: string,
): Record<string, AIMessage[]> {
  const nextAiMessagesByTab = { ...aiMessagesByTab };
  delete nextAiMessagesByTab[tabId];
  return nextAiMessagesByTab;
}

export function buildAiMessagesPatchState(
  aiMessagesByTab: Record<string, AIMessage[]>,
): { aiMessagesByTab: Record<string, AIMessage[]> } {
  return { aiMessagesByTab };
}

export function buildStreamStatePatchState(
  streamStateByTab: Record<string, StreamState>,
): { streamStateByTab: Record<string, StreamState> } {
  return { streamStateByTab };
}

export function startTabStreamState(
  streamStateByTab: Record<string, StreamState>,
  tabId: string,
  sessionId: number,
  requestId: string,
): Record<string, StreamState> {
  return {
    ...streamStateByTab,
    [tabId]: {
      unlistenFn: null,
      aborted: false,
      sessionId,
      requestId,
    },
  };
}

export function createNextTabStreamRequest(
  streamStateByTab: Record<string, StreamState>,
  tabId: string,
  requestPrefix: string,
  now = Date.now(),
): {
  sessionId: number;
  requestId: string;
  streamStateByTab: Record<string, StreamState>;
} {
  const current = getStreamState(streamStateByTab, tabId);
  const sessionId = current.sessionId + 1;
  const requestId = `${requestPrefix}_${now}_${sessionId}`;

  return {
    sessionId,
    requestId,
    streamStateByTab: startTabStreamState(streamStateByTab, tabId, sessionId, requestId),
  };
}

export function prepareNextTabStreamRequest(
  streamStateByTab: Record<string, StreamState>,
  tabId: string,
  requestPrefix: string,
  now = Date.now(),
): {
  sessionId: number;
  requestId: string;
  streamStateByTab: Record<string, StreamState>;
} {
  const current = getStreamState(streamStateByTab, tabId);
  current.unlistenFn?.();
  return createNextTabStreamRequest(streamStateByTab, tabId, requestPrefix, now);
}

export function isMatchingStreamChunk(
  streamState: StreamState | undefined,
  sessionId: number,
  requestId: string,
  incomingRequestId: string,
): boolean {
  return !!streamState && !streamState.aborted && streamState.sessionId === sessionId && incomingRequestId === requestId;
}

export function attachTabStreamListener(
  streamStateByTab: Record<string, StreamState>,
  tabId: string,
  unlistenFn: (() => void) | null,
): Record<string, StreamState> {
  return {
    ...streamStateByTab,
    [tabId]: {
      ...getStreamState(streamStateByTab, tabId),
      unlistenFn,
    },
  };
}

export function buildAttachedTabStreamListenerState(
  streamStateByTab: Record<string, StreamState>,
  tabId: string,
  unlistenFn: (() => void) | null,
): { streamStateByTab: Record<string, StreamState> } {
  return buildStreamStatePatchState(attachTabStreamListener(streamStateByTab, tabId, unlistenFn));
}

export function abortTabStreamState(
  streamStateByTab: Record<string, StreamState>,
  tabId: string,
): Record<string, StreamState> {
  const current = getStreamState(streamStateByTab, tabId);
  return {
    ...streamStateByTab,
    [tabId]: {
      unlistenFn: null,
      aborted: true,
      sessionId: current.sessionId + 1,
      requestId: null,
    },
  };
}

export function clearTabStreamRuntime(
  streamStateByTab: Record<string, StreamState>,
  tabId: string,
): Record<string, StreamState> {
  return {
    ...streamStateByTab,
    [tabId]: {
      ...getStreamState(streamStateByTab, tabId),
      unlistenFn: null,
      requestId: null,
    },
  };
}

export function buildClearedTabStreamRuntimeState(
  streamStateByTab: Record<string, StreamState>,
  tabId: string,
): { streamStateByTab: Record<string, StreamState> } {
  return buildStreamStatePatchState(clearTabStreamRuntime(streamStateByTab, tabId));
}

export function buildAiStreamingStartState(tabId?: string): {
  isAiStreaming: true;
  error: null;
  aiStreamingTabId?: string;
} {
  return tabId
    ? { isAiStreaming: true, aiStreamingTabId: tabId, error: null }
    : { isAiStreaming: true, error: null };
}

export function buildAiStreamingStopState(): {
  isAiStreaming: false;
  aiStreamingTabId: null;
} {
  return {
    isAiStreaming: false,
    aiStreamingTabId: null,
  };
}
