/**
 * TranslationAISidebar — 翻译专属 AI 侧边栏
 *
 * 基于 DocTypeAIChatBase，增加：
 * - 翻译/润色/替换方案快捷操作
 * - 7 种预设翻译场景（正式公文/学术论文/商务/文学/技术/口语/法律）
 * - 替换译文操作
 * - Markdown 渲染 + 联网/深度思考开关（内置）
 */
import { useState, useCallback } from 'react';
import { Languages, Sparkles, RefreshCw, ChevronDown, BookOpen, ArrowDownToLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import type { DocTypeAISidebarProps } from '@/doctype-sdk/types';
import { parseTranslationContent } from './types';
import DocTypeAIChatBase, { sendDocTypeAIMessage } from '../_shared/DocTypeAIChatBase';
import { QUICK_ACTION_BAR, QUICK_ACTION_BTN, QUICK_ACTION_ICON, EMPTY_STATE_CLASS, EMPTY_STATE_ICON, MSG_ACTION_BTN } from '../_shared/styles';
import type { DocTypeChatMsg } from '../_shared/DocTypeChatMessage';

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

export default function TranslationAISidebar({ document: doc, host }: DocTypeAISidebarProps) {
  const { t } = useTranslation();
  const [showPresets, setShowPresets] = useState(false);

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

  const handleInsertToTarget = useCallback((text: string) => {
    const trans = getTransContent();
    if (!trans) return;
    const updated = { ...trans, target: text };
    host.doc.updateInMemory({ content: JSON.stringify(updated) });
    host.doc.markDirty();
    host.doc.save();
    window.dispatchEvent(new CustomEvent('translation-target-updated', { detail: { documentId: doc.id, target: text } }));
  }, [getTransContent, host.doc, doc.id]);

  return (
    <DocTypeAIChatBase
      host={host}
      document={doc}
      systemPrompt={SYSTEM_PROMPT}
      historyLimit={8}
      placeholder={t('translation.aiPlaceholder', { defaultValue: '输入翻译相关问题...' })}
      headerSlot={
        <div className={QUICK_ACTION_BAR}>
          <Button variant="outline" size="sm" className={QUICK_ACTION_BTN} onClick={handleTranslate}>
            <Languages className={QUICK_ACTION_ICON} />
            {t('translation.translate', { defaultValue: '翻译' })}
          </Button>
          <Button variant="outline" size="sm" className={QUICK_ACTION_BTN} onClick={handlePolish}>
            <Sparkles className={QUICK_ACTION_ICON} />
            {t('translation.polish', { defaultValue: '润色译文' })}
          </Button>
          <Button variant="outline" size="sm" className={QUICK_ACTION_BTN} onClick={handleAlternative}>
            <RefreshCw className={QUICK_ACTION_ICON} />
            {t('translation.alternative', { defaultValue: '替换方案' })}
          </Button>
          {/* 预设翻译场景 */}
          <div className="relative">
            <Button variant="outline" size="sm" className={QUICK_ACTION_BTN}
              onClick={() => setShowPresets(!showPresets)}>
              <BookOpen className={QUICK_ACTION_ICON} />
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
      }
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
  );
}
