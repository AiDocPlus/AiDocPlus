/**
 * StockResearchWorkspace — 股票研究工作台
 *
 * 四栏布局：左栏（股票信息）| 中栏（编辑器）| 数据面板 | AI助手
 * 数据源：单文档 JSON（StockResearchDocumentContent）
 */
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Suspense, lazy } from 'react';
import type { DocTypeEditorProps } from '@/doctype-sdk/types';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { MarkdownEditor } from '@/components/editor/MarkdownEditor';
import { ResizableHandle } from '@/components/ui/resizable-handle';
import { useAppStore } from '@/stores/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import {
  PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen,
  Save, History, Download, X, XCircle,
  TrendingUp, BarChart3,
  ChevronDown, Plus,
  Clock, Users, LayoutDashboard,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent } from '@/components/ui/dialog';

// 懒加载版本历史面板
const VersionHistoryPanel = lazy(() => import('@/components/version/VersionHistoryPanel'));
import StockResearchAISidebar from './StockResearchAISidebar';
import { TushareSettingsPanel } from './TushareSettingsPanel';
import StockInfoPanel from './StockInfoPanel';
import StockDataPanel from './StockDataPanel';
import StockResearchStatusBar from './StockResearchStatusBar';
import StockResearchDashboard from './StockResearchDashboard';
import StockHistoryView from './StockHistoryView';
import StockComparisonPanel from './StockComparisonPanel';
import { ThesisPanel } from './dialogs';
import ResearchResultDialog from './dialogs/ResearchResultDialog';
import { applyResearchOutput } from './ai/outputParser';
import type { AIResearchOutput } from './ai/outputParser';
import {
  parseStockResearchContent, createEmptyStockResearchContent,
  updateStockInfo, updateFinancialMetrics, updateTechnicals,
  updatePhase, updateRiskAssessment,
  addThesis, updateThesis,
  addTrade, deleteTrade,
  addNews, deleteNews,
  addNote, updateNote, deleteNote, reorderNotes,
  addPeer, deletePeer,
  getCurrentPosition, calculateAverageCost, calculateTotalProfitLoss,
  type StockResearchDocumentContent, type StockInfo, type FinancialMetrics,
  type TechnicalIndicators, type InvestmentThesis, type TradeRecord,
  type StockNews, type ResearchNote, type RiskAssessment,
  type StockResearchPhase, type PeerComparison,
} from './types';
import {
  RESEARCH_PHASES, DEFAULT_LEFT_PANEL_WIDTH, DEFAULT_DATA_PANEL_WIDTH,
  DEFAULT_AI_PANEL_WIDTH, MIN_PANEL_WIDTH, MAX_PANEL_WIDTH,
  CONTENT_SAVE_DEBOUNCE_MS, SAVE_STATUS_DISPLAY_MS,
} from './constants';

// 中栏视图模式
type CenterViewMode = 'editor' | 'dashboard' | 'history' | 'comparison';

// 格式化数字
function formatNum(n: number | undefined | null, suffix = ''): string {
  if (n === undefined || n === null) return '-';
  return n.toFixed(2) + suffix;
}

