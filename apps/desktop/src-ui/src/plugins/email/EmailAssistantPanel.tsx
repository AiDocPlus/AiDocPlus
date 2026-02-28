/**
 * 邮件插件专属 AI 助手面板
 *
 * 与邮件场景深度耦合的 AI 工作台：
 * - 快捷操作：AI 撰写、AI 排版、润色优化、发送前检查
 * - 对话区：自由对话，支持自动配置邮箱、生成签名/模板、翻译、回复生成等
 * - AI 回复中的操作按钮：应用到正文/主题、添加账户/签名
 * - 自动注入邮件上下文（正文、主题、收件人、账户、签名）
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { usePluginHost } from '../_framework/PluginHostAPI';
import { useSettingsStore, getAIInvokeParamsForService } from '@/stores/useSettingsStore';
import { getProviderConfig, getActiveService } from '@aidocplus/shared-types';
import type { PluginAssistantPanelProps } from '../types';
import {
  type AssistantMessage,
  genMsgId,
  exportChatAsMarkdown,
} from '../_framework/pluginAssistantAI';
import {
  Send, Square, Trash2, Loader2, Copy, Check, ArrowDownToLine,
  Sparkles, ScrollText, RotateCcw, ChevronDown, Globe, Brain,
  Wand2, Paintbrush, ShieldCheck, Mail, PenLine,
  ArrowRight, UserPlus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

// ── 邮件存储数据类型（与 EmailPluginPanel 保持一致） ──
interface EmailStorageData {
  accounts?: Array<{ id: string; name: string; provider: string; smtpHost: string; smtpPort: number; encryption: string; email: string; password: string; displayName?: string }>;
  activeAccountId?: string;
  recipients?: string[];
  cc?: string[];
  bcc?: string[];
  subject?: string;
  emailBody?: string;
  emailFormat?: 'html' | 'plaintext';
  signatures?: Array<{ id: string; name: string; content: string }>;
  activeSignatureId?: string;
  submissionTemplates?: Array<{ id: string; name: string; recipients: string[]; subjectTemplate: string; bodyTemplate: string }>;
}

// ── 快捷操作定义 ──
interface QuickAction {
  id: string;
  icon: React.ElementType;
  label: string;
  /** 是否需要二级选择（如风格选择） */
  hasSubMenu?: boolean;
  subOptions?: Array<{ label: string; prompt: string }>;
}

const STORAGE_KEY = '_assistant_messages';

// ── 系统提示词 ──
function buildSystemPrompt(): string {
  return `你是邮件 AI 助手，精通邮件撰写、排版、翻译和邮箱技术配置。

你的能力：
1. 撰写各种风格的邮件（商务/学术/友好/致歉/感谢/邀请/跟进/投稿）
2. 润色、排版、翻译邮件内容
3. 生成邮件回复、续写邮件
4. 检查邮件质量（拼写、语法、专业度、敏感词）
5. 配置邮箱账户（根据邮箱后缀识别SMTP服务器参数）
6. 指导用户获取各邮件服务商的授权码
7. 诊断邮件发送失败原因
8. 生成邮件模板和专业签名

当用户提供邮箱地址和密码时，你应该：
1. 自动识别邮件服务商
2. 生成完整的SMTP配置JSON，格式如下：
\`\`\`json
{"action":"add_account","name":"账户名","provider":"服务商ID","smtpHost":"smtp服务器","smtpPort":465,"encryption":"tls","email":"邮箱地址","password":"密码","displayName":"发件人名称"}
\`\`\`

常见邮箱后缀对应服务商：
- @126.com → netease126, smtp.126.com:465/TLS
- @163.com → netease163, smtp.163.com:465/TLS
- @qq.com → qq, smtp.qq.com:465/TLS
- @foxmail.com → foxmail, smtp.qq.com:465/TLS
- @gmail.com → gmail, smtp.gmail.com:465/TLS
- @outlook.com → outlook, smtp.office365.com:587/STARTTLS
- @hotmail.com → outlook, smtp.office365.com:587/STARTTLS
- @yahoo.com → yahoo, smtp.mail.yahoo.com:465/TLS
- @aliyun.com → aliyun, smtp.aliyun.com:465/TLS
- @sina.com → sina, smtp.sina.com:465/TLS
- @sohu.com → sohu, smtp.sohu.com:465/TLS
- @139.com → china139, smtp.139.com:465/TLS
- @189.cn → china189, smtp.189.cn:465/TLS

当用户要求生成签名时，输出HTML签名，并用以下JSON格式标记：
\`\`\`json
{"action":"add_signature","name":"签名名称","content":"<HTML签名内容>"}
\`\`\`

输出邮件正文时使用HTML格式，用 \`\`\`html 代码块包裹。
回复使用中文。`;
}

