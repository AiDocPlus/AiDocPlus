import { useState, useCallback, useEffect, useRef } from 'react';
import type { PluginPanelProps } from '../types';
import { usePluginHost } from '../_framework/PluginHostAPI';
import {
  Button, Input, Label,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '../_framework/ui';
import { Send, Settings, Loader2, ChevronDown, ChevronUp, FileText, Wand2, ImagePlus, History, Trash2, Plug } from 'lucide-react';
import { AIContentDialog } from '../_framework/AIContentDialog';
import { WechatConnectionDialog } from './WechatAccountDialog';
import type { WechatApiConfig, WechatApiProvider } from './wechatApiProvider';
import { createProvider } from './wechatApiProvider';
import { WechatBodyEditor } from './WechatBodyEditor';
import { WECHAT_TEMPLATES, applyTemplate } from './wechatTemplates';
import { markdownToWechatHtml, extractDigest } from './wechatHtmlAdapter';

/**
 * 执行 AI 生成的 Canvas 绘图 JS 代码，返回 PNG 数据
 * AI 代码中可使用变量 ctx（CanvasRenderingContext2D）、W（宽）、H（高）
 */
async function executeCanvasCode(jsCode: string, width: number, height: number): Promise<Uint8Array> {
  const canvas = window.document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 不可用');

  // 用 Function 构造器执行 AI 生成的绘图代码
  // eslint-disable-next-line no-new-func
  const drawFn = new Function('ctx', 'W', 'H', jsCode);
  await drawFn(ctx, width, height);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) { reject(new Error('PNG 导出失败')); return; }
      blob.arrayBuffer().then(buf => resolve(new Uint8Array(buf))).catch(reject);
    }, 'image/png');
  });
}

interface LogEntry {
  time: string;
  level: 'info' | 'error' | 'success';
  msg: string;
}

/** 全局存储（跨文档共享） */
interface WechatGlobalData {
  apiConfig?: WechatApiConfig;
  accountName?: string;
  tokenCache?: { accessToken: string; expiresAt: number };
  publishHistory?: WechatPublishHistoryEntry[];
}

/** 发布历史条目 */
interface WechatPublishHistoryEntry {
  timestamp: number;
  title: string;
  mediaId?: string;
  accountEmail?: string;
  status: 'success' | 'error';
  statusMsg?: string;
  documentId?: string;
}

/** 文档级存储（随文档保存） */
interface WechatDocData {
  articleTitle?: string;
  author?: string;
  digest?: string;
  thumbPath?: string;
  thumbBase64?: string;
  articleBody?: string;
  activeTemplateId?: string;
  contentSourceUrl?: string;
  needOpenComment?: boolean;
  onlyFansCanComment?: boolean;
}

const AI_STYLES = [
  { label: '优化公众号排版', prompt: '请将以下文档内容优化为适合微信公众号阅读的格式。保持内容不变，优化段落结构、添加适当的小标题、使关键信息更突出。' },
  { label: '生成文章摘要', prompt: '请为以下文档内容生成一段 54 字以内的精炼摘要，用于微信公众号文章的摘要展示。只输出摘要文本。' },
  { label: '优化标题（3个备选）', prompt: '请为以下文档内容生成 3 个适合微信公众号的标题备选，每行一个。标题要吸引读者点击但不标题党。' },
];

const DEFAULT_AI_PROMPT = '请将以下文档内容优化为适合微信公众号发布的格式，保持核心内容不变。';

const SYSTEM_PROMPT = '你是一位资深的微信公众号运营专家。根据用户提供的文档内容和要求，优化内容使其更适合微信公众号发布。注意排版美观、段落清晰、重点突出。';

