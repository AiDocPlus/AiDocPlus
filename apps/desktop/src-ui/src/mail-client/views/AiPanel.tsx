// ── AI 助手面板（Phase 3） ──

import { useState, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

const S = {
  root: { display: 'flex', flexDirection: 'column' as const, height: '100%', background: '#fafafa', borderLeft: '1px solid #e2e8f0', fontFamily: '宋体, SimSun, serif', fontSize: 16 },
  header: { padding: '10px 12px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff' },
  headerTitle: { fontSize: 14, fontWeight: 600, color: '#1e293b' },
  messages: { flex: 1, overflowY: 'auto' as const, padding: '8px 10px', display: 'flex', flexDirection: 'column' as const, gap: 8 },
  bubble: (role: 'user' | 'assistant'): React.CSSProperties => ({
    maxWidth: '88%', padding: '8px 12px', borderRadius: role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
    background: role === 'user' ? '#3b82f6' : '#fff',
    color: role === 'user' ? '#fff' : '#1e293b',
    alignSelf: role === 'user' ? 'flex-end' : 'flex-start',
    fontSize: 14, lineHeight: 1.6,
    border: role === 'assistant' ? '1px solid #e2e8f0' : 'none',
    boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
  }),
  inputArea: { padding: '8px 10px', borderTop: '1px solid #e2e8f0', background: '#fff' },
  textarea: { width: '100%', padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 14, fontFamily: '宋体, SimSun, serif', outline: 'none', resize: 'none' as const, boxSizing: 'border-box' as const, minHeight: 60 },
  sendRow: { display: 'flex', justifyContent: 'flex-end', marginTop: 6, gap: 6 },
  btn: (primary?: boolean): React.CSSProperties => ({
    padding: '5px 14px', borderRadius: 4, border: primary ? 'none' : '1px solid #e2e8f0',
    cursor: 'pointer', fontSize: 13, fontFamily: '宋体, SimSun, serif',
    background: primary ? '#3b82f6' : '#f8fafc', color: primary ? '#fff' : '#334155',
  }),
  quickPrompts: { display: 'flex', flexWrap: 'wrap' as const, gap: 5, padding: '6px 10px', borderBottom: '1px solid #f1f5f9' },
  quickBtn: { padding: '3px 9px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, fontSize: 12, cursor: 'pointer', color: '#1d4ed8', fontFamily: '宋体, SimSun, serif' },
  empty: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' as const, color: '#94a3b8', gap: 8, padding: 16 },
  emptyIcon: { fontSize: 32 },
  emptyText: { fontSize: 13, textAlign: 'center' as const },
  thinking: { fontSize: 13, color: '#94a3b8', padding: '4px 12px', background: '#f8fafc', borderRadius: 8, alignSelf: 'flex-start', border: '1px solid #e2e8f0' },
};

const QUICK_PROMPTS = [
  '帮我优化这封邮件',
  '写一封投稿信',
  '帮我修改主题行',
  '让邮件更正式',
  '让邮件更简洁',
  '检查语法错误',
];

interface AiPanelProps {
  contextText?: string;
}

export function AiPanel({ contextText }: AiPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  const sendMessage = useCallback(async (text?: string) => {
    const content = (text || input).trim();
    if (!content || thinking) return;

    const userMsg: ChatMessage = { role: 'user', content, timestamp: Date.now() };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput('');
    setThinking(true);
    scrollToBottom();

    try {
      const history = updated.map(m => ({ role: m.role, content: m.content }));
      if (contextText) {
        history.unshift({
          role: 'user',
          content: `以下是当前邮件的内容供参考：\n\n${contextText}\n\n请基于以上邮件内容帮助我。`,
        });
      }

      const reply = await invoke<string>('chat_with_ai', {
        messages: history,
        systemPrompt: '你是一个专业的邮件写作助手，帮助用户改进邮件内容，优化语气和表达，提供投稿建议。请用中文回复。',
      });

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: reply || '（无回复）',
        timestamp: Date.now(),
      }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `⚠️ 调用失败：${err instanceof Error ? err.message : String(err)}`,
        timestamp: Date.now(),
      }]);
    } finally {
      setThinking(false);
      scrollToBottom();
    }
  }, [input, messages, thinking, contextText]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div style={S.root}>
      <div style={S.header}>
        <span style={S.headerTitle}>AI 助手</span>
        {messages.length > 0 && (
          <button style={S.btn()} onClick={() => setMessages([])}>清空</button>
        )}
      </div>

      <div style={S.quickPrompts}>
        {QUICK_PROMPTS.map(p => (
          <button key={p} style={S.quickBtn} onClick={() => sendMessage(p)}>{p}</button>
        ))}
      </div>

      <div style={S.messages}>
        {messages.length === 0 && !thinking ? (
          <div style={S.empty}>
            <span style={S.emptyIcon}>✉️</span>
            <span style={S.emptyText}>
              AI 助手可以帮你优化邮件、生成投稿信、改善措辞。<br />
              点击上方快捷按钮或直接输入问题。
            </span>
          </div>
        ) : (
          messages.map(m => (
            <div key={m.timestamp} style={S.bubble(m.role)}>
              {m.content.split('\n').map((line, i) => (
                <span key={i}>{line}{i < m.content.split('\n').length - 1 && <br />}</span>
              ))}
            </div>
          ))
        )}
        {thinking && <div style={S.thinking}>AI 正在思考...</div>}
        <div ref={messagesEndRef} />
      </div>

      <div style={S.inputArea}>
        <textarea
          style={S.textarea}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入问题，Shift+Enter 换行，Enter 发送..."
        />
        <div style={S.sendRow}>
          <button style={S.btn(true)} onClick={() => sendMessage()} disabled={!input.trim() || thinking}>
            发送
          </button>
        </div>
      </div>
    </div>
  );
}