// 生成 Markdown 研究报告
function generateMarkdownReport(r: StockResearchDocumentContent, t: (key: string, opts?: { defaultValue?: string }) => string): string {
  const { stock, financials, technicals, theses, trades, news, risk, peers } = r;
  const lines: string[] = [];

  // 标题
  lines.push(`# ${stock.name || stock.code || '股票研究报告'}`);
  lines.push('');
  lines.push(`> ${t('stockResearch.generatedAt', { defaultValue: '生成时间' })}: ${new Date().toLocaleString()}`);
  lines.push('');

  // 基本信息
  lines.push(`## ${t('stockResearch.basicInfo', { defaultValue: '基本信息' })}`);
  lines.push('');
  lines.push(`| ${t('stockResearch.code', { defaultValue: '代码' })} | ${t('stockResearch.name', { defaultValue: '名称' })} | ${t('stockResearch.market', { defaultValue: '市场' })} | ${t('stockResearch.industry', { defaultValue: '行业' })} |`);
  lines.push(`| --- | --- | --- | --- |`);
  lines.push(`| ${stock.code || '-'} | ${stock.name || '-'} | ${stock.market || '-'} | ${stock.industry || '-'} |`);
  lines.push('');
  if (stock.description) {
    lines.push(`**${t('stockResearch.companyDescription', { defaultValue: '公司简介' })}**: ${stock.description}`);
    lines.push('');
  }

  // 财务指标
  const f = financials.current;
  if (f) {
    lines.push(`## ${t('stockResearch.financialMetrics', { defaultValue: '财务指标' })}`);
    lines.push('');
    lines.push(`| 指标 | 数值 | 指标 | 数值 |`);
    lines.push(`| --- | --- | --- | --- |`);
    lines.push(`| PE | ${formatNum(f.pe)} | PB | ${formatNum(f.pb)} |`);
    lines.push(`| ROE | ${formatNum(f.roe, '%')} | ROA | ${formatNum(f.roa, '%')} |`);
    lines.push(`| ${t('stockResearch.grossMargin', { defaultValue: '毛利率' })} | ${formatNum(f.grossMargin, '%')} | ${t('stockResearch.netMargin', { defaultValue: '净利率' })} | ${formatNum(f.netMargin, '%')} |`);
    lines.push(`| ${t('stockResearch.revenue', { defaultValue: '营收' })} | ${formatNum(f.revenue, '亿')} | ${t('stockResearch.revenueGrowth', { defaultValue: '营收增长' })} | ${formatNum(f.revenueGrowth, '%')} |`);
    lines.push(`| ${t('stockResearch.netIncome', { defaultValue: '净利润' })} | ${formatNum(f.netIncome, '亿')} | ${t('stockResearch.netIncomeGrowth', { defaultValue: '净利润增长' })} | ${formatNum(f.netIncomeGrowth, '%')} |`);
    lines.push('');
  }

  // 技术指标
  if (technicals) {
    lines.push(`## ${t('stockResearch.technicalIndicators', { defaultValue: '技术指标' })}`);
    lines.push('');
    lines.push(`- **${t('stockResearch.currentPrice', { defaultValue: '当前价格' })}**: ${formatNum(technicals.price)}`);
    lines.push(`- **${t('stockResearch.changePercent', { defaultValue: '涨跌幅' })}**: ${formatNum(technicals.changePercent, '%')}`);
    lines.push(`- **${t('stockResearch.trend', { defaultValue: '趋势' })}**: ${technicals.trend || '-'}`);
    lines.push(`- **MA5/10/20/60**: ${formatNum(technicals.ma5)} / ${formatNum(technicals.ma10)} / ${formatNum(technicals.ma20)} / ${formatNum(technicals.ma60)}`);
    lines.push(`- **${t('stockResearch.support', { defaultValue: '支撑位' })}**: ${formatNum(technicals.support)} | **${t('stockResearch.resistance', { defaultValue: '阻力位' })}**: ${formatNum(technicals.resistance)}`);
    lines.push('');
  }

  // 投资论点
  if (theses.length > 0) {
    lines.push(`## ${t('stockResearch.investmentTheses', { defaultValue: '投资论点' })}`);
    lines.push('');
    theses.forEach((thesis) => {
      const statusIcon = thesis.status === 'bullish' ? '📈' : thesis.status === 'bearish' ? '📉' : '➖';
      lines.push(`### ${statusIcon} ${thesis.title}`);
      lines.push('');
      if (thesis.content) lines.push(thesis.content);
      if (thesis.bullishFactors?.length) {
        lines.push(`\n**${t('stockResearch.bullishFactors', { defaultValue: '看多因素' })}:**`);
        thesis.bullishFactors.forEach(f => lines.push(`- ${f}`));
      }
      if (thesis.bearishFactors?.length) {
        lines.push(`\n**${t('stockResearch.bearishFactors', { defaultValue: '看空因素' })}:**`);
        thesis.bearishFactors.forEach(f => lines.push(`- ${f}`));
      }
      lines.push('');
    });
  }

  // 风险评估
  if (risk) {
    lines.push(`## ${t('stockResearch.riskAssessment', { defaultValue: '风险评估' })}`);
    lines.push('');
    lines.push(`- **${t('stockResearch.riskLevel', { defaultValue: '风险等级' })}**: ${risk.level}`);
    if (risk.score !== undefined) lines.push(`- **${t('stockResearch.riskScore', { defaultValue: '风险评分' })}**: ${risk.score}/100`);
    if (risk.factors?.length) {
      lines.push(`\n**${t('stockResearch.riskFactors', { defaultValue: '风险因素' })}:**`);
      risk.factors.forEach(f => lines.push(`- ${f}`));
    }
    lines.push('');
  }

  // 新闻动态
  if (news.length > 0) {
    lines.push(`## ${t('stockResearch.recentNews', { defaultValue: '近期新闻' })}`);
    lines.push('');
    news.slice(0, 5).forEach(n => {
      const sentimentIcon = n.sentiment === 'positive' ? '🟢' : n.sentiment === 'negative' ? '🔴' : '⚪';
      lines.push(`### ${sentimentIcon} ${n.title}`);
      if (n.summary) lines.push(`> ${n.summary}`);
      lines.push('');
    });
  }

  // 对标公司
  if (peers.length > 0) {
    lines.push(`## ${t('stockResearch.peerComparison', { defaultValue: '对标公司' })}`);
    lines.push('');
    lines.push(`| ${t('stockResearch.code', { defaultValue: '代码' })} | ${t('stockResearch.name', { defaultValue: '名称' })} | ${t('stockResearch.advantage', { defaultValue: '相对优势' })} | ${t('stockResearch.disadvantage', { defaultValue: '相对劣势' })} |`);
    lines.push(`| --- | --- | --- | --- |`);
    peers.forEach(p => {
      lines.push(`| ${p.code || '-'} | ${p.name || '-'} | ${p.advantage || '-'} | ${p.disadvantage || '-'} |`);
    });
    lines.push('');
  }

  // 交易记录
  if (trades.length > 0) {
    lines.push(`## ${t('stockResearch.tradeRecords', { defaultValue: '交易记录' })}`);
    lines.push('');
    lines.push(`| ${t('stockResearch.date', { defaultValue: '日期' })} | ${t('stockResearch.type', { defaultValue: '类型' })} | ${t('stockResearch.price', { defaultValue: '价格' })} | ${t('stockResearch.quantity', { defaultValue: '数量' })} |`);
    lines.push(`| --- | --- | --- | --- |`);
    trades.forEach(tr => {
      lines.push(`| ${new Date(tr.executedAt).toLocaleDateString()} | ${tr.type} | ${tr.price} | ${tr.quantity} |`);
    });
    lines.push('');
  }

  return lines.join('\n');
}

