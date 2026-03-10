import type { Conversation, ConversationGroup, AIMessage } from '@aidocplus/shared-types';
import { CONVERSATION_GROUPS } from '@aidocplus/shared-types';
import { createTauriBackedStorageAdapter, type SettingsStorageAdapter } from './useSettingsStore.helpers';

export type ConversationStorageAdapter = SettingsStorageAdapter;

export const tauriConversationsStorage: ConversationStorageAdapter = createTauriBackedStorageAdapter({
  loadCommand: 'load_conversations',
  saveCommand: 'save_conversations',
  clearValue: '{}',
});

export function generateConversationId(now = Date.now(), random = Math.random()): string {
  return `conv-${now}-${random.toString(36).slice(2, 11)}`;
}

export function getConversationGroup(
  timestamp: number,
): 'today' | 'yesterday' | 'lastWeek' | 'lastMonth' | 'older' {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return CONVERSATION_GROUPS.today;
  if (diffDays === 1) return CONVERSATION_GROUPS.yesterday;
  if (diffDays < 7) return CONVERSATION_GROUPS.lastWeek;
  if (diffDays < 30) return CONVERSATION_GROUPS.lastMonth;
  return CONVERSATION_GROUPS.older;
}

export function generateConversationTitle(messages: AIMessage[]): string {
  if (messages.length === 0) return 'New Conversation';

  const firstUserMessage = messages.find(message => message.role === 'user');
  if (firstUserMessage) {
    const title = firstUserMessage.content.slice(0, 50);
    return title.length < firstUserMessage.content.length ? `${title}...` : title;
  }

  return 'New Conversation';
}

export function createConversationRecord(
  documentId: string,
  firstMessage?: AIMessage,
  now = Date.now(),
): Conversation {
  const timestamp = now / 1000;
  return {
    id: generateConversationId(now),
    documentId,
    title: 'New Conversation',
    messages: firstMessage ? [firstMessage] : [],
    createdAt: timestamp,
    updatedAt: timestamp,
    isPinned: false,
  };
}

export function buildConversationsPatchState(
  conversations: Conversation[],
): { conversations: Conversation[] } {
  return { conversations };
}

export function createConversationState(
  conversations: Conversation[],
  documentId: string,
  firstMessage?: AIMessage,
  now = Date.now(),
): {
  conversation: Conversation;
  conversations: Conversation[];
  currentConversationId: string;
} {
  const conversation = createConversationRecord(documentId, firstMessage, now);
  return {
    conversation,
    conversations: [conversation, ...conversations],
    currentConversationId: conversation.id,
  };
}

export function updateConversationInList(
  conversations: Conversation[],
  id: string,
  updates: Partial<Conversation>,
  now = Date.now(),
): Conversation[] {
  return conversations.map(conversation =>
    conversation.id === id
      ? { ...conversation, ...updates, updatedAt: now / 1000 }
      : conversation,
  );
}

export function removeConversationFromList(conversations: Conversation[], id: string): Conversation[] {
  return conversations.filter(conversation => conversation.id !== id);
}

export function deleteConversationState(
  conversations: Conversation[],
  currentConversationId: string | null,
  id: string,
): {
  conversations: Conversation[];
  currentConversationId: string | null;
} {
  return {
    conversations: removeConversationFromList(conversations, id),
    currentConversationId: currentConversationId === id ? null : currentConversationId,
  };
}

export function appendMessageToConversationList(
  conversations: Conversation[],
  conversationId: string,
  message: AIMessage,
  now = Date.now(),
): Conversation[] {
  return conversations.map(conversation => {
    if (conversation.id !== conversationId) return conversation;
    const updatedMessages = [...conversation.messages, message];
    return {
      ...conversation,
      messages: updatedMessages,
      title: conversation.title === 'New Conversation' ? generateConversationTitle(updatedMessages) : conversation.title,
      updatedAt: now / 1000,
    };
  });
}

export function sortConversationsWithPinnedFirst(conversations: Conversation[]): Conversation[] {
  return [...conversations].sort((left, right) => {
    if (left.isPinned && !right.isPinned) return -1;
    if (!left.isPinned && right.isPinned) return 1;
    return right.updatedAt - left.updatedAt;
  });
}

export function togglePinnedConversationInList(conversations: Conversation[], id: string): Conversation[] {
  return sortConversationsWithPinnedFirst(
    conversations.map(conversation =>
      conversation.id === id ? { ...conversation, isPinned: !conversation.isPinned } : conversation,
    ),
  );
}

export function filterConversations(conversations: Conversation[], searchQuery: string): Conversation[] {
  const normalizedQuery = searchQuery.trim().toLowerCase();
  if (!normalizedQuery) {
    return conversations;
  }
  return conversations.filter(conversation =>
    conversation.title.toLowerCase().includes(normalizedQuery)
    || conversation.messages.some(message => message.content.toLowerCase().includes(normalizedQuery)),
  );
}

export function groupConversations(conversations: Conversation[], searchQuery: string): ConversationGroup[] {
  const filtered = filterConversations(conversations, searchQuery);
  const groups: Record<string, Conversation[]> = {};

  filtered.forEach(conversation => {
    const group = getConversationGroup(conversation.updatedAt * 1000);
    if (!groups[group]) {
      groups[group] = [];
    }
    groups[group].push(conversation);
  });

  const result: ConversationGroup[] = Object.entries(groups).map(([label, groupedConversations]) => ({
    label,
    conversations: [...groupedConversations].sort((left, right) => right.updatedAt - left.updatedAt),
  }));

  const groupOrder: Array<'today' | 'yesterday' | 'lastWeek' | 'lastMonth' | 'older'> = [
    CONVERSATION_GROUPS.today,
    CONVERSATION_GROUPS.yesterday,
    CONVERSATION_GROUPS.lastWeek,
    CONVERSATION_GROUPS.lastMonth,
    CONVERSATION_GROUPS.older,
  ];

  result.sort((left, right) => groupOrder.indexOf(left.label as 'today') - groupOrder.indexOf(right.label as 'today'));
  return result;
}

export function findConversationById(
  conversations: Conversation[],
  conversationId: string | null,
): Conversation | undefined {
  if (!conversationId) {
    return undefined;
  }
  return conversations.find(conversation => conversation.id === conversationId);
}

export function filterConversationsByDocument(
  conversations: Conversation[],
  documentId: string,
): Conversation[] {
  return conversations.filter(conversation => conversation.documentId === documentId);
}

export function findConversationForDocument(
  conversations: Conversation[],
  documentId: string,
  currentConversationId: string | null,
): Conversation | undefined {
  const currentConversation = findConversationById(conversations, currentConversationId);
  if (currentConversation && currentConversation.documentId === documentId) {
    return currentConversation;
  }

  return filterConversationsByDocument(conversations, documentId)[0];
}
