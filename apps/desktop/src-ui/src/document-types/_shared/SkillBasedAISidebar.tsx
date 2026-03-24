/**
 * 通用的基于 Skills 的 AI 侧栏
 * 所有 standard 布局的文档类型共用此组件
 * 自动从 AI 引擎获取该文档类型的 Skills 并渲染快捷操作按钮
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Square, Eraser, ArrowDownToLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { listSkills, getEffectivePrompt, renderPromptTemplate, type DocTypeSkill } from '@/ai-engine';
import type { DocTypeAISidebarProps } from '@/doctype-sdk/types';

interface ChatMsg { role: 'user' | 'assistant'; content: string }

export default function SkillBasedAISidebar({ document: doc, host, onClose: _onClose }: DocTypeAISidebarProps) {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  const skills = listSkills(host.docTypeId);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  const callAI = useCallback(async (userPrompt: string) => {
    if (isStreaming) return;
    setIsStreaming(true);
    setStreamingContent('');
    try {
      if (!host.ai.isAvailable()) {
        setMessages(prev => [...prev, { role: 'assistant', content: t('novelWorkspace.noAIService', { defaultValue: '未配置 AI 服务' }) }]);
        return;
      }
      const systemPrompt = host.ui.t(`docType.${host.docTypeId}SystemPrompt`, {}) || '';
      const historyMsgs = messages.slice(-6).map(m => ({ role: m.role, content: m.content }));
      const allMsgs = [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        ...historyMsgs,
        { role: 'user', content: userPrompt },
      ];
      // DocTypeHost.chatStream：onChunk 为已累计全文，非增量
      const result = await host.ai.chatStream(allMsgs, (cumulative: string) => {
        setStreamingContent(cumulative);
      });
      setMessages(prev => [...prev, { role: 'assistant', content: result }]);
      setStreamingContent('');
    } catch (err) {
      const errorMsg = streamingContent || `错误: ${err}`;
      setMessages(prev => [...prev, { role: 'assistant', content: errorMsg }]);
      setStreamingContent('');
    } finally {
      setIsStreaming(false);
    }
  }, [isStreaming, messages, streamingContent, host, t]);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: trimmed }]);
    callAI(trimmed);
  }, [input, isStreaming, callAI]);

  const handleSkillAction = useCallback((skill: DocTypeSkill) => {
    if (isStreaming) return;
    const content = host.doc.getDocument().content || '';
    if (!content.trim()) return;
    const effective = getEffectivePrompt(skill);
    const rendered = renderPromptTemplate(effective.prompt, { content: content.slice(-3000) });
    setMessages(prev => [...prev, { role: 'user', content: `[${t(skill.labelKey, { defaultValue: skill.id })}]` }]);
    callAI(rendered);
  }, [isStreaming, host.doc, callAI, t]);

  const handleInsert = useCallback((text: string) => {
    window.dispatchEvent(new CustomEvent('doctype-insert-text', { detail: { documentId: doc.id, text } }));
  }, [doc.id]);

  return (
    <div className="h-full flex flex-col">
      {/* 快捷操作 */}
      {skills.length > 0 && (
        <div className="flex flex-wrap gap-0.5 px-1.5 py-1.5 border-b flex-shrink-0">
          {skills.map(skill => {
            return (
              <Button key={skill.id} variant="outline" size="sm"
                className="h-6 text-[10px] px-1.5 gap-0.5" disabled={isStreaming}
                onClick={() => handleSkillAction(skill)}
                title={t(skill.descriptionKey, { defaultValue: skill.id })}>
                {t(skill.labelKey, { defaultValue: skill.id.split(':')[1] || skill.id })}
              </Button>
            );
          })}
        </div>
      )}

      {/* 消息列表 */}
      <div className="flex-1 overflow-auto p-3 space-y-3 min-h-0">
        {messages.length === 0 && !streamingContent && (
          <div className="text-center text-xs text-muted-foreground py-8">
            {t('skill.aiHint', { defaultValue: '使用快捷操作或输入问题，AI 为你服务' })}
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={cn('text-sm rounded-lg p-2.5', msg.role === 'user' ? 'bg-primary/10 ml-8' : 'bg-muted mr-2')}>
            <div className="whitespace-pre-wrap break-words">{msg.content}</div>
            {msg.role === 'assistant' && msg.content.length > 10 && (
              <div className="flex gap-1 mt-1.5 pt-1 border-t border-border/50">
                <button className="text-[10px] text-primary hover:underline flex items-center gap-0.5" onClick={() => handleInsert(msg.content)}>
                  <ArrowDownToLine className="h-2.5 w-2.5" />
                  {t('novelWorkspace.insertToDoc', { defaultValue: '插入到正文' })}
                </button>
              </div>
            )}
          </div>
        ))}
        {streamingContent && (
          <div className="text-sm rounded-lg p-2.5 bg-muted mr-2">
            <div className="whitespace-pre-wrap break-words">{streamingContent}</div>
            <span className="inline-block w-1.5 h-4 bg-primary/60 animate-pulse ml-0.5" />
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* 输入区 */}
      <div className="flex-shrink-0 border-t p-2">
        <div className="flex items-end gap-1.5">
          <textarea value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={t('skill.inputPlaceholder', { defaultValue: '输入问题或指令...' })}
            rows={2} className="flex-1 text-sm px-2.5 py-1.5 border rounded-md bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring"
            disabled={isStreaming} />
          <div className="flex flex-col gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setMessages([]); setStreamingContent(''); }} disabled={messages.length === 0}>
              <Eraser className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" className="h-7 w-7" onClick={handleSend} disabled={!input.trim()}>
              {isStreaming ? <Square className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