export default function StockResearchWorkspace({ document: doc, host, tabId }: DocTypeEditorProps) {
  const { t } = useTranslation();
  const { closeTab, closeAllTabs } = useAppStore(useShallow(s => ({
    closeTab: s.closeTab, closeAllTabs: s.closeAllTabs,
  })));

  // ── 布局状态 ──
  const [leftWidth, setLeftWidth] = useState(DEFAULT_LEFT_PANEL_WIDTH);
  const [dataWidth, setDataWidth] = useState(DEFAULT_DATA_PANEL_WIDTH);
  const [aiWidth, setAiWidth] = useState(DEFAULT_AI_PANEL_WIDTH);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [dataCollapsed, setDataCollapsed] = useState(false);
  const [aiCollapsed, setAiCollapsed] = useState(false);
  const [focusMode, setFocusMode] = useState(false);

  // ── 视图模式状态 ──
  const [centerViewMode, setCenterViewMode] = useState<CenterViewMode>('dashboard');

  // ── 弹窗状态 ──
  const [thesisPanelOpen, setThesisPanelOpen] = useState(false);
  const [editingThesis, setEditingThesis] = useState<InvestmentThesis | null>(null);
  const [researchDialogOpen, setResearchDialogOpen] = useState(false);
  const [pendingResearchOutput, setPendingResearchOutput] = useState<AIResearchOutput | null>(null);

  // ── 版本历史状态 ──
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);

  const [tushareSettingsOpen, setTushareSettingsOpen] = useState(false);
  const [tushareRecheckNonce, setTushareRecheckNonce] = useState(0);

  // ── 保存状态 ──
  type SaveStatus = 'saved' | 'saving' | 'unsaved';
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
    };
  }, []);

  // ── 编辑状态 ──
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [noteContent, setNoteContent] = useState('');

  // ── 解析内容 ──
  const getResearch = useCallback((): StockResearchDocumentContent => {
    const d = host.doc.getDocument();
    return parseStockResearchContent(d.content || '') || createEmptyStockResearchContent();
  }, [host.doc]);

  const [research, setResearch] = useState<StockResearchDocumentContent>(getResearch);

  useEffect(() => {
    const r = getResearch();
    setResearch(r);
    // 恢复上次编辑的笔记
    const lastNoteId = host.storage.get<string>('_stock_last_note_id');
    if (lastNoteId) {
      const note = r.notes.find(n => n.id === lastNoteId);
      if (note) {
        setActiveNoteId(lastNoteId);
        setNoteContent(note.content);
      }
    }
  }, [doc.id, getResearch, host.storage]);

  // ── 保存逻辑 ──
  const saveResearch = useCallback((updated: StockResearchDocumentContent) => {
    setResearch(updated);
    host.doc.updateInMemory({ content: JSON.stringify(updated) });
    host.doc.markDirty();
    setSaveStatus('unsaved');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      setSaveStatus('saving');
      host.doc.save();
      saveTimerRef.current = null;
      if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
      saveStatusTimerRef.current = setTimeout(() => setSaveStatus('saved'), SAVE_STATUS_DISPLAY_MS);
    }, CONTENT_SAVE_DEBOUNCE_MS);
  }, [host.doc]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setSaveStatus('saving');
    try {
      host.doc.save();
      if (tabId) useAppStore.getState().markTabAsClean(tabId);
      setSaveStatus('saved');
    } catch {
      setSaveStatus('unsaved');
    } finally {
      setIsSaving(false);
    }
  }, [host.doc, tabId]);

  // ── 股票信息操作 ──
  const handleUpdateStockInfo = useCallback((patch: Partial<StockInfo>) => {
    saveResearch(updateStockInfo(research, patch));
  }, [research, saveResearch]);

  // ── 财务指标操作 ──
  const handleUpdateFinancials = useCallback((metrics: Partial<FinancialMetrics>) => {
    saveResearch(updateFinancialMetrics(research, metrics));
  }, [research, saveResearch]);

  // ── 技术指标操作 ──
  const handleUpdateTechnicals = useCallback((technicals: TechnicalIndicators | null) => {
    saveResearch(updateTechnicals(research, technicals));
  }, [research, saveResearch]);

  // ── 阶段操作 ──
  const handlePhaseChange = useCallback((phase: StockResearchPhase) => {
    saveResearch(updatePhase(research, phase));
  }, [research, saveResearch]);

  // ── 交易记录操作 ──
  const handleAddTrade = useCallback((trade: Omit<TradeRecord, 'id' | 'createdAt'>) => {
    saveResearch(addTrade(research, trade));
  }, [research, saveResearch]);

  const handleDeleteTrade = useCallback((tradeId: string) => {
    saveResearch(deleteTrade(research, tradeId));
  }, [research, saveResearch]);

  // ── 新闻操作 ──
  const handleAddNews = useCallback((news: Omit<StockNews, 'id' | 'createdAt'>) => {
    saveResearch(addNews(research, news));
  }, [research, saveResearch]);

  const handleDeleteNews = useCallback((newsId: string) => {
    saveResearch(deleteNews(research, newsId));
  }, [research, saveResearch]);

  // ── 风险评估操作 ──
  const handleUpdateRisk = useCallback((risk: RiskAssessment | null) => {
    saveResearch(updateRiskAssessment(research, risk));
  }, [research, saveResearch]);

  // ── 对标公司操作 ──
  const handleAddPeer = useCallback((peer: Omit<PeerComparison, 'id'>) => {
    saveResearch(addPeer(research, peer));
  }, [research, saveResearch]);

  const handleDeletePeer = useCallback((peerId: string) => {
    saveResearch(deletePeer(research, peerId));
  }, [research, saveResearch]);

  // ── 笔记操作 ──
  const handleSelectNote = useCallback((noteId: string | null, skipSave = false) => {
    // 保存当前笔记
    if (!skipSave && activeNoteId && noteContent !== undefined) {
      saveResearch(updateNote(research, activeNoteId, { content: noteContent }));
    }
    setActiveNoteId(noteId);
    if (noteId) {
      const note = research.notes.find(n => n.id === noteId);
      setNoteContent(note?.content || '');
      host.storage.set('_stock_last_note_id', noteId);
    } else {
      setNoteContent('');
    }
  }, [activeNoteId, noteContent, research, saveResearch, host.storage]);

  const handleNoteContentChange = useCallback((content: string) => {
    setNoteContent(content);
    setSaveStatus('unsaved');
    if (activeNoteId) {
      const updated = updateNote(research, activeNoteId, { content });
      setResearch(updated);
      host.doc.updateInMemory({ content: JSON.stringify(updated) });
      host.doc.markDirty();
    }
  }, [activeNoteId, research, host.doc]);

  const handleAddNote = useCallback(() => {
    const newNote: Omit<ResearchNote, 'id' | 'createdAt' | 'updatedAt'> = {
      title: `研究笔记 ${research.notes.length + 1}`,
      content: '',
      tags: [],
    };
    const updated = addNote(research, newNote);
    saveResearch(updated);
    const added = updated.notes[updated.notes.length - 1];
    handleSelectNote(added.id, true);  // 跳过保存，避免用旧 research 覆盖
  }, [research, saveResearch, handleSelectNote]);

  const handleDeleteNote = useCallback((noteId: string) => {
    saveResearch(deleteNote(research, noteId));
    if (activeNoteId === noteId) {
      setActiveNoteId(null);
      setNoteContent('');
    }
  }, [research, saveResearch, activeNoteId]);

  // ── 笔记重命名 ──
  const handleRenameNote = useCallback((noteId: string, newTitle: string) => {
    saveResearch(updateNote(research, noteId, { title: newTitle }));
  }, [research, saveResearch]);

  // ── 笔记排序 ──
  const handleReorderNotes = useCallback((noteIds: string[]) => {
    saveResearch(reorderNotes(research, noteIds));
  }, [research, saveResearch]);

  // ── AI 插入回调 ──
  const handleInsertToDoc = useCallback((text: string) => {
    if (activeNoteId) {
      setNoteContent(prev => prev + '\n\n' + text);
      handleNoteContentChange(noteContent + '\n\n' + text);
    }
  }, [activeNoteId, noteContent, handleNoteContentChange]);

  // ── 应用研究结果回调（弹出预览对话框） ──
  const handleApplyResearchResult = useCallback((output: AIResearchOutput) => {
    setPendingResearchOutput(output);
    setResearchDialogOpen(true);
  }, []);

  // 确认应用选中字段
  const handleConfirmApplyResearch = useCallback((selectedFields: Record<string, boolean>) => {
    if (!pendingResearchOutput) return;
    // 根据选中字段过滤输出
    const filtered: AIResearchOutput = {};
    if (pendingResearchOutput.stock) {
      const stockFields = Object.entries(pendingResearchOutput.stock).filter(([k]) => selectedFields[`stock.${k}`]);
      if (stockFields.length > 0) filtered.stock = Object.fromEntries(stockFields);
    }
    if (pendingResearchOutput.financials) {
      const finFields = Object.entries(pendingResearchOutput.financials).filter(([k]) => selectedFields[`financials.${k}`]);
      if (finFields.length > 0) filtered.financials = Object.fromEntries(finFields);
    }
    if (pendingResearchOutput.technicals) {
      const techFields = Object.entries(pendingResearchOutput.technicals).filter(([k]) => selectedFields[`technicals.${k}`]);
      if (techFields.length > 0) filtered.technicals = Object.fromEntries(techFields);
    }
    if (pendingResearchOutput.theses) {
      filtered.theses = pendingResearchOutput.theses.filter((_, i) => selectedFields[`theses.${i}`]);
    }
    if (pendingResearchOutput.risk) {
      const riskFields = Object.entries(pendingResearchOutput.risk).filter(([k]) => selectedFields[`risk.${k}`]);
      if (riskFields.length > 0) filtered.risk = Object.fromEntries(riskFields) as Partial<RiskAssessment>;
    }
    if (pendingResearchOutput.news) {
      filtered.news = pendingResearchOutput.news.filter((_, i) => selectedFields[`news.${i}`]);
    }
    if (pendingResearchOutput.peers) {
      filtered.peers = pendingResearchOutput.peers.filter((_, i) => selectedFields[`peers.${i}`]);
    }
    const updated = applyResearchOutput(research, filtered);
    saveResearch(updated);
    setPendingResearchOutput(null);
  }, [pendingResearchOutput, research, saveResearch]);

  // ── 论点管理 ──
  const handleSaveThesis = useCallback((thesis: Omit<InvestmentThesis, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editingThesis) {
      // 更新现有论点
      saveResearch(updateThesis(research, editingThesis.id, thesis));
    } else {
      // 新建论点
      saveResearch(addThesis(research, thesis));
    }
    setThesisPanelOpen(false);
    setEditingThesis(null);
  }, [editingThesis, research, saveResearch]);

  // ── 导出研究 ──
  const handleExport = useCallback(async (format: 'markdown' | 'html' | 'docx' | 'txt' | 'json') => {
    if (!doc.projectId) return;

    const extension = format === 'markdown' ? 'md' : format;
    const defaultFileName = `${research.stock.name || research.stock.code || 'research'}.${extension}`;

    try {
      const filePath = await save({
        defaultPath: defaultFileName,
        filters: [{ name: format.toUpperCase(), extensions: [extension] }],
      });
      if (!filePath) return;

      let content: string;

      if (format === 'json') {
        // 直接导出 JSON
        content = JSON.stringify(research, null, 2);
      } else if (format === 'markdown' || format === 'txt') {
        // 生成 Markdown 格式
        content = generateMarkdownReport(research, t);
      } else {
        // HTML 和 DOCX 使用后端转换
        const mdContent = generateMarkdownReport(research, t);
        await invoke('export_document', {
          projectId: doc.projectId,
          format,
          content: mdContent,
          filePath,
        });
        host.ui.showNotification(t('stockResearch.exportSuccess', { defaultValue: '导出成功' }), 'success');
        return;
      }

      // 写入文件（markdown 格式用 .md 扩展名已在 defaultFileName 中处理）
      await invoke('write_text_file', { path: filePath, content });
      host.ui.showNotification(t('stockResearch.exportSuccess', { defaultValue: '导出成功' }), 'success');
    } catch (error) {
      console.error('[stock-research] Export failed:', error);
      host.ui.showNotification(t('stockResearch.exportFailed', { error: String(error), defaultValue: `导出失败：${error}` }), 'error');
    }
  }, [doc.projectId, research, host.ui, t]);

  // ── 显示版本历史 ──
  const handleShowVersionHistory = useCallback(() => {
    setVersionHistoryOpen(true);
  }, []);

  // ── 统计数据 ──
  const currentPosition = useMemo(() => getCurrentPosition(research), [research]);
  const avgCost = useMemo(() => calculateAverageCost(research), [research]);
  const totalPnL = useMemo(() => calculateTotalProfitLoss(research), [research]);
  // ── 专注模式切换 ──
  const handleFocus = useCallback(() => {
    if (focusMode) {
      setFocusMode(false);
      setLeftCollapsed(false);
      setDataCollapsed(false);
      setAiCollapsed(true);
    } else {
      setFocusMode(true);
      setLeftCollapsed(true);
      setDataCollapsed(true);
      setAiCollapsed(true);
    }
  }, [focusMode]);

  // ── 键盘快捷键 ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (e.key === 'Escape' && focusMode) {
        e.preventDefault();
        handleFocus();
        return;
      }
      if (!mod) return;
      if (e.key === 's' && !e.shiftKey) {
        e.preventDefault();
        handleSave();
      }
      if (e.key === 's' && e.shiftKey) {
        e.preventDefault();
        // save all
      }
      if (e.key === 'e' && !e.shiftKey) {
        e.preventDefault();
        handleFocus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [focusMode, handleSave, handleFocus]);

  const phaseInfo = RESEARCH_PHASES.find(p => p.key === research.metadata.phase) || RESEARCH_PHASES[0];

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* ═══ 左栏：股票信息面板 ═══ */}
      {!leftCollapsed && (
        <>
          <div className="flex-shrink-0 h-full overflow-hidden border-r bg-card flex flex-col" style={{ width: leftWidth }}>
            <StockInfoPanel
              research={research}
              onUpdateStockInfo={handleUpdateStockInfo}
              onPhaseChange={handlePhaseChange}
              onSelectNote={handleSelectNote}
              onAddNote={handleAddNote}
              onDeleteNote={handleDeleteNote}
              onRenameNote={handleRenameNote}
              onReorderNotes={handleReorderNotes}
              activeNoteId={activeNoteId}
            />
          </div>
          <ResizableHandle direction="horizontal" onResize={(d) => setLeftWidth(w => Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, w + d)))} />
        </>
      )}

      {/* ═══ 中栏：编辑器 ═══ */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* 工具栏 */}
        <div className="flex items-center gap-1 px-2 py-1 border-b flex-shrink-0 bg-card text-xs">
          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setLeftCollapsed(!leftCollapsed)}
            title={leftCollapsed ? t('stockResearch.showLeft') : t('stockResearch.hideLeft')}>
            {leftCollapsed ? <PanelLeftOpen className="h-3.5 w-3.5" /> : <PanelLeftClose className="h-3.5 w-3.5" />}
          </Button>

          {/* 阶段显示 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={cn('flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs', phaseInfo.color)}>
                <span>{phaseInfo.icon}</span>
                <span>{t(phaseInfo.labelKey)}</span>
                <ChevronDown className="h-2.5 w-2.5 opacity-50" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {RESEARCH_PHASES.map(phase => (
                <DropdownMenuItem key={phase.key} className={cn('text-xs', phase.color)} onClick={() => handlePhaseChange(phase.key)}>
                  {phase.icon} {t(phase.labelKey)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="w-px h-4 bg-border mx-0.5" />

          {/* 保存 */}
          <Button type="button" variant={isSaving ? 'secondary' : 'outline'} size="icon" className="h-5 w-5" disabled={isSaving}
            onClick={handleSave} title={t('editor.saveCurrent')}>
            <Save className="h-3.5 w-3.5" />
          </Button>

          {/* 保存状态 */}
          <span className={cn(
            'text-[10px] px-1',
            saveStatus === 'saved' && 'text-green-500',
            saveStatus === 'saving' && 'text-amber-500',
            saveStatus === 'unsaved' && 'text-red-500',
          )}>
            {saveStatus === 'saved' && t('stockResearch.saved')}
            {saveStatus === 'saving' && t('stockResearch.saving')}
            {saveStatus === 'unsaved' && t('stockResearch.unsaved')}
          </span>

          <div className="w-px h-4 bg-border mx-0.5" />

          {/* 导出菜单 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-5 w-5" title={t('stockResearch.exportResearch')}>
                <Download className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => handleExport('markdown')} className="text-xs">
                Markdown (.md)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('html')} className="text-xs">
                HTML (.html)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('docx')} className="text-xs">
                Word (.docx)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('txt')} className="text-xs">
                纯文本 (.txt)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleExport('json')} className="text-xs">
                JSON (.json)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* 版本历史 */}
          <Button variant="outline" size="icon" className="h-5 w-5"
            onClick={handleShowVersionHistory}
            title={t('stockResearch.versionHistory')}>
            <History className="h-3.5 w-3.5" />
          </Button>

          <div className="w-px h-4 bg-border mx-0.5" />

          {/* 关闭 */}
          <Button variant="outline" size="icon" className="h-5 w-5" onClick={() => tabId && closeTab(tabId, false)}
            title={t('tabs.closeTab')}>
            <X className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="icon" className="h-5 w-5" onClick={() => closeAllTabs()}
            title={t('tabs.closeAllTabs')}>
            <XCircle className="h-3.5 w-3.5" />
          </Button>

          <div className="flex-1" />

          {/* 视图切换 */}
          <div className="flex items-center gap-0.5 mr-1">
            <Button
              variant={centerViewMode === 'dashboard' ? 'default' : 'ghost'}
              size="icon"
              className="h-5 w-5"
              onClick={() => { setCenterViewMode('dashboard'); setActiveNoteId(null); }}
              title={t('stockResearch.dashboard', { defaultValue: '仪表盘' })}
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant={centerViewMode === 'history' ? 'default' : 'ghost'}
              size="icon"
              className="h-5 w-5"
              onClick={() => { setCenterViewMode('history'); setActiveNoteId(null); }}
              title={t('stockResearch.historyView', { defaultValue: '历史' })}
            >
              <Clock className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant={centerViewMode === 'comparison' ? 'default' : 'ghost'}
              size="icon"
              className="h-5 w-5"
              onClick={() => { setCenterViewMode('comparison'); setActiveNoteId(null); }}
              title={t('stockResearch.comparison', { defaultValue: '对比' })}
            >
              <Users className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* 数据面板开关 */}
          <Button variant={dataCollapsed ? 'outline' : 'default'} size="icon" className="h-5 w-5"
            onClick={() => setDataCollapsed(!dataCollapsed)}
            title={t('stockResearch.toggleDataPanel')}>
            <BarChart3 className="h-3.5 w-3.5" />
          </Button>

          {/* AI 开关 */}
          <Button variant={aiCollapsed ? 'outline' : 'default'} size="icon" className="h-5 w-5"
            onClick={() => setAiCollapsed(!aiCollapsed)}
            title={aiCollapsed ? t('stockResearch.showAI') : t('stockResearch.hideAI')}>
            {aiCollapsed ? <PanelRightOpen className="h-3.5 w-3.5" /> : <PanelRightClose className="h-3.5 w-3.5" />}
          </Button>
        </div>

        {/* 编辑区 */}
        <div className={cn('flex-1 min-h-0 overflow-hidden', focusMode && 'px-[8%]')}>
          {activeNoteId ? (
            <MarkdownEditor
              value={noteContent}
              onChange={handleNoteContentChange}
              placeholder={t('stockResearch.editorPlaceholder')}
              theme="light"
              showStatusBar={false}
            />
          ) : centerViewMode === 'dashboard' ? (
            <StockResearchDashboard
              research={research}
              onAddNote={handleAddNote}
              onSelectNote={handleSelectNote}
            />
          ) : centerViewMode === 'history' ? (
            <StockHistoryView
              research={research}
              onSelectNote={handleSelectNote}
            />
          ) : centerViewMode === 'comparison' ? (
            <StockComparisonPanel
              research={research}
              onAddPeer={() => setDataCollapsed(false)}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-4 max-w-md">
                <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground/20" />
                <div className="text-muted-foreground">
                  <p className="text-base font-medium mb-1">{t('stockResearch.welcomeTitle')}</p>
                  <p className="text-sm">{t('stockResearch.welcomeSubtitle')}</p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="rounded-lg border bg-card p-2">
                    <div className="text-lg font-bold text-foreground">{research.theses.length}</div>
                    <div className="text-[10px] text-muted-foreground">{t('stockResearch.thesisCount')}</div>
                  </div>
                  <div className="rounded-lg border bg-card p-2">
                    <div className="text-lg font-bold text-foreground">{research.trades.length}</div>
                    <div className="text-[10px] text-muted-foreground">{t('stockResearch.tradeCount')}</div>
                  </div>
                </div>
                <Button variant="default" size="sm" className="gap-1" onClick={handleAddNote}>
                  <Plus className="h-3.5 w-3.5" />
                  {t('stockResearch.addNote')}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* 状态栏 */}
        <StockResearchStatusBar
          research={research}
          saveStatus={saveStatus}
          currentPosition={currentPosition}
          avgCost={avgCost}
          totalPnL={totalPnL}
        />
      </div>

      {/* ═══ 数据面板 ═══ */}
      {!dataCollapsed && (
        <>
          <ResizableHandle direction="horizontal" onResize={(d) => setDataWidth(w => Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, w - d)))} />
          <div className="flex-shrink-0 h-full overflow-hidden border-l bg-card flex flex-col" style={{ width: dataWidth }}>
            <StockDataPanel
              research={research}
              onUpdateFinancials={handleUpdateFinancials}
              onUpdateTechnicals={handleUpdateTechnicals}
              onUpdateRisk={handleUpdateRisk}
              onAddTrade={handleAddTrade}
              onDeleteTrade={handleDeleteTrade}
              onAddNews={handleAddNews}
              onDeleteNews={handleDeleteNews}
              onAddPeer={handleAddPeer}
              onDeletePeer={handleDeletePeer}
            />
          </div>
        </>
      )}

      {/* ═══ AI 助手 ═══ */}
      {!aiCollapsed && (
        <>
          <ResizableHandle direction="horizontal" onResize={(d) => setAiWidth(w => Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, w - d)))} />
          <div className="flex-shrink-0 h-full overflow-hidden border-l" style={{ width: aiWidth }}>
            <StockResearchAISidebar
              host={host}
              document={doc}
              research={research}
              onInsertToDoc={handleInsertToDoc}
              onApplyResearchResult={handleApplyResearchResult}
              onOpenTushareSettings={() => setTushareSettingsOpen(true)}
              tushareRecheckNonce={tushareRecheckNonce}
            />
          </div>
        </>
      )}

      <Dialog
        open={tushareSettingsOpen}
        onOpenChange={(open) => {
          setTushareSettingsOpen(open);
          if (!open) setTushareRecheckNonce(n => n + 1);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto p-0 gap-0 sm:max-w-lg">
          <TushareSettingsPanel
            className="border-0 h-auto max-h-[min(78vh,720px)]"
            onClose={() => {
              setTushareSettingsOpen(false);
              setTushareRecheckNonce(n => n + 1);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* 版本历史面板 */}
      <Suspense fallback={null}>
        <VersionHistoryPanel
          open={versionHistoryOpen}
          onClose={() => setVersionHistoryOpen(false)}
          projectId={doc.projectId}
          documentId={doc.id}
        />
      </Suspense>

      {/* 论点管理弹窗 */}
      <ThesisPanel
        open={thesisPanelOpen}
        onClose={() => { setThesisPanelOpen(false); setEditingThesis(null); }}
        onSave={handleSaveThesis}
        editingThesis={editingThesis}
        stockName={research.stock.name}
        stockCode={research.stock.code}
      />

      {/* 研究结果预览确认弹窗 */}
      <ResearchResultDialog
        open={researchDialogOpen}
        onClose={() => { setResearchDialogOpen(false); setPendingResearchOutput(null); }}
        onApply={handleConfirmApplyResearch}
        researchOutput={pendingResearchOutput}
        currentResearch={research}
      />
    </div>
  );
}