// ── 构建邮件上下文 ──
function buildEmailContext(stored: EmailStorageData): string {
  const parts: string[] = [];

  if (stored.subject) {
    parts.push(`当前邮件主题：${stored.subject}`);
  }
  if (stored.recipients && stored.recipients.length > 0) {
    parts.push(`收件人：${stored.recipients.join(', ')}`);
  }
  if (stored.emailBody) {
    const bodyPreview = stored.emailBody.replace(/<[^>]*>/g, '').slice(0, 1500);
    if (bodyPreview.trim()) {
      parts.push(`当前邮件正文摘要：\n${bodyPreview}`);
    }
  }
  if (stored.accounts && stored.accounts.length > 0) {
    parts.push(`已配置邮箱账户：${stored.accounts.map(a => a.email || a.name).join(', ')}`);
  }
  if (stored.signatures && stored.signatures.length > 0) {
    parts.push(`已有签名：${stored.signatures.map(s => s.name).join(', ')}`);
  }

  return parts.length > 0 ? '\n\n--- 当前邮件状态 ---\n' + parts.join('\n') : '';
}

// ── 组件 ──
export function EmailAssistantPanel({
  aiContent,
}: PluginAssistantPanelProps) {
  const host = usePluginHost();
  const { t } = useTranslation('plugin-email');

  // ── AI 服务选择 ──
  const settingsStore = useSettingsStore();
  const enabledServices = settingsStore.ai.services.filter(s => s.enabled);
  const [selectedServiceId, setSelectedServiceId] = useState<string>(() => {
    return host.storage.get<string>('_assistant_service_id') || '';
  });

  const effectiveService = selectedServiceId
    ? enabledServices.find(s => s.id === selectedServiceId) || getActiveService(settingsStore.ai)
    : getActiveService(settingsStore.ai);

  const aiParams = getAIInvokeParamsForService(selectedServiceId || undefined);
  const aiAvailable = !!(aiParams.provider && aiParams.apiKey && aiParams.model);
  const providerCaps = (() => {
    if (!aiParams.provider) return { webSearch: false, thinking: false };
    const cfg = getProviderConfig(aiParams.provider as any);
    return cfg?.capabilities || { webSearch: false, thinking: false };
  })();

  // ── 对话状态 ──
  const [messages, setMessages] = useState<AssistantMessage[]>(() => {
    return host.storage.get<AssistantMessage[]>(STORAGE_KEY) || [];
  });
  const [inputValue, setInputValue] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [enableWebSearch, setEnableWebSearch] = useState(true); // 默认联网

  // ── 提示词 ──
  const [promptOpen, setPromptOpen] = useState(false);
  const systemPrompt = useMemo(() => buildSystemPrompt(), []);
  const [customPrompt, setCustomPrompt] = useState<string>(() => {
    return host.storage.get<string>('_assistant_prompt') || '';
  });
  const [promptDraft, setPromptDraft] = useState(customPrompt || systemPrompt);

  // ── 快捷操作子菜单 ──
  const [activeSubMenu, setActiveSubMenu] = useState<string | null>(null);

  // 持久化消息
  useEffect(() => {
    host.storage.set(STORAGE_KEY, messages);
  }, [messages, host.storage]);

  // 自动滚动
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  // ── 读取邮件上下文 ──
  const getEmailData = useCallback((): EmailStorageData => {
    return host.storage.get<EmailStorageData>('emailData') || {};
  }, [host.storage]);

  // ── 发送消息 ──
  const sendMessage = useCallback(async (userText: string) => {
    if (!userText.trim() || streaming) return;
    if (!aiAvailable) return;

    const userMsg: AssistantMessage = {
      id: genMsgId(), role: 'user', content: userText.trim(), timestamp: Date.now(),
    };
    const updatedHistory = [...messages, userMsg];
    setMessages(updatedHistory);
    setInputValue('');
    setStreaming(true);
    setStreamingContent('');

    const abort = new AbortController();
    abortRef.current = abort;

    let accumulated = '';
    try {
      // 构建消息
      const emailData = getEmailData();
      const sysContent = (customPrompt?.trim() || systemPrompt) + buildEmailContext(emailData);

      // 引入文档正文作为参考
      const docContent = aiContent || host.content.getDocumentContent();
      const docContext = docContent ? `\n\n--- 文档正文参考 ---\n${docContent.slice(0, 2000)}` : '';

      const contextMsgs: Array<{ role: string; content: string }> = [
        { role: 'system', content: sysContent + docContext },
      ];

      // 对话历史（最近20条）
      const recent = updatedHistory.filter(m => m.role !== 'system').slice(-20);
      for (const msg of recent) {
        contextMsgs.push({ role: msg.role, content: msg.content });
      }

      await host.ai.chatStream(contextMsgs, (delta) => {
        accumulated += delta;
        setStreamingContent(accumulated);
      }, { signal: abort.signal, serviceId: selectedServiceId || undefined });

      const assistantMsg: AssistantMessage = {
        id: genMsgId(), role: 'assistant', content: accumulated, timestamp: Date.now(),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      if (!abort.signal.aborted) {
        const errMsg: AssistantMessage = {
          id: genMsgId(), role: 'assistant',
          content: `❌ ${err instanceof Error ? err.message : String(err)}`,
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, errMsg]);
      }
    } finally {
      setStreaming(false);
      setStreamingContent('');
      abortRef.current = null;
    }
  }, [messages, streaming, aiAvailable, systemPrompt, customPrompt, getEmailData, aiContent, host, selectedServiceId]);

  // ── 停止生成 ──
  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    if (streamingContent) {
      setMessages(prev => [...prev, {
        id: genMsgId(), role: 'assistant',
        content: streamingContent + '\n\n_(已中断)_',
        timestamp: Date.now(),
      }]);
    }
    setStreaming(false);
    setStreamingContent('');
  }, [streamingContent]);

  // ── 清除对话 ──
  const handleClear = useCallback(() => {
    setMessages([]);
    setStreamingContent('');
  }, []);

  // ── 导出 ──
  const handleExport = useCallback(() => {
    if (messages.length === 0) return;
    const md = exportChatAsMarkdown(messages, t('title'));
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `邮件AI对话_${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [messages, t]);

  // ── 复制 ──
  const handleCopy = useCallback((text: string, blockId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(blockId);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  // ── 提示词编辑 ──
  const handlePromptSave = useCallback(() => {
    const trimmed = promptDraft.trim();
    const isDefault = trimmed === systemPrompt.trim();
    const val = isDefault ? '' : trimmed;
    setCustomPrompt(val);
    host.storage.set('_assistant_prompt', val);
  }, [promptDraft, systemPrompt, host.storage]);

  const handlePromptReset = useCallback(() => {
    setPromptDraft(systemPrompt);
    setCustomPrompt('');
    host.storage.set('_assistant_prompt', '');
  }, [systemPrompt, host.storage]);

  // ── AI 服务切换 ──
  const handleServiceChange = useCallback((serviceId: string) => {
    setSelectedServiceId(serviceId);
    host.storage.set('_assistant_service_id', serviceId);
  }, [host.storage]);

  // ── 应用到邮件 ──
  const applyToEmail = useCallback((field: 'body' | 'subject', value: string) => {
    window.dispatchEvent(new CustomEvent('email-ai-apply', { detail: { field, value } }));
  }, []);

  // ── 添加账户 ──
  const addAccount = useCallback((accountData: Record<string, unknown>) => {
    const id = `acct_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const account = { id, ...accountData };
    window.dispatchEvent(new CustomEvent('email-ai-add-account', { detail: { account } }));
  }, []);

  // ── 添加签名 ──
  const addSignature = useCallback((name: string, content: string) => {
    window.dispatchEvent(new CustomEvent('email-ai-add-signature', { detail: { signature: { name, content } } }));
  }, []);

  // ── 快捷操作定义 ──
  const quickActions: QuickAction[] = useMemo(() => [
    {
      id: 'compose',
      icon: Wand2,
      label: t('assistantCompose', { defaultValue: 'AI 撰写' }),
      hasSubMenu: true,
      subOptions: [
        { label: t('styleBusinessFormal'), prompt: t('assistantPromptComposeFormal', { defaultValue: '根据当前文档正文和邮件主题、收件人信息，撰写一封正式的商务邮件正文。语言专业、措辞严谨、结构清晰。输出HTML格式。' }) },
        { label: t('styleBriefNotice'), prompt: t('assistantPromptComposeBrief', { defaultValue: '根据当前文档正文和邮件主题，撰写一封简洁的通知邮件正文，突出关键信息，控制在200字以内。输出HTML格式。' }) },
        { label: t('styleAcademic'), prompt: t('assistantPromptComposeAcademic', { defaultValue: '根据当前文档正文和邮件主题，撰写一封学术交流邮件正文，语言规范、逻辑严密。输出HTML格式。' }) },
        { label: t('styleFriendly'), prompt: t('assistantPromptComposeFriendly', { defaultValue: '根据当前文档正文和邮件主题，撰写一封轻松友好的邮件正文，语气亲切自然。输出HTML格式。' }) },
        { label: t('styleSubmission'), prompt: t('assistantPromptComposeSubmission', { defaultValue: '根据当前文档正文和邮件主题，撰写一封投稿邮件正文，简要介绍稿件主题和亮点，表达发表意愿，语气专业谦逊。输出HTML格式。' }) },
        { label: t('styleApology'), prompt: t('assistantPromptComposeApology', { defaultValue: '根据当前邮件上下文，撰写一封诚恳的致歉邮件正文。输出HTML格式。' }) },
        { label: t('styleThankYou'), prompt: t('assistantPromptComposeThanks', { defaultValue: '根据当前邮件上下文，撰写一封感谢邮件正文。输出HTML格式。' }) },
        { label: t('styleFollowUp'), prompt: t('assistantPromptComposeFollowUp', { defaultValue: '根据当前邮件上下文，撰写一封跟进邮件正文，礼貌提醒对方之前的沟通并询问进展。输出HTML格式。' }) },
      ],
    },
    {
      id: 'typography',
      icon: Paintbrush,
      label: t('assistantTypography', { defaultValue: 'AI 排版' }),
      hasSubMenu: true,
      subOptions: [
        { label: t('aiTypoCleanup'), prompt: t('assistantPromptTypoCleanup', { defaultValue: '请对当前邮件正文进行格式清理和规范化排版：统一字体、字号、行高，段落间距适当，去除多余空行和格式混乱。输出优化后的完整HTML，保持原文语义不变。' }) },
        { label: t('aiTypoProfessional'), prompt: t('assistantPromptTypoPro', { defaultValue: '请将当前邮件正文排版为专业商务风格：深色正文、清晰段落层次、标题加粗、关键信息突出。输出优化后的完整HTML。' }) },
        { label: t('aiTypoModern'), prompt: t('assistantPromptTypoModern', { defaultValue: '请将当前邮件正文排版为现代简约风格：无衬线字体、适当留白、柔和色彩、清晰视觉层次。输出优化后的完整HTML。' }) },
        { label: t('aiTypoMinimalist'), prompt: t('assistantPromptTypoMinimal', { defaultValue: '请将当前邮件正文排版为极简风格：最少装饰、大量留白、精简排版、突出核心内容。输出优化后的完整HTML。' }) },
        { label: t('aiTypoNewsletter'), prompt: t('assistantPromptTypoNews', { defaultValue: '请将当前邮件正文排版为新闻简报风格：添加分隔线、标题样式、引用框、列表美化。输出优化后的完整HTML。' }) },
      ],
    },
    {
      id: 'polish',
      icon: Sparkles,
      label: t('assistantPolish', { defaultValue: '润色优化' }),
    },
    {
      id: 'precheck',
      icon: ShieldCheck,
      label: t('assistantPreCheck', { defaultValue: '发送前检查' }),
    },
  ], [t]);

  // ── 快捷操作处理 ──
  const handleQuickAction = useCallback((actionId: string, prompt?: string) => {
    const emailData = getEmailData();
    let finalPrompt = prompt || '';

    if (actionId === 'polish') {
      const body = emailData.emailBody || '';
      if (!body.trim()) {
        finalPrompt = '当前邮件正文为空，无法润色。请先撰写邮件正文。';
      } else {
        finalPrompt = `请润色优化以下邮件正文，改善措辞和结构，使其更加专业得体。保持原文核心意思不变。输出优化后的完整HTML。\n\n当前邮件正文：\n${body.slice(0, 3000)}`;
      }
    } else if (actionId === 'precheck') {
      const body = emailData.emailBody || '';
      const subject = emailData.subject || '';
      const recipients = emailData.recipients || [];
      finalPrompt = `请对以下邮件进行全面的发送前检查，包括：
1. 拼写和语法错误
2. 措辞是否得体专业
3. 是否提到了附件但可能忘记添加
4. 收件人地址格式是否正确
5. 主题是否恰当
6. 整体专业度评分（1-10分）
7. 改进建议

邮件信息：
- 主题：${subject || '（未填写）'}
- 收件人：${recipients.join(', ') || '（未填写）'}
- 正文：\n${body ? body.replace(/<[^>]*>/g, '').slice(0, 3000) : '（空）'}`;
    }

    if (finalPrompt) {
      setActiveSubMenu(null);
      sendMessage(finalPrompt);
    }
  }, [getEmailData, sendMessage]);

  // ── 渲染消息内容 ──
  const renderContent = useCallback((content: string, msgId: string, isAssistant: boolean) => {
    const parts: React.ReactNode[] = [];
    let lastIdx = 0;
    const re = /```([a-zA-Z]*)\s*\n([\s\S]*?)```/g;
    let match;
    let blockIdx = 0;

    while ((match = re.exec(content)) !== null) {
      if (match.index > lastIdx) {
        parts.push(
          <span key={`t${lastIdx}`} className="whitespace-pre-wrap">{content.slice(lastIdx, match.index)}</span>
        );
      }
      const codeLang = match[1] || 'code';
      const code = match[2].trim();
      const blockId = `${msgId}_b${blockIdx}`;

      // 检查是否是可执行的 JSON 操作
      let actionButton: React.ReactNode = null;
      if (codeLang === 'json' && isAssistant) {
        try {
          const obj = JSON.parse(code);
          if (obj.action === 'add_account') {
            actionButton = (
              <Button variant="outline" size="sm" className="h-6 px-2 text-xs gap-1"
                onClick={() => {
                  const { action: _a, ...rest } = obj;
                  addAccount(rest);
                }}>
                <UserPlus className="h-3 w-3" />
                {t('assistantAddAccount', { defaultValue: '添加此账户' })}
              </Button>
            );
          } else if (obj.action === 'add_signature') {
            actionButton = (
              <Button variant="outline" size="sm" className="h-6 px-2 text-xs gap-1"
                onClick={() => addSignature(obj.name, obj.content)}>
                <PenLine className="h-3 w-3" />
                {t('assistantAddSignature', { defaultValue: '添加此签名' })}
              </Button>
            );
          }
        } catch { /* 非操作JSON */ }
      }

      // HTML 代码块：显示"应用到正文"按钮
      let htmlApplyButton: React.ReactNode = null;
      if (codeLang === 'html' && isAssistant) {
        htmlApplyButton = (
          <Button variant="outline" size="sm" className="h-6 px-2 text-xs gap-1"
            onClick={() => applyToEmail('body', code)}>
            <ArrowRight className="h-3 w-3" />
            {t('assistantApplyToBody', { defaultValue: '应用到正文' })}
          </Button>
        );
      }

      parts.push(
        <div key={blockId} className="my-1.5 rounded border bg-muted/40 overflow-hidden">
          <div className="flex items-center justify-between px-2 py-0.5 bg-muted/60 border-b gap-1">
            <span className="text-xs text-muted-foreground font-mono">{codeLang}</span>
            <div className="flex items-center gap-1">
              {actionButton}
              {htmlApplyButton}
              <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs gap-0.5"
                onClick={() => handleCopy(code, blockId)}>
                {copiedId === blockId ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              </Button>
            </div>
          </div>
          <pre className="p-2 text-xs font-mono overflow-x-auto overflow-y-auto max-h-60 whitespace-pre select-text">{code}</pre>
        </div>
      );
      lastIdx = match.index + match[0].length;
      blockIdx++;
    }

    if (lastIdx < content.length) {
      const remaining = content.slice(lastIdx);
      // 未闭合代码块（流式生成中）
      const unclosedMatch = remaining.match(/```([a-zA-Z]*)\s*\n([\s\S]*)$/);
      if (unclosedMatch) {
        const beforeCode = remaining.slice(0, unclosedMatch.index);
        if (beforeCode) {
          parts.push(<span key={`t${lastIdx}`} className="whitespace-pre-wrap">{beforeCode}</span>);
        }
        const unclosedLang = unclosedMatch[1] || 'code';
        const unclosedCode = unclosedMatch[2];
        parts.push(
          <div key={`unc_${lastIdx}`} className="my-1.5 rounded border bg-muted/40 overflow-hidden">
            <div className="flex items-center justify-between px-2 py-0.5 bg-muted/60 border-b">
              <span className="text-xs text-muted-foreground font-mono">{unclosedLang}</span>
              <span className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="h-2.5 w-2.5 animate-spin" />生成中...</span>
            </div>
            <pre className="p-2 text-xs font-mono overflow-x-auto overflow-y-auto max-h-60 whitespace-pre select-text">{unclosedCode}</pre>
          </div>
        );
      } else {
        parts.push(<span key={`t${lastIdx}`} className="whitespace-pre-wrap">{remaining}</span>);
      }
    }

    // 对助手消息，如果没有代码块但内容看起来像邮件正文，添加通用"应用到正文"按钮
    if (isAssistant && blockIdx === 0 && content.length > 50) {
      // 不添加——只有 html 代码块才显示应用按钮
    }

    return parts;
  }, [copiedId, handleCopy, addAccount, addSignature, applyToEmail, t]);

  // ── 渲染 ──
  return (
    <div className="flex flex-col h-full min-h-0 border-l bg-background">
      {/* ═══ 顶部 ═══ */}
      <div className="flex-shrink-0 border-b">
        {/* 标题栏 */}
        <div className="flex items-center gap-1.5 px-2.5 py-1.5">
          <Mail className="h-4 w-4 text-blue-500" />
          <span className="text-base font-medium truncate">{t('assistantTitle', { defaultValue: '邮件 AI 助手' })}</span>

          {/* AI 服务选择器 */}
          {enabledServices.length >= 2 && (
            <Popover>
              <PopoverTrigger asChild>
                <button type="button"
                  className="text-xs px-2 py-0.5 rounded-full bg-muted hover:bg-accent text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 max-w-[120px]"
                  title={t('assistantSwitchService', { defaultValue: '切换 AI 服务' })}>
                  <span className="truncate">{effectiveService ? effectiveService.name : '全局默认'}</span>
                  <ChevronDown className="h-3 w-3 flex-shrink-0" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" side="bottom" className="w-48 p-1">
                <p className="text-xs font-medium text-muted-foreground px-2 py-1">选择 AI 服务</p>
                <button
                  className={`w-full text-left px-2 py-1.5 rounded text-sm transition-colors flex items-center gap-1.5 ${
                    !selectedServiceId ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium' : 'hover:bg-blue-500/10'
                  }`}
                  onClick={() => handleServiceChange('')}>
                  {!selectedServiceId && <Check className="h-3 w-3 flex-shrink-0" />}
                  <span className={!selectedServiceId ? '' : 'ml-[18px]'}>全局默认</span>
                </button>
                {enabledServices.map(svc => {
                  const isSelected = selectedServiceId === svc.id;
                  return (
                    <button key={svc.id}
                      className={`w-full text-left px-2 py-1.5 rounded text-sm transition-colors flex items-center gap-1.5 ${
                        isSelected ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium' : 'hover:bg-blue-500/10'
                      }`}
                      onClick={() => handleServiceChange(svc.id)}>
                      {isSelected && <Check className="h-3 w-3 flex-shrink-0" />}
                      <span className={isSelected ? '' : 'ml-[18px]'}>{svc.name}</span>
                    </button>
                  );
                })}
              </PopoverContent>
            </Popover>
          )}

          <div className="flex-1" />
          <Button variant="ghost" size="sm" className={`h-7 px-1.5 text-xs gap-0.5 ${promptOpen ? 'text-blue-500' : ''}`}
            onClick={() => setPromptOpen(v => !v)}
            title={t('assistantSystemPrompt', { defaultValue: '系统提示词' })}>
            <ScrollText className="h-3 w-3" />
          </Button>
          {messages.length > 0 && (
            <>
              <Button variant="ghost" size="sm" className="h-7 px-1.5 text-xs gap-0.5"
                onClick={handleExport} disabled={streaming}>
                <ArrowDownToLine className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 px-1.5 text-xs gap-0.5"
                onClick={handleClear} disabled={streaming}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </>
          )}
        </div>

        {/* 系统提示词编辑区 */}
        {promptOpen && (
          <div className="px-2 pb-2 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">系统提示词</span>
              <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs gap-0.5"
                onClick={handlePromptReset}>
                <RotateCcw className="h-3 w-3" />恢复默认
              </Button>
            </div>
            <textarea
              value={promptDraft}
              onChange={e => setPromptDraft(e.target.value)}
              onBlur={handlePromptSave}
              className="w-full resize-y rounded-md border bg-muted/30 px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-ring min-h-[80px] max-h-[200px]"
              rows={5}
              placeholder={systemPrompt}
            />
          </div>
        )}

        {/* 快捷操作按钮 */}
        <div className="flex items-center gap-1 px-2 pb-1.5 flex-wrap">
          {quickActions.map(action => {
            const Icon = action.icon;
            if (action.hasSubMenu && action.subOptions) {
              return (
                <Popover key={action.id} open={activeSubMenu === action.id} onOpenChange={(open) => setActiveSubMenu(open ? action.id : null)}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm"
                      className="h-7 px-2 text-xs gap-0.5"
                      disabled={streaming || !aiAvailable}>
                      <Icon className="h-3 w-3" />{action.label}
                      <ChevronDown className="h-2.5 w-2.5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" side="bottom" className="w-40 p-1">
                    {action.subOptions.map(opt => (
                      <button key={opt.label}
                        className="w-full text-left px-2 py-1.5 rounded text-xs hover:bg-accent transition-colors"
                        onClick={() => handleQuickAction(action.id, opt.prompt)}>
                        {opt.label}
                      </button>
                    ))}
                  </PopoverContent>
                </Popover>
              );
            }
            return (
              <Button key={action.id} variant="outline" size="sm"
                className="h-7 px-2 text-xs gap-0.5"
                disabled={streaming || !aiAvailable}
                onClick={() => handleQuickAction(action.id)}>
                <Icon className="h-3 w-3" />{action.label}
              </Button>
            );
          })}
        </div>
      </div>

      {/* ═══ 对话区 ═══ */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-2.5 py-2 space-y-3">
        {messages.length === 0 && !streaming && (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground/50 text-center px-4 gap-2">
            <Mail className="h-8 w-8" />
            <p className="text-base">{t('assistantTitle', { defaultValue: '邮件 AI 助手' })}</p>
            <p className="text-xs">{t('assistantEmptyHint', { defaultValue: '描述你的需求，或使用上方快捷操作。\n支持：撰写/排版/润色/翻译/回复/配置邮箱/生成签名 等' })}</p>
            {!aiAvailable && (
              <p className="text-xs text-destructive">请先在设置中配置 AI 服务</p>
            )}
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} className={`group/msg flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[95%] rounded-lg px-2.5 py-1.5 relative ${
              msg.role === 'user'
                ? 'bg-blue-600 text-white text-sm'
                : 'bg-muted/50 text-foreground text-sm'
            }`}>
              {msg.role === 'user' ? (
                <div className="flex items-start gap-1">
                  <span className="whitespace-pre-wrap flex-1">{msg.content}</span>
                  <button
                    className="opacity-0 group-hover/msg:opacity-100 transition-opacity flex-shrink-0 mt-0.5 p-0.5 rounded hover:bg-white/20"
                    onClick={() => handleCopy(msg.content, `user_${msg.id}`)}>
                    {copiedId === `user_${msg.id}` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {renderContent(msg.content, msg.id, true)}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* 流式响应 */}
        {streaming && (
          <div className="flex justify-start">
            <div className="max-w-[95%] rounded-lg px-2.5 py-1.5 text-sm bg-muted/50 text-foreground">
              {streamingContent ? (
                <div className="space-y-0.5">
                  {renderContent(streamingContent, '_streaming_', true)}
                </div>
              ) : (
                <span className="flex items-center gap-1 text-muted-foreground text-sm">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />思考中...
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ═══ 输入区 ═══ */}
      <div className="flex-shrink-0 border-t p-2 space-y-1.5">
        <textarea
          ref={inputRef}
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          placeholder={t('assistantInputPlaceholder', { defaultValue: '输入邮件需求、邮箱配置、或任何问题...' })}
          className="w-full resize-none rounded-md border bg-transparent px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          rows={3}
          disabled={streaming}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendMessage(inputValue);
            }
          }}
        />
        <div className="flex items-center gap-1.5">
          {/* 联网搜索 */}
          <Button variant="ghost" size="sm"
            className={`h-7 px-1.5 text-xs gap-0.5 ${enableWebSearch && providerCaps.webSearch ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}
            disabled={!providerCaps.webSearch}
            onClick={() => setEnableWebSearch(v => !v)}
            title={providerCaps.webSearch ? '联网搜索' : '当前模型不支持联网'}>
            <Globe className="h-3 w-3" />
          </Button>

          {/* 深度思考 */}
          <Button variant="ghost" size="sm"
            className="h-7 px-1.5 text-xs gap-0.5 text-muted-foreground"
            disabled={!providerCaps.thinking}
            title={providerCaps.thinking ? '深度思考' : '当前模型不支持深度思考'}>
            <Brain className="h-3 w-3" />
          </Button>

          <div className="flex-1" />

          {/* 发送/停止 */}
          {streaming ? (
            <Button variant="outline" size="icon" className="h-6 w-6 flex-shrink-0" onClick={handleStop}>
              <Square className="h-3 w-3" />
            </Button>
          ) : (
            <Button variant="default" size="icon"
              className="h-6 w-6 flex-shrink-0 bg-blue-600 hover:bg-blue-700"
              onClick={() => sendMessage(inputValue)}
              disabled={!inputValue.trim() || !aiAvailable}>
              <Send className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
