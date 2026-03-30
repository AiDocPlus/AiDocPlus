/**
 * TranslationAISidebar — 翻译专属 AI 侧栏（full 布局模式）
 *
 * 基于 DocTypeAIChatBase，增加：
 * - 翻译/润色/替换方案快捷操作
 * - 7 种预设翻译场景（正式公文/学术论文/商务/文学/技术/口语/法律）
 * - 替换译文操作
 * - 文档上下文信息（翻译方向、字数）
 * - Markdown 渲染 + 联网/深度思考开关（内置）
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { ChevronDown, Languages, ArrowDownToLine, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import type { Document } from '@aidocplus/shared-types';
import type { DocTypeHostAPI } from '@/doctype-sdk/types';
import { parseTranslationContent } from './types';
import DocTypeAIChatBase, { sendDocTypeAIMessage } from '../_shared/DocTypeAIChatBase';
import {
  QUICK_ACTION_BAR, QUICK_ACTION_BTN, EMPTY_STATE_CLASS, EMPTY_STATE_ICON,
  MSG_ACTION_BTN, SIDEBAR_AI_HEADER_PANEL, SIDEBAR_AI_HEADER_ROW,
} from '../_shared/styles';
import type { DocTypeChatMsg } from '../_shared/DocTypeChatMessage';
import { parseThinkTags } from '@/utils/thinkTagParser';

const SYSTEM_PROMPT = '你是专业的中英文翻译助手。翻译时注重信、达、雅，保持术语一致性。';

// ═══ 预设翻译场景提示词模板 ═══
const TRANSLATION_PRESETS = [
  { id: 'formal', labelKey: 'translation.presetFormal', defaultLabel: '正式公文', prompt: '请以正式公文风格翻译，用语庄重、规范、严谨。' },
  { id: 'academic', labelKey: 'translation.presetAcademic', defaultLabel: '学术论文', prompt: '请以学术论文风格翻译，使用专业术语，语言精确、客观。' },
  { id: 'business', labelKey: 'translation.presetBusiness', defaultLabel: '商务信函', prompt: '请以商务信函风格翻译，语气礼貌、专业、简洁。' },
  { id: 'literary', labelKey: 'translation.presetLiterary', defaultLabel: '文学作品', prompt: '请以文学翻译风格翻译，注重文采、意境和修辞，追求信达雅。' },
  { id: 'technical', labelKey: 'translation.presetTechnical', defaultLabel: '技术文档', prompt: '请以技术文档风格翻译，术语准确、表述清晰、逻辑严密。' },
  { id: 'casual', labelKey: 'translation.presetCasual', defaultLabel: '日常口语', prompt: '请以日常口语风格翻译，自然流畅、口语化、通俗易懂。' },
  { id: 'legal', labelKey: 'translation.presetLegal', defaultLabel: '法律合同', prompt: '请以法律文书风格翻译，措辞严谨、逻辑缜密、无歧义。' },
];

interface TranslationAISidebarProps {
  document: Document;
  host: DocTypeHostAPI;
  onClose: () => void;
}

export default function TranslationAISidebar({ document: doc, host, onClose }: TranslationAISidebarProps) {
  const { t } = useTranslation();
  const [showPresets, setShowPresets] = useState(false);

  // 文档上下文信息（字数、方向）
  const [sourceCount, setSourceCount] = useState(0);
  const [targetCount, setTargetCount] = useState(0);
  const [direction, setDirection] = useState<'zh-en' | 'en-zh'>('zh-en');

  // 防止 doc.content 引用变化但内容相同时反复 setState 导致无限循环
  const lastProcessedContentRef = useRef<string>('');
  useEffect(() => {
    const content = doc.content || '';
    if (content === lastProcessedContentRef.current) return;
    lastProcessedContentRef.current = content;
    const trans = parseTranslationContent(content);
    if (trans) {
      setSourceCount(trans.source.replace(/\s/g, '').length);
      setTargetCount(trans.target.replace(/\s/g, '').length);
      setDirection(trans.direction);
    }
  }, [doc.content]);

  const getTransContent = useCallback(() => {
    const d = host.doc.getDocument();
    return parseTranslationContent(d.content || '');
  }, [host.doc]);

  const fire = useCallback((label: string, prompt: string, sys?: string) => {
    sendDocTypeAIMessage({
      documentId: doc.id,
      message: prompt,
      label,
      systemPrompt: sys,
    });
  }, [doc.id]);

  const handleTranslate = useCallback(() => {
    const trans = getTransContent();
    if (!trans || !trans.source.trim()) return;
    const srcLang = trans.direction === 'zh-en' ? '中文' : '英文';
    const tgtLang = trans.direction === 'zh-en' ? '英文' : '中文';
    fire(
      `翻译 ${srcLang}→${tgtLang}`,
      `请将以下${srcLang}翻译为${tgtLang}，只输出译文：\n\n${trans.source}`,
      '你是专业的中英文翻译助手。只输出译文，不要添加任何说明。',
    );
  }, [getTransContent, fire]);

  const handlePolish = useCallback(() => {
    const trans = getTransContent();
    if (!trans || !trans.target.trim()) return;
    fire(t('translation.polish', { defaultValue: '润色译文' }), `请润色以下译文，使其更加通顺自然：\n\n${trans.target}`);
  }, [getTransContent, fire, t]);

  const handleAlternative = useCallback(() => {
    const trans = getTransContent();
    if (!trans || !trans.target.trim()) return;
    fire(t('translation.alternative', { defaultValue: '替换方案' }), `请提供另一种翻译方案：\n\n原文：${trans.source.slice(-1500)}\n\n当前译文：${trans.target.slice(-1500)}`);
  }, [getTransContent, fire, t]);

  const handlePresetTranslate = useCallback((preset: typeof TRANSLATION_PRESETS[0]) => {
    const trans = getTransContent();
    if (!trans || !trans.source.trim()) return;
    const srcLang = trans.direction === 'zh-en' ? '中文' : '英文';
    const tgtLang = trans.direction === 'zh-en' ? '英文' : '中文';
    setShowPresets(false);
    fire(
      `${t(preset.labelKey, { defaultValue: preset.defaultLabel })}翻译`,
      `${preset.prompt}\n\n请将以下${srcLang}翻译为${tgtLang}，只输出译文：\n\n${trans.source}`,
      `你是专业的中英文翻译助手。${preset.prompt}`,
    );
  }, [getTransContent, fire, t]);

  const handleInsertToTarget = useCallback((msgContent: string) => {
    const trans = getTransContent();
    if (!trans) return;
    // 先尝试从正文中提取，如果正文为空则从 think 内容中提取
    const parsed = parseThinkTags(msgContent);
    const effectiveContent = parsed.content.trim() || parsed.thinking.trim();
    if (!effectiveContent) return;
    const updated = { ...trans, target: effectiveContent };
    host.doc.updateInMemory({ content: JSON.stringify(updated) });
    host.doc.markDirty();
    host.doc.save();
    window.dispatchEvent(new CustomEvent('translation-target-updated', { detail: { documentId: doc.id, target: effectiveContent } }));
  }, [getTransContent, host.doc, doc.id]);

  // 流式翻译：实时将正文写入译文编辑区（300ms 节流）
  const streamThrottleRef = useRef(0);
  const handleStreamUpdate = useCallback((accumulatedText: string) => {
    const now = Date.now();
    if (now - streamThrottleRef.current < 300) return;
    streamThrottleRef.current = now;

    const parsed = parseThinkTags(accumulatedText);
    const content = parsed.content.trim();
    if (!content) return; // 还在思考阶段，正文尚未出现

    window.dispatchEvent(new CustomEvent('translation-stream-update', {
      detail: { documentId: doc.id, target: content },
    }));
  }, [doc.id]);

  // 翻译完成回调：解析 AI 结果并写入译文编辑区（单一路径，由 onAIResponse 负责）
  // 使用 useCallback 避免每次 render 创建新函数（虽然 DocTypeAIChatBase 已用 ref 持有，
  // 但 useCallback 仍是最佳实践，避免不必要的重渲染传递）
  const handleAIResponse = useCallback((result: string, meta?: { label?: string }) => {
    // 仅翻译类操作（一键翻译、翻译、预设场景翻译）自动写入译文编辑区
    // 润色、替换方案、普通问答等不自动写入
    const label = meta?.label || '';
    const isTranslationOp = label.includes('翻译');
    if (!isTranslationOp) return;

    const parsed = parseThinkTags(result);
    const target = parsed.content.trim() || parsed.thinking.trim();
    if (!target) return;

    const trans = parseTranslationContent(host.doc.getDocument().content || '');
    if (!trans) return;
    const updated = { ...trans, target };
    host.doc.updateInMemory({ content: JSON.stringify(updated) });
    host.doc.markDirty();
    host.doc.save();
    window.dispatchEvent(new CustomEvent('translation-target-updated', { detail: { documentId: doc.id, target } }));
  }, [host.doc, doc.id]);

  const dirText = direction === 'zh-en' ? '中→英' : '英→中';

  return (
    <div className="flex flex-col h-full">
      {/* 顶栏：标题 + 关闭按钮 */}
      <div className={SIDEBAR_AI_HEADER_PANEL}>
        <div className={SIDEBAR_AI_HEADER_ROW}>
          <Languages className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="text-xs font-medium truncate">{t('translation.aiTitle', { defaultValue: 'AI 翻译助手' })}</span>
          <div className="flex-1" />
          {/* 文档上下文信息 */}
          <span className="text-[10px] text-muted-foreground shrink-0">{dirText}</span>
          <span className="text-[10px] text-muted-foreground shrink-0">
            {t('translation.sidebarSourceCount', { defaultValue: '{{count}}字', count: sourceCount })}
          </span>
          <span className="text-[10px] text-muted-foreground shrink-0">
            →{t('translation.sidebarTargetCount', { defaultValue: '{{count}}字', count: targetCount })}
          </span>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0" onClick={onClose}>
            <X className="h-3 w-3" />
          </Button>
        </div>

        {/* 快捷操作栏 */}
        <div className={QUICK_ACTION_BAR}>
          <Button variant="outline" size="sm" className={QUICK_ACTION_BTN} onClick={handleTranslate}>
            {t('translation.translate', { defaultValue: '翻译' })}
          </Button>
          <Button variant="outline" size="sm" className={QUICK_ACTION_BTN} onClick={handlePolish}>
            {t('translation.polish', { defaultValue: '润色译文' })}
          </Button>
          <Button variant="outline" size="sm" className={QUICK_ACTION_BTN} onClick={handleAlternative}>
            {t('translation.alternative', { defaultValue: '替换方案' })}
          </Button>
          {/* 预设翻译场景 */}
          <div className="relative">
            <Button variant="outline" size="sm" className={QUICK_ACTION_BTN}
              onClick={() => setShowPresets(!showPresets)}>
              {t('translation.presets', { defaultValue: '场景' })}
              <ChevronDown className="h-2.5 w-2.5" />
            </Button>
            {showPresets && (
              <div className="absolute top-full left-0 mt-1 z-50 min-w-[140px] rounded-md border p-1 shadow-lg bg-popover">
                {TRANSLATION_PRESETS.map(preset => (
                  <button key={preset.id}
                    className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent cursor-pointer"
                    onClick={() => handlePresetTranslate(preset)}>
                    {t(preset.labelKey, { defaultValue: preset.defaultLabel })}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 聊天主体 */}
      <div className="flex-1 min-h-0">
        <DocTypeAIChatBase
          host={host}
          document={doc}
          systemPrompt={SYSTEM_PROMPT}
          historyLimit={8}
          defaultThinking={false}
          placeholder={t('translation.aiPlaceholder', { defaultValue: '输入翻译相关问题...' })}
          onAIResponse={handleAIResponse}
          onAssistantStreamUpdate={handleStreamUpdate}
          emptyStateSlot={
            <div className={EMPTY_STATE_CLASS}>
              <Languages className={EMPTY_STATE_ICON} />
              <p>{t('translation.aiHint', { defaultValue: 'AI 翻译助手' })}</p>
              <p className="text-[11px]">{t('translation.aiHintDesc', { defaultValue: '点击快捷操作或选择翻译场景' })}</p>
            </div>
          }
          messageActions={(msg: DocTypeChatMsg) => (
            <button className={MSG_ACTION_BTN} onClick={() => handleInsertToTarget(msg.content)}>
              <ArrowDownToLine className="h-3 w-3" />
              {t('translation.insertToTarget', { defaultValue: '替换译文' })}
            </button>
          )}
        />
      </div>
    </div>
  );
}
