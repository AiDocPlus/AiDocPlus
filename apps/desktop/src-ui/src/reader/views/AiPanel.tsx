// ── AI 阅读助手面板 ──

import { useState, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useReaderStore, type AiChatMessage } from '../useReaderStore';
import { S } from '../styles';
import { useTranslation } from '@/i18n';
import { MarkdownPreview } from '@/components/editor/MarkdownPreview';

let msgIdCounter = 0;
const nextMsgId = () => `ai-${Date.now()}-${++msgIdCounter}`;

export function AiPanel() {
  const { t } = useTranslation();
  const activeTabId = useReaderStore(s => s.activeTabId);
  const tabs = useReaderStore(s => s.tabs);
  const activeTab = tabs.find(tb => tb.id === activeTabId);
  const filename = activeTab?.book.filename;

  const aiChatHistory = useReaderStore(s => s.aiChatHistory);
  const addAiChatMessage = useReaderStore(s => s.addAiChatMessage);
  const clearAiChatHistory = useReaderStore(s => s.clearAiChatHistory);

  const messages = filename ? (aiChatHistory[filename] ?? []) : [];
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef(input);
  inputRef.current = input;

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }));
  }, []);

  const contextText = activeTab
    ? `${t('reader.aiReadingNow', { defaultValue: 'Currently reading' })}: "${activeTab.book.display_name || activeTab.book.original_name}" (${activeTab.book.format})`
    : undefined;

  const sendMessage = useCallback(async (text?: string) => {
    const content = (text || inputRef.current).trim();
    if (!content || thinking || !filename) return;

    const userMsg: AiChatMessage = { id: nextMsgId(), role: 'user', content, createdAt: new Date().toISOString() };
    addAiChatMessage(filename, userMsg);
    setInput('');
    setThinking(true);
    scrollToBottom();

    try {
      const history: Array<{ role: string; content: string }> = [];
      // 注入 system prompt 作为 messages 的第一条（与主程序 useAppStore 一致）
      history.push({
        role: 'system',
        content: t('reader.aiSystemPrompt', { defaultValue: 'You are a professional reading assistant. Help users understand book content, generate reading notes, and summarize key points. Reply in the user\'s language.' }),
      });
      if (contextText) {
        history.push({
          role: 'user',
          content: `${t('reader.aiContextHint', { defaultValue: 'Here is the current book info for reference' })}:\n\n${contextText}\n\n${t('reader.aiContextSuffix', { defaultValue: 'Please help me based on the above info.' })}`,
        });
        history.push({ role: 'assistant', content: t('reader.aiContextAck', { defaultValue: 'Understood, I have the book context. How can I help you?' }) });
      }

      // 从 store 获取最新消息
      const latestMessages = useReaderStore.getState().aiChatHistory[filename] ?? [];
      history.push(...latestMessages.map(m => ({ role: m.role, content: m.content })));

      const reply = await invoke<string>('chat_stream', { messages: history });

      addAiChatMessage(filename, {
        id: nextMsgId(),
        role: 'assistant',
        content: reply || t('reader.aiNoReply', { defaultValue: '(No reply)' }),
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      addAiChatMessage(filename, {
        id: nextMsgId(),
        role: 'assistant',
        content: `${t('reader.aiCallFailed', { defaultValue: 'Call failed' })}: ${err instanceof Error ? err.message : String(err)}`,
        createdAt: new Date().toISOString(),
      });
    } finally {
      setThinking(false);
      scrollToBottom();
    }
  }, [thinking, filename, contextText, scrollToBottom, t, addAiChatMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const quickPrompts = [
    t('reader.aiQuick1', { defaultValue: 'Summarize the core content' }),
    t('reader.aiQuick2', { defaultValue: 'Explain key concepts' }),
    t('reader.aiQuick3', { defaultValue: 'Generate reading notes' }),
    t('reader.aiQuick4', { defaultValue: 'Who is this book for?' }),
    t('reader.aiQuick5', { defaultValue: 'Recommend similar books' }),
  ];

  return (
    <div style={{
      ...S.scrollContainer,
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
    }}>
      {/* 快捷提示 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, padding: '6px 10px', borderBottom: `1px solid ${S.colors.borderLight}` }}>
        {quickPrompts.map(p => (
          <button
            key={p}
            onClick={() => sendMessage(p)}
            style={{
              padding: '3px 9px',
              background: S.colors.primaryLight,
              border: `1px solid ${S.colors.borderMain}`,
              borderRadius: 12,
              fontSize: 12,
              cursor: 'pointer',
              color: S.colors.primaryText,
            }}
          >
            {p}
          </button>
        ))}
      </div>

      {/* 消息列表 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {messages.length === 0 && !thinking ? (
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', color: S.colors.textPlaceholder, gap: 8, padding: 16,
          }}>
            <span style={{ fontSize: 13, textAlign: 'center' }}>
              {t('reader.aiEmptyHint1', { defaultValue: 'AI assistant can help you summarize content, explain concepts, and generate notes.' })}<br />
              {t('reader.aiEmptyHint2', { defaultValue: 'Click a quick prompt above or type your question.' })}
            </span>
          </div>
        ) : (
          messages.map(m => {
            const isUser = m.role === 'user';
            return (
              <div key={m.id} style={{
                maxWidth: '88%', padding: '8px 12px',
                borderRadius: isUser ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                background: isUser ? S.colors.primary : S.colors.bgCard,
                color: isUser ? '#fff' : S.colors.textPrimary,
                alignSelf: isUser ? 'flex-end' : 'flex-start',
                fontSize: 14, lineHeight: 1.6,
                border: !isUser ? `1px solid ${S.colors.borderMain}` : 'none',
                boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
              }}>
                {isUser
                  ? m.content.split('\n').map((line, i) => <span key={i}>{line}{i < m.content.split('\n').length - 1 && <br />}</span>)
                  : <MarkdownPreview content={m.content} />
                }
              </div>
            );
          })
        )}
        {thinking && (
          <div style={{
            fontSize: 13, color: S.colors.textPlaceholder,
            padding: '4px 12px', background: S.colors.bgAlt, borderRadius: 8,
            alignSelf: 'flex-start', border: `1px solid ${S.colors.borderMain}`,
          }}>
            {t('reader.aiThinking', { defaultValue: 'AI is thinking...' })}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 输入区 */}
      <div style={{ padding: '8px 10px', borderTop: `1px solid ${S.colors.borderMain}`, background: S.colors.bgCard }}>
        <textarea
          style={{
            width: '100%', padding: '7px 10px',
            border: `1px solid ${S.colors.borderMain}`, borderRadius: 6,
            fontSize: 14, outline: 'none', resize: 'none' as const, boxSizing: 'border-box' as const,
            minHeight: 60, fontFamily: 'inherit',
          }}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('reader.aiPlaceholder', { defaultValue: 'Type a question, Shift+Enter for new line, Enter to send...' })}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6, gap: 6 }}>
          {messages.length > 0 && (
            <button style={S.btn({ small: true })} onClick={() => filename && clearAiChatHistory(filename)}>{t('reader.aiClear', { defaultValue: 'Clear' })}</button>
          )}
          <button
            style={S.btn({ primary: true, small: true })}
            onClick={() => sendMessage()}
            disabled={!input.trim() || thinking}
          >
            {t('reader.aiSend', { defaultValue: 'Send' })}
          </button>
        </div>
      </div>
    </div>
  );
}