export function WechatPublishPanel({ document, content, pluginData, onPluginDataChange }: PluginPanelProps) {
  const host = usePluginHost();
  const t = host.platform.t;

  // ── 全局存储（连接配置、发布历史） ──
  const globalStored = host.storage.get<WechatGlobalData>('wechatData') || {};
  const defaultConfig: WechatApiConfig = { mode: 'direct', direct: { appid: '', secret: '' } };
  const [apiConfig, setApiConfig] = useState<WechatApiConfig>(globalStored.apiConfig || defaultConfig);
  const [tokenCache, setTokenCache] = useState<{ accessToken: string; expiresAt: number } | undefined>(globalStored.tokenCache);
  const [connectionDialogOpen, setConnectionDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [historyPreviewIdx, setHistoryPreviewIdx] = useState<number | null>(null);

  // ── 文档级存储（表单状态、封面图） ──
  const docData = (pluginData as WechatDocData | null) || {};
  const [articleTitle, setArticleTitle] = useState(docData.articleTitle || document.title || '');
  const [author, setAuthor] = useState(docData.author || '');
  const [digest, setDigest] = useState(docData.digest || '');
  const [thumbPath, setThumbPath] = useState(docData.thumbPath || '');
  const [thumbBase64, setThumbBase64] = useState(docData.thumbBase64 || '');
  const [contentSourceUrl, setContentSourceUrl] = useState(docData.contentSourceUrl || '');
  const [needOpenComment, setNeedOpenComment] = useState(docData.needOpenComment ?? false);
  const [onlyFansCanComment, setOnlyFansCanComment] = useState(docData.onlyFansCanComment ?? false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [articleBody, setArticleBody] = useState(docData.articleBody || '');
  const [activeTemplateId, setActiveTemplateId] = useState(docData.activeTemplateId || '');

  const [publishing, setPublishing] = useState(false);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [generatingThumb, setGeneratingThumb] = useState(false);
  const [thumbPreviewUrl, setThumbPreviewUrl] = useState(docData.thumbBase64 || '');
  const [editorMaximized, setEditorMaximized] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logExpanded, setLogExpanded] = useState(false);
  const logContainerRef = useRef<HTMLDivElement | null>(null);

  const appendLog = useCallback((msg: string, level: LogEntry['level'] = 'info') => {
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    setLogs(prev => [...prev, { time, level, msg }]);
  }, []);

  useEffect(() => {
    const el = logContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs]);

  const publishHistory: WechatPublishHistoryEntry[] = globalStored.publishHistory || [];

  const saveGlobal = useCallback((updates: Partial<WechatGlobalData>) => {
    const current = host.storage.get<WechatGlobalData>('wechatData') || {};
    host.storage.set('wechatData', { ...current, ...updates });
  }, [host.storage]);

  const saveDocData = useCallback((updates: Partial<WechatDocData>) => {
    const current = (pluginData as WechatDocData | null) || {};
    onPluginDataChange({ ...current, ...updates });
  }, [pluginData, onPluginDataChange]);

  useEffect(() => {
    const md = content || document.aiGeneratedContent || document.content || '';
    if (md && !digest) {
      setDigest(extractDigest(md));
    }
  }, [content, document, digest]);

  const isConfigured = (() => {
    switch (apiConfig.mode) {
      case 'direct': return !!(apiConfig.direct?.appid && apiConfig.direct?.secret);
      case 'cloudrun': return !!(apiConfig.cloudrun?.baseUrl && apiConfig.cloudrun?.apiKey);
      case 'proxy': return !!apiConfig.proxy?.baseUrl;
      case 'thirdparty': return !!(apiConfig.thirdparty?.providerUrl && apiConfig.thirdparty?.authToken);
      default: return false;
    }
  })();
  const isConnected = !!(tokenCache && tokenCache.expiresAt > Date.now());

  const getProvider = useCallback((): WechatApiProvider => {
    return createProvider(host, apiConfig);
  }, [host, apiConfig]);

  const getAccessToken = useCallback(async (): Promise<string> => {
    if (!isConfigured) throw new Error(t('wxSelectAccountFirst'));
    if (tokenCache && tokenCache.expiresAt > Date.now() + 60000) {
      return tokenCache.accessToken;
    }
    appendLog(t('wxRefreshingToken'), 'info');
    const provider = getProvider();
    const resp = await provider.getAccessToken();
    const newCache = { accessToken: resp.accessToken, expiresAt: Date.now() + resp.expiresIn * 1000 };
    setTokenCache(newCache);
    saveGlobal({ tokenCache: newCache });
    appendLog(t('wxTokenRefreshed'), 'success');
    return resp.accessToken;
  }, [isConfigured, tokenCache, host, t, appendLog, saveGlobal, getProvider]);

  const handleConnect = useCallback(async () => {
    if (!isConfigured) { appendLog(t('wxSelectAccountFirst'), 'error'); setLogExpanded(true); return; }
    setConnecting(true);
    setLogExpanded(true);
    try {
      await getAccessToken();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      appendLog(t('wxConnectFailed', { error: msg }), 'error');
    } finally {
      setConnecting(false);
    }
  }, [isConfigured, getAccessToken, t, appendLog]);

  const handleBodyChange = useCallback((html: string) => {
    setArticleBody(html);
    saveDocData({ articleBody: html });
  }, [saveDocData]);

  // ── AI 生成封面图 ──
  const handleGenerateThumb = useCallback(async () => {
    const bodyText = articleBody.replace(/<[^>]*>/g, '').trim();
    if (!bodyText) {
      appendLog(t('wxNoContent'), 'error');
      setLogExpanded(true);
      return;
    }

    setGeneratingThumb(true);
    setLogExpanded(true);
    appendLog(t('wxThumbGenerating'), 'info');

    try {
      const title = articleTitle || document.title || t('wxUntitled');
      const bodyExcerpt = bodyText.slice(0, 800);

      const aiResult = await host.ai.chat(
        [
          {
            role: 'system',
            content: `你是一位顶级的视觉设计师。根据文章内容，生成一段 JavaScript Canvas 2D 绘图代码，用于绘制 900×383 像素的微信公众号封面图。

代码环境：
- 可用变量：ctx（CanvasRenderingContext2D）、W=900（画布宽）、H=383（画布高）
- 只输出函数体内的 JS 代码，不要 function 声明、不要 \`\`\` 标记、不要任何解释文字
- 不能使用 import、require、Image()、fetch 等外部资源

设计要求：
1. 先绘制丰富的背景：使用 createLinearGradient / createRadialGradient 创建多层渐变，颜色要与文章主题匹配
2. 添加装饰元素：用 arc()、rect()、moveTo/lineTo 等绘制几何图形（圆形、线条、多边形、网格点阵等），营造层次感和设计感
3. 可以用半透明色叠加多个装饰层，制造深度效果
4. 标题文字放在视觉焦点位置（左侧偏上或居中），字号 36-48px，加粗，白色或浅色
5. 用 ctx.shadowColor/shadowBlur 给文字加阴影确保可读性
6. 从正文提炼 2-4 个关键词，以小标签形式展示在画面下方或角落（圆角矩形背景 + 小字）
7. 字体统一用："PingFang SC", "Microsoft YaHei", sans-serif
8. 整体风格：现代、专业、有设计感，色彩丰富但和谐

示例结构（仅供参考格式，不要照抄）：
// 背景渐变
var bg = ctx.createLinearGradient(0, 0, W, H);
bg.addColorStop(0, '#1a1a2e'); bg.addColorStop(1, '#16213e');
ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
// 装饰圆
ctx.globalAlpha = 0.15;
ctx.fillStyle = '#e94560';
ctx.beginPath(); ctx.arc(700, 80, 120, 0, Math.PI*2); ctx.fill();
// ... 更多装饰
ctx.globalAlpha = 1;
// 标题
ctx.font = 'bold 42px "PingFang SC", sans-serif';
ctx.fillStyle = '#fff';
ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 10;
ctx.fillText('标题文字', 60, 180);`,
          },
          {
            role: 'user',
            content: `请根据以下文章内容设计封面图：\n\n【标题】${title}\n\n【正文节选】\n${bodyExcerpt}`,
          },
        ],
        { maxTokens: 3072 }
      );

      // 提取 JS 代码
      let jsCode = aiResult.trim();
      const codeBlockMatch = jsCode.match(/```(?:javascript|js)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) {
        jsCode = codeBlockMatch[1].trim();
      }
      // 移除可能的 function 包裹
      jsCode = jsCode.replace(/^(async\s+)?function\s*\w*\s*\([^)]*\)\s*\{/, '').replace(/\}\s*$/, '');

      if (!jsCode || jsCode.length < 50) {
        throw new Error(t('wxThumbAiInvalidResult'));
      }

      appendLog(t('wxThumbRendering'), 'info');

      // 直接执行 Canvas 绘图代码生成 PNG
      const pngData = await executeCanvasCode(jsCode, 900, 383);

      // 保存到临时目录
      const tempDir = await host.platform.invoke<string>('get_temp_dir', {});
      const fileName = `wechat_cover_${Date.now()}.png`;
      const filePath = `${tempDir}/${fileName}`;

      await host.platform.invoke('write_binary_file', {
        path: filePath,
        data: Array.from(pngData),
      });

      setThumbPath(filePath);
      // 生成 base64 data URL 用于预览和文档级持久化
      const base64Chunks: string[] = [];
      const bytes = new Uint8Array(pngData);
      for (let i = 0; i < bytes.length; i += 8192) {
        base64Chunks.push(String.fromCharCode(...bytes.subarray(i, i + 8192)));
      }
      const b64 = 'data:image/png;base64,' + btoa(base64Chunks.join(''));
      setThumbBase64(b64);
      setThumbPreviewUrl(b64);
      saveDocData({ thumbPath: filePath, thumbBase64: b64 });

      appendLog(t('wxThumbGenerated', { path: filePath }), 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      appendLog(t('wxThumbGenerateFailed', { error: msg }), 'error');
    } finally {
      setGeneratingThumb(false);
    }
  }, [articleBody, articleTitle, document.title, host, t, appendLog, saveDocData]);

  // 发布时如果临时文件不存在，从 base64 恢复
  const ensureThumbFile = useCallback(async (path: string, b64: string): Promise<string> => {
    if (!b64) return path;
    try {
      // 尝试直接使用路径，如果文件不存在会在上传时报错
      // 这里预先从 base64 恢复到临时文件
      const tempDir = await host.platform.invoke<string>('get_temp_dir', {});
      const fileName = `wechat_cover_${Date.now()}.png`;
      const filePath = `${tempDir}/${fileName}`;
      const raw = atob(b64.replace(/^data:image\/\w+;base64,/, ''));
      const arr = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
      await host.platform.invoke('write_binary_file', { path: filePath, data: Array.from(arr) });
      return filePath;
    } catch {
      return path;
    }
  }, [host]);

  const handlePublish = useCallback(async () => {
    if (!articleBody.trim()) { appendLog(t('wxNoContent'), 'error'); setLogExpanded(true); return; }
    if (!isConfigured) { appendLog(t('wxSelectAccountFirst'), 'error'); setLogExpanded(true); return; }
    if (!thumbPath.trim() && !thumbBase64) { appendLog(t('wxThumbRequired'), 'error'); setLogExpanded(true); return; }

    setPublishing(true);
    setLogExpanded(true);

    const pubTitle = articleTitle || document.title || t('wxUntitled');
    const provider = getProvider();
    const accountLabel = globalStored.accountName || apiConfig.mode;
    try {
      const accessToken = await getAccessToken();

      // 确保封面图文件存在
      let uploadPath = thumbPath;
      if (thumbBase64) {
        uploadPath = await ensureThumbFile(thumbPath, thumbBase64);
      }

      appendLog(t('wxUploadingThumb'), 'info');
      const thumbResp = await provider.uploadThumb(accessToken, uploadPath);
      appendLog(t('wxThumbUploaded', { mediaId: thumbResp.mediaId }), 'success');

      // 发布时应用模板样式
      let finalContent = articleBody;
      if (activeTemplateId) {
        const tmpl = WECHAT_TEMPLATES.find(t => t.id === activeTemplateId);
        if (tmpl) finalContent = applyTemplate(finalContent, tmpl);
      }

      // 上传正文中的图片到微信（base64/本地图片 → 微信URL）
      const imgRegex = /<img[^>]+src="([^"]+)"[^>]*>/gi;
      const imgMatches = [...finalContent.matchAll(imgRegex)];
      const imagesToUpload = imgMatches.filter(m => !m[1].startsWith('http://mmbiz.qpic.cn') && !m[1].startsWith('https://mmbiz.qpic.cn'));
      if (imagesToUpload.length > 0) {
        appendLog(t('wxUploadingImages', { count: imagesToUpload.length }), 'info');
        for (let i = 0; i < imagesToUpload.length; i++) {
          const match = imagesToUpload[i];
          const src = match[1];
          try {
            let filePath: string;
            if (src.startsWith('data:image/')) {
              // base64 → 临时文件
              const mimeMatch = src.match(/^data:image\/(\w+);base64,/);
              const ext = mimeMatch ? mimeMatch[1].replace('jpeg', 'jpg') : 'png';
              const tempDir = await host.platform.invoke<string>('get_temp_dir', {});
              filePath = `${tempDir}/wx_img_${Date.now()}_${i}.${ext}`;
              const raw = atob(src.replace(/^data:image\/\w+;base64,/, ''));
              const arr = new Uint8Array(raw.length);
              for (let j = 0; j < raw.length; j++) arr[j] = raw.charCodeAt(j);
              await host.platform.invoke('write_binary_file', { path: filePath, data: Array.from(arr) });
            } else {
              filePath = src;
            }
            const imgResp = await provider.uploadContentImage(accessToken, filePath);
            finalContent = finalContent.replace(src, imgResp.url);
            appendLog(t('wxImageUploaded', { index: i + 1, total: imagesToUpload.length }), 'info');
          } catch (imgErr) {
            const imgMsg = imgErr instanceof Error ? imgErr.message : String(imgErr);
            appendLog(t('wxImageUploadFailed', { index: i + 1, error: imgMsg }), 'error');
          }
        }
      }

      // 自动摘要
      const finalDigest = digest || extractDigest(finalContent.replace(/<[^>]*>/g, ''));

      appendLog(t('wxAddingDraft'), 'info');
      const draftResp = await provider.addDraft(accessToken, {
        title: pubTitle,
        content: finalContent,
        thumbMediaId: thumbResp.mediaId,
        author: author || undefined,
        digest: finalDigest || undefined,
        contentSourceUrl: contentSourceUrl || undefined,
        needOpenComment: needOpenComment ? 1 : 0,
        onlyFansCanComment: onlyFansCanComment ? 1 : 0,
        picCrop235_1: '0_0_1_1',
        picCrop1_1: '0.1325_0_0.8675_1',
      });

      appendLog(t('wxDraftSuccess', { mediaId: draftResp.mediaId }), 'success');
      appendLog(t('wxDraftHint'), 'info');

      // 保存文档级状态
      saveDocData({ articleTitle: pubTitle, author, digest, thumbPath, thumbBase64, articleBody, contentSourceUrl, needOpenComment, onlyFansCanComment });

      // 记录发布历史（全局）
      const historyEntry: WechatPublishHistoryEntry = {
        timestamp: Date.now(), title: pubTitle, mediaId: draftResp.mediaId,
        accountEmail: accountLabel, status: 'success',
        statusMsg: draftResp.mediaId, documentId: document.id,
      };
      const history = [historyEntry, ...publishHistory].slice(0, 50);
      saveGlobal({ publishHistory: history });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      appendLog(t('wxPublishFailed', { error: msg }), 'error');
      // 记录失败历史
      const historyEntry: WechatPublishHistoryEntry = {
        timestamp: Date.now(), title: pubTitle, status: 'error',
        accountEmail: accountLabel, statusMsg: msg, documentId: document.id,
      };
      const history = [historyEntry, ...publishHistory].slice(0, 50);
      saveGlobal({ publishHistory: history });
    } finally {
      setPublishing(false);
    }
  }, [articleBody, isConfigured, thumbPath, thumbBase64, articleTitle, author, digest, contentSourceUrl, needOpenComment, onlyFansCanComment, activeTemplateId, document.title, document.id, host, t, appendLog, getAccessToken, getProvider, saveGlobal, saveDocData, publishHistory, ensureThumbFile, apiConfig.mode, globalStored.accountName]);

  const handleAIGenerated = useCallback((aiContent: string) => {
    if (aiContent.length < 100) {
      setDigest(aiContent.trim().slice(0, 120));
      saveDocData({ digest: aiContent.trim().slice(0, 120) });
      appendLog(t('wxAiDigestGenerated'), 'success');
    } else {
      const html = markdownToWechatHtml(aiContent);
      setArticleBody(html);
      saveDocData({ articleBody: html });
      appendLog(t('wxAiContentOptimized'), 'success');
    }
  }, [t, appendLog, saveDocData]);

  const referenceContent = content || document.aiGeneratedContent || document.content || '';

  const handleConfigSave = useCallback((cfg: WechatApiConfig) => {
    setApiConfig(cfg);
    setTokenCache(undefined); // 切换配置后清空 token 缓存
    saveGlobal({ apiConfig: cfg, tokenCache: undefined });
  }, [saveGlobal]);

  return (
    <>
      <div className="h-full flex flex-col">
        {/* ---- 工具栏 ---- */}
        {!editorMaximized && <div className="flex items-center gap-1 px-2 py-1 border-b bg-muted/30 flex-shrink-0 flex-wrap">
          <Button
            variant="outline" size="sm"
            disabled={publishing || !isConfigured || !thumbPath.trim() || !articleBody.trim()}
            onClick={handlePublish}
            className="gap-1 h-7 text-xs"
            style={!publishing && isConfigured && thumbPath.trim() && articleBody.trim() ? { borderColor: '#07C160', color: '#07C160' } : {}}
          >
            {publishing
              ? <><Loader2 className="h-3 w-3 animate-spin" />{t('wxPublishing')}</>
              : <><Send className="h-3 w-3" />{t('wxSendToDraft')}</>
            }
          </Button>

          <div className="w-px h-4 bg-border mx-0.5" />

          <Button variant="outline" size="sm" className="gap-1 h-7 text-xs"
            onClick={() => setConnectionDialogOpen(true)}>
            <Settings className="h-3 w-3" />
            {isConfigured ? (globalStored.accountName || t('wxModeLabel_' + apiConfig.mode)) : t('wxSetupAccount')}
          </Button>

          {isConfigured && (
            <Button variant="outline" size="sm" className="gap-1 h-7 text-xs"
              disabled={connecting || isConnected}
              onClick={handleConnect}
              style={!connecting && !isConnected ? { borderColor: '#07C160', color: '#07C160' } : isConnected ? { borderColor: '#07C160', color: '#07C160', opacity: 0.7 } : {}}>
              {connecting
                ? <><Loader2 className="h-3 w-3 animate-spin" />{t('wxConnecting')}</>
                : isConnected
                  ? <><Plug className="h-3 w-3" />{t('wxConnected')}</>
                  : <><Plug className="h-3 w-3" />{t('wxConnect')}</>}
            </Button>
          )}

          <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={() => setAiDialogOpen(true)}>
            <Wand2 className="h-3 w-3" />
            {t('wxAiOptimize')}
          </Button>

          <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={() => setHistoryDialogOpen(true)}>
            <History className="h-3 w-3" />
            {t('wxHistory')}
          </Button>

          <div className="flex-1" />

          {isConfigured && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-300'}`} />
              <span className="text-muted-foreground">{isConnected ? t('wxConnected') : t('wxDisconnected')}</span>
            </div>
          )}
        </div>}

        {/* ---- 功能区 ---- */}
        <div className="flex-1 min-h-0 flex flex-col" style={{ fontFamily: '宋体', fontSize: '16px' }}>

          {/* 未配置欢迎页 */}
          {!isConfigured && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-4 px-8">
                <div className="w-20 h-20 mx-auto rounded-2xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #07C160 0%, #06AD56 100%)' }}>
                  <Send className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-lg font-medium text-muted-foreground">{t('wxWelcomeTitle')}</h3>
                <p className="text-sm text-muted-foreground/70 max-w-sm">{t('wxWelcomeDesc')}</p>
                <Button variant="outline" size="sm" className="gap-1"
                  style={{ borderColor: '#07C160', color: '#07C160' }}
                  onClick={() => setConnectionDialogOpen(true)}>
                  <Settings className="h-4 w-4" />
                  {t('wxSetupAccount')}
                </Button>
              </div>
            </div>
          )}

          {/* 已配置：表单 + 编辑器 */}
          {isConfigured && (
            <>
              {/* ── 表单区（可滚动，最大占 40%） ── */}
              {!editorMaximized && <div className="px-3 py-2 space-y-2 flex-shrink-0 border-b overflow-y-auto" style={{ maxHeight: '40%' }}>
                <div className="flex items-center gap-2">
                  <Label className="text-xs font-medium w-14 flex-shrink-0">{t('wxArticleTitle')}</Label>
                  <Input value={articleTitle} onChange={e => { setArticleTitle(e.target.value); saveDocData({ articleTitle: e.target.value }); }}
                    placeholder={t('wxArticleTitlePlaceholder')} className="text-sm flex-1" />
                </div>

                <div className="flex items-center gap-2">
                  <Label className="text-xs font-medium w-14 flex-shrink-0">{t('wxAuthor')}</Label>
                  <Input value={author} onChange={e => { setAuthor(e.target.value); saveDocData({ author: e.target.value }); }}
                    placeholder={t('wxAuthorPlaceholder')} className="text-sm flex-1" />
                </div>

                <div className="flex items-center gap-2">
                  <Label className="text-xs font-medium w-14 flex-shrink-0">{t('wxDigest')}</Label>
                  <Input value={digest} onChange={e => { setDigest(e.target.value); saveDocData({ digest: e.target.value }); }}
                    placeholder={t('wxDigestPlaceholder')} className="text-sm flex-1" maxLength={120} />
                  <span className="text-xs text-muted-foreground flex-shrink-0">{digest.length}/120</span>
                </div>

                <div className="flex items-center gap-2">
                  <Label className="text-xs font-medium w-14 flex-shrink-0">{t('wxThumb')} <span className="text-destructive">*</span></Label>
                  <Input value={thumbPath} onChange={e => { setThumbPath(e.target.value); setThumbPreviewUrl(''); saveDocData({ thumbPath: e.target.value }); }}
                    placeholder={t('wxThumbPlaceholder')} className="text-sm flex-1 font-mono" />
                  <Button variant="outline" size="sm" className="gap-1 h-7 text-xs flex-shrink-0"
                    disabled={generatingThumb || !articleBody.trim()}
                    onClick={handleGenerateThumb}
                    style={!generatingThumb && articleBody.trim() ? { borderColor: '#07C160', color: '#07C160' } : {}}>
                    {generatingThumb
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : <ImagePlus className="h-3 w-3" />}
                    {t('wxThumbAiGenerate')}
                  </Button>
                </div>
                {thumbPreviewUrl && (
                  <div className="ml-16 mt-1">
                    <img src={thumbPreviewUrl} alt="cover preview" className="rounded border h-[24px] object-cover" />
                  </div>
                )}

                {/* 高级选项 */}
                <button
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                >
                  {showAdvanced ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  {t('wxAdvancedOptions')}
                </button>

                {showAdvanced && (
                  <div className="space-y-2 pl-2 border-l-2 border-muted">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs font-medium w-14 flex-shrink-0">{t('wxContentSourceUrl')}</Label>
                      <Input value={contentSourceUrl} onChange={e => { setContentSourceUrl(e.target.value); saveDocData({ contentSourceUrl: e.target.value }); }}
                        placeholder="https://..." className="text-sm font-mono flex-1" />
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={needOpenComment}
                        onChange={e => { setNeedOpenComment(e.target.checked); saveDocData({ needOpenComment: e.target.checked }); }} className="rounded border-border" />
                      <span className="text-xs">{t('wxOpenComment')}</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={onlyFansCanComment}
                        onChange={e => { setOnlyFansCanComment(e.target.checked); saveDocData({ onlyFansCanComment: e.target.checked }); }} className="rounded border-border"
                        disabled={!needOpenComment} />
                      <span className="text-xs">{t('wxOnlyFansComment')}</span>
                    </label>
                  </div>
                )}
              </div>}

              {/* ── 正文编辑器（撑满剩余空间，高度固定） ── */}
              <div className="flex-1 min-h-0 flex flex-col">
                <WechatBodyEditor
                  value={articleBody}
                  onChange={handleBodyChange}
                  placeholder={t('wxEditorPlaceholder')}
                  t={t}
                  maximized={editorMaximized}
                  onToggleMaximize={() => setEditorMaximized(m => !m)}
                  articleTitle={articleTitle}
                  author={author}
                  thumbPreviewUrl={thumbPreviewUrl}
                  activeTemplateId={activeTemplateId}
                  onTemplateChange={(id) => { setActiveTemplateId(id || ''); saveDocData({ activeTemplateId: id || '' }); }}
                />
              </div>
            </>
          )}
        </div>

        {/* ---- 状态区 ---- */}
        {!editorMaximized && <div className="px-2 py-1 border-t flex-shrink-0">
          <div className="flex items-center justify-between cursor-pointer select-none"
            onClick={() => setLogExpanded(!logExpanded)}>
            <Label className="text-xs text-muted-foreground flex items-center gap-1 cursor-pointer">
              <FileText className="h-3 w-3" />
              {t('wxWorkStatus')}
              {logs.length > 0 && <span className="ml-1 text-muted-foreground/60">({logs.length})</span>}
            </Label>
            <div className="flex items-center gap-1">
              {logs.length > 0 && (
                <Button variant="ghost" size="sm" className="h-5 px-1.5 text-xs text-muted-foreground"
                  onClick={e => { e.stopPropagation(); setLogs([]); }}>
                  {t('wxClearLog')}
                </Button>
              )}
              <span className="text-xs text-muted-foreground">{logExpanded ? '\u25B2' : '\u25BC'}</span>
            </div>
          </div>
          {logExpanded && (
            <div ref={logContainerRef}
              className="h-[100px] overflow-y-auto border rounded-md bg-muted/30 px-2 py-1 font-mono text-xs leading-relaxed mt-1">
              {logs.length === 0 ? (
                <p className="text-muted-foreground/50 text-center pt-8">{t('wxLogEmpty')}</p>
              ) : (
                logs.map((entry, i) => (
                  <div key={i} className={
                    entry.level === 'error' ? 'text-red-500' :
                    entry.level === 'success' ? 'text-green-600 dark:text-green-400' :
                    'text-muted-foreground'
                  }>
                    <span className="text-muted-foreground/60">[{entry.time}]</span>{' '}{entry.msg}
                  </div>
                ))
              )}
            </div>
          )}
        </div>}
      </div>

      {/* 连接设置对话框 */}
      <WechatConnectionDialog
        open={connectionDialogOpen}
        onOpenChange={setConnectionDialogOpen}
        config={apiConfig}
        onSave={handleConfigSave}
        host={host}
        t={t}
      />

      {/* AI 优化对话框 */}
      <AIContentDialog
        open={aiDialogOpen} onOpenChange={setAiDialogOpen}
        title={t('wxAiOptimize')} description={t('wxAiOptimizeDesc')}
        systemPrompt={SYSTEM_PROMPT} referenceContent={referenceContent}
        onGenerated={handleAIGenerated} presetPrompts={AI_STYLES}
        defaultPrompt={DEFAULT_AI_PROMPT} maxTokens={4096}
      />

      {/* 发布历史弹窗 */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="sm:max-w-[680px] max-h-[80vh] overflow-hidden flex flex-col" style={{ fontFamily: '宋体', fontSize: '16px' }}>
          <DialogHeader>
            <DialogTitle>{t('wxHistoryTitle')}</DialogTitle>
            <DialogDescription>{t('wxHistoryDesc', { count: publishHistory.length })}</DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pt-1">
            {publishHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">{t('wxHistoryEmpty')}</p>
            ) : (
              publishHistory.map((item, idx) => {
                const isExpanded = historyPreviewIdx === idx;
                const date = new Date(item.timestamp);
                const timeStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
                return (
                  <div key={idx} className="border rounded-md overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/50"
                      onClick={() => setHistoryPreviewIdx(isExpanded ? null : idx)}>
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${item.status === 'success' ? 'bg-green-500' : 'bg-red-500'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{item.title || t('wxHistoryNoTitle')}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {item.accountEmail && `${t('wxHistoryFrom')}: ${item.accountEmail}`}
                          {item.mediaId && ` | media_id: ${item.mediaId}`}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                        <span className="text-xs text-muted-foreground">{timeStr}</span>
                        <span className={`text-xs ${item.status === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                          {item.status === 'success' ? t('wxHistorySuccess') : t('wxHistoryFailed')}
                        </span>
                      </div>
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
                    </div>
                    {isExpanded && item.statusMsg && (
                      <div className="border-t px-3 py-2 bg-muted/20">
                        <div className="text-xs">
                          <span className="text-muted-foreground">{t('wxHistoryResult')}:</span>{' '}
                          <span className={item.status === 'error' ? 'text-red-500' : ''}>{item.statusMsg}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
          <div className="flex justify-between pt-2 border-t">
            <Button variant="outline" size="sm" className="h-7 text-xs"
              onClick={() => setHistoryDialogOpen(false)}>
              {t('wxHistoryClose')}
            </Button>
            {publishHistory.length > 0 && (
              <Button variant="outline" size="sm" className="h-7 text-xs text-destructive hover:text-destructive"
                onClick={() => { saveGlobal({ publishHistory: [] }); setHistoryDialogOpen(false); }}>
                <Trash2 className="h-3 w-3 mr-1" />
                {t('wxHistoryClear')}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
