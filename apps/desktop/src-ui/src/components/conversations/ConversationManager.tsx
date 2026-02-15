import { useState } from 'react';
import { MessageSquare, Plus, Trash2, Edit2, Search, Pin, PinOff, Clock } from 'lucide-react';
import { useTranslation } from '@/i18n';
import { useConversationsStore } from '@/stores/useConversationsStore';
import { useAppStore } from '@/stores/useAppStore';
import { CONVERSATION_GROUPS } from '@aidocplus/shared-types';
import type { Conversation } from '@aidocplus/shared-types';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { ScrollArea } from '../ui/scroll-area';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { zhCN, enUS } from 'date-fns/locale';

interface ConversationManagerProps {
  open: boolean;
  onClose: () => void;
  onSelectConversation?: (conversationId: string) => void;
}

export function ConversationManager({ open, onClose, onSelectConversation }: ConversationManagerProps) {
  const { t } = useTranslation();
  const {
    searchQuery,
    setSearchQuery,
    getGroupedConversations,
    getCurrentConversation,
    deleteConversation,
    renameConversation,
    togglePinConversation
  } = useConversationsStore();

  const { currentDocument } = useAppStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const currentConversation = getCurrentConversation();

  const groupedConversations = getGroupedConversations();

  const handleDelete = (id: string) => {
    if (confirm(t('conversations.confirmDelete'))) {
      deleteConversation(id);
    }
  };

  const handleStartRename = (conversation: Conversation) => {
    setEditingId(conversation.id);
    setEditTitle(conversation.title);
  };

  const handleSaveRename = (id: string) => {
    if (editTitle.trim()) {
      renameConversation(id, editTitle.trim());
    }
    setEditingId(null);
    setEditTitle('');
  };

  const handleCancelRename = () => {
    setEditingId(null);
    setEditTitle('');
  };

  const handleSelect = (conversationId: string) => {
    if (onSelectConversation) {
      onSelectConversation(conversationId);
    }
    onClose();
  };

  const handleNewConversation = () => {
    if (currentDocument) {
      const newConv = useConversationsStore.getState().createConversation(currentDocument.id);
      handleSelect(newConv.id);
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const language = localStorage.getItem('aidocplus-language') || 'zh';
    const locale = language === 'en' ? enUS : zhCN;

    try {
      return format(new Date(timestamp * 1000), 'PPp', { locale });
    } catch {
      return new Date(timestamp * 1000).toLocaleString();
    }
  };

  const getGroupLabel = (group: string) => {
    switch (group) {
      case CONVERSATION_GROUPS.today:
        return t('conversations.today');
      case CONVERSATION_GROUPS.yesterday:
        return t('conversations.yesterday');
      case CONVERSATION_GROUPS.lastWeek:
        return t('conversations.lastWeek');
      case CONVERSATION_GROUPS.lastMonth:
        return t('conversations.lastMonth');
      case CONVERSATION_GROUPS.older:
        return t('conversations.older');
      default:
        return group;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <DialogTitle className="text-xl flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            {t('conversations.title')}
          </DialogTitle>
          <Button
            variant="default"
            size="sm"
            onClick={handleNewConversation}
            disabled={!currentDocument}
          >
            <Plus className="w-4 h-4 mr-2" />
            {t('conversations.newConversation')}
          </Button>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('conversations.search')}
            className="pl-9"
          />
        </div>

        {/* Conversations List */}
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-4">
            {!currentDocument && (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">{t('conversations.noDocumentSelected', { defaultValue: 'Please select a document first' })}</p>
              </div>
            )}

            {currentDocument && groupedConversations.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">{t('conversations.noConversations')}</p>
              </div>
            )}

            {groupedConversations.map((group) => (
              <div key={group.label}>
                <h3 className="text-xs font-medium text-muted-foreground px-2 mb-2">
                  {getGroupLabel(group.label)}
                </h3>
                <div className="space-y-1">
                  {group.conversations.map((conversation) => {
                    const isEditing = editingId === conversation.id;
                    const isSelected = currentConversation?.id === conversation.id;

                    return (
                      <div
                        key={conversation.id}
                        className={cn(
                          "group flex items-center gap-2 p-3 rounded-lg hover:bg-accent transition-colors",
                          isSelected && "bg-accent"
                        )}
                      >
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 flex-shrink-0"
                          onClick={() => handleSelect(conversation.id)}
                        >
                          <MessageSquare className="w-4 h-4" />
                        </Button>

                        <div
                          className="flex-1 min-w-0 cursor-pointer"
                          onClick={() => !isEditing && handleSelect(conversation.id)}
                        >
                          {isEditing ? (
                            <Input
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              onBlur={() => handleSaveRename(conversation.id)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveRename(conversation.id);
                                if (e.key === 'Escape') handleCancelRename();
                              }}
                              className="h-6 text-sm"
                              autoFocus
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <>
                              <div className="flex items-center gap-2">
                                {conversation.isPinned && (
                                  <Pin className="w-3 h-3 text-primary" />
                                )}
                                <p className="text-sm font-medium truncate">
                                  {conversation.title}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Clock className="w-3 h-3" />
                                <span>{formatTimestamp(conversation.updatedAt)}</span>
                                <span>•</span>
                                <span>{conversation.messages.length} {t('conversations.messages', { defaultValue: 'messages' })}</span>
                              </div>
                            </>
                          )}
                        </div>

                        {!isEditing && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => togglePinConversation(conversation.id)}
                              title={conversation.isPinned ? t('conversations.unpin') : t('conversations.pin')}
                            >
                              {conversation.isPinned ? (
                                <PinOff className="w-3 h-3" />
                              ) : (
                                <Pin className="w-3 h-3" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleStartRename(conversation)}
                              title={t('common.rename', { defaultValue: '重命名' })}
                            >
                              <Edit2 className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive"
                              onClick={() => handleDelete(conversation.id)}
                              title={t('common.delete')}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="border-t p-4 flex justify-end">
          <Button variant="outline" onClick={onClose}>
            {t('common.close')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ConversationManager;
