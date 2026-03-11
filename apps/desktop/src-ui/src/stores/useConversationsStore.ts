import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { Conversation, ConversationGroup, AIMessage } from '@aidocplus/shared-types';
import { CONVERSATION_GROUPS } from '@aidocplus/shared-types';

interface ConversationsState {
  conversations: Conversation[];
  currentConversationId: string | null;
  searchQuery: string;
  _loaded: boolean;

  // Actions
  setConversations: (conversations: Conversation[]) => void;
  setCurrentConversation: (id: string | null) => void;
  setSearchQuery: (query: string) => void;

  // CRUD operations
  createConversation: (documentId: string, firstMessage?: AIMessage) => Conversation;
  updateConversation: (id: string, updates: Partial<Conversation>) => void;
  deleteConversation: (id: string) => void;
  addMessageToConversation: (conversationId: string, message: AIMessage) => void;
  renameConversation: (id: string, newTitle: string) => void;
  togglePinConversation: (id: string) => void;

  // Getters
  getCurrentConversation: () => Conversation | undefined;
  getConversationsByDocument: (documentId: string) => Conversation[];
  getGroupedConversations: () => ConversationGroup[];
  getFilteredConversations: () => Conversation[];
}

const generateConversationId = () => `conv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const getConversationGroup = (timestamp: number): 'today' | 'yesterday' | 'lastWeek' | 'lastMonth' | 'older' => {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return CONVERSATION_GROUPS.today;
  if (diffDays === 1) return CONVERSATION_GROUPS.yesterday;
  if (diffDays < 7) return CONVERSATION_GROUPS.lastWeek;
  if (diffDays < 30) return CONVERSATION_GROUPS.lastMonth;
  return CONVERSATION_GROUPS.older;
};

const generateConversationTitle = (messages: AIMessage[]): string => {
  if (messages.length === 0) return 'New Conversation';

  // Use first user message as title
  const firstUserMessage = messages.find(m => m.role === 'user');
  if (firstUserMessage) {
    const title = firstUserMessage.content.slice(0, 50);
    return title.length < firstUserMessage.content.length ? `${title}...` : title;
  }

  return 'New Conversation';
};

export const useConversationsStore = create<ConversationsState>()(
  (set, get) => ({
    conversations: [],
    currentConversationId: null,
    searchQuery: '',
    _loaded: false,

    setConversations: (conversations) => set({ conversations }),

    setCurrentConversation: (id) => set({ currentConversationId: id }),

    setSearchQuery: (query) => set({ searchQuery: query }),

    createConversation: (documentId, firstMessage) => {
      const newConversation: Conversation = {
        id: generateConversationId(),
        documentId,
        title: 'New Conversation',
        messages: firstMessage ? [firstMessage] : [],
        createdAt: Date.now() / 1000,
        updatedAt: Date.now() / 1000,
        isPinned: false
      };

      set((state) => ({
        conversations: [newConversation, ...state.conversations],
        currentConversationId: newConversation.id
      }));

      // 异步持久化到 SQLite
      invoke('db_create_conversation', {
        id: newConversation.id,
        documentId,
        title: newConversation.title,
        createdAt: newConversation.createdAt
      }).catch(e => console.error('[conversations] 创建对话失败:', e));

      if (firstMessage) {
        invoke('db_add_message', {
          conversationId: newConversation.id,
          role: firstMessage.role,
          content: firstMessage.content,
          timestamp: firstMessage.timestamp ?? null,
          contextMode: firstMessage.contextMode ?? null
        }).catch(e => console.error('[conversations] 添加消息失败:', e));
      }

      return newConversation;
    },

    updateConversation: (id, updates) => {
      set((state) => ({
        conversations: state.conversations.map(c =>
          c.id === id
            ? { ...c, ...updates, updatedAt: Date.now() / 1000 }
            : c
        )
      }));

      // 如果更新了标题，同步到 SQLite
      if (updates.title !== undefined) {
        invoke('db_rename_conversation', {
          conversationId: id,
          title: updates.title
        }).catch(e => console.error('[conversations] 重命名对话失败:', e));
      }
    },

    deleteConversation: (id) => {
      set((state) => ({
        conversations: state.conversations.filter(c => c.id !== id),
        currentConversationId: state.currentConversationId === id ? null : state.currentConversationId
      }));

      invoke('db_delete_conversation', { conversationId: id })
        .catch(e => console.error('[conversations] 删除对话失败:', e));
    },

    addMessageToConversation: (conversationId, message) => {
      let newTitle: string | null = null;

      set((state) => ({
        conversations: state.conversations.map(c => {
          if (c.id === conversationId) {
            const updatedMessages = [...c.messages, message];
            const title = c.title === 'New Conversation' ? generateConversationTitle(updatedMessages) : c.title;
            if (title !== c.title) newTitle = title;
            return {
              ...c,
              messages: updatedMessages,
              title,
              updatedAt: Date.now() / 1000
            };
          }
          return c;
        })
      }));

      // 异步持久化消息到 SQLite
      invoke('db_add_message', {
        conversationId,
        role: message.role,
        content: message.content,
        timestamp: message.timestamp ?? null,
        contextMode: message.contextMode ?? null
      }).catch(e => console.error('[conversations] 添加消息失败:', e));

      // 如果标题更新了，同步到 SQLite
      if (newTitle) {
        invoke('db_rename_conversation', {
          conversationId,
          title: newTitle
        }).catch(e => console.error('[conversations] 更新标题失败:', e));
      }
    },

    renameConversation: (id, newTitle) => {
      get().updateConversation(id, { title: newTitle });
    },

    togglePinConversation: (id) => {
      const conv = get().conversations.find(c => c.id === id);
      const newPinned = conv ? !conv.isPinned : false;

      set((state) => ({
        conversations: state.conversations.map(c =>
          c.id === id
            ? { ...c, isPinned: !c.isPinned }
            : c
        ).sort((a, b) => {
          // Pinned conversations first
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          // Then by updated time (most recent first)
          return b.updatedAt - a.updatedAt;
        })
      }));

      invoke('db_pin_conversation', { conversationId: id, pinned: newPinned })
        .catch(e => console.error('[conversations] 切换置顶失败:', e));
    },

    getCurrentConversation: () => {
      const { conversations, currentConversationId } = get();
      return conversations.find(c => c.id === currentConversationId);
    },

    getConversationsByDocument: (documentId) => {
      return get().conversations.filter(c => c.documentId === documentId);
    },

    getGroupedConversations: () => {
      const { conversations, searchQuery } = get();
      const filtered = searchQuery.trim()
        ? conversations.filter(c =>
            c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.messages.some(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
          )
        : conversations;

      const groups: Record<string, Conversation[]> = {};

      filtered.forEach(conversation => {
        const group = getConversationGroup(conversation.updatedAt * 1000);
        if (!groups[group]) {
          groups[group] = [];
        }
        groups[group].push(conversation);
      });

      // Convert to array and sort within groups
      const result: ConversationGroup[] = Object.entries(groups).map(([label, conversations]) => ({
        label,
        conversations: conversations.sort((a, b) => b.updatedAt - a.updatedAt)
      }));

      // Sort groups by predefined order
      const groupOrder: Array<'today' | 'yesterday' | 'lastWeek' | 'lastMonth' | 'older'> = [
        CONVERSATION_GROUPS.today,
        CONVERSATION_GROUPS.yesterday,
        CONVERSATION_GROUPS.lastWeek,
        CONVERSATION_GROUPS.lastMonth,
        CONVERSATION_GROUPS.older
      ];

      result.sort((a, b) => {
        return groupOrder.indexOf(a.label as any) - groupOrder.indexOf(b.label as any);
      });

      return result;
    },

    getFilteredConversations: () => {
      const { conversations, searchQuery } = get();
      if (!searchQuery.trim()) {
        return conversations;
      }
      return conversations.filter(c =>
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.messages.some(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }
  })
);

/**
 * 从 SQLite 加载所有对话到内存（应用启动时调用一次）
 */
export async function loadConversationsFromDB(): Promise<void> {
  if (useConversationsStore.getState()._loaded) return;
  try {
    const convs = await invoke<Conversation[]>('load_all_conversations');
    useConversationsStore.setState({
      conversations: convs ?? [],
      _loaded: true
    });
  } catch (e) {
    console.error('[conversations] 从 SQLite 加载对话失败:', e);
    // 回退：尝试从旧的 JSON 命令加载
    try {
      const json = await invoke<string | null>('load_conversations');
      if (json) {
        const parsed = JSON.parse(json);
        const state = parsed?.state;
        if (state?.conversations) {
          useConversationsStore.setState({
            conversations: state.conversations,
            currentConversationId: state.currentConversationId ?? null,
            _loaded: true
          });
        }
      }
    } catch {
      // 静默失败
    }
  }
}

// Helper to auto-create conversations when sending messages
export function ensureConversationExists(documentId: string, _messages: AIMessage[]): string {
  const { conversations, currentConversationId, createConversation } = useConversationsStore.getState();

  // If there's a current conversation for this document, use it
  if (currentConversationId) {
    const current = conversations.find(c => c.id === currentConversationId);
    if (current && current.documentId === documentId) {
      return current.id;
    }
  }

  // Check for any existing conversation for this document
  const existingConv = conversations.find(c => c.documentId === documentId);
  if (existingConv) {
    useConversationsStore.setState({ currentConversationId: existingConv.id });
    return existingConv.id;
  }

  // Create new conversation
  const newConv = createConversation(documentId);
  return newConv.id;
}
