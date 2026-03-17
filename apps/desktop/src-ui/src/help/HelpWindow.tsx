/**
 * 帮助中心 - 主窗口布局
 *
 * 顶部标题栏 + 三栏布局：左侧导航 + 中间文档内容 + 右侧 AI 问答
 */

import { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { HelpSidebar } from './HelpSidebar';
import { HelpContent } from './HelpContent';
import { HelpAIChat } from './HelpAIChat';
import { getDocById } from './helpDocs';
import { BookOpen, Moon, Sun, PanelRightClose, PanelRightOpen } from 'lucide-react';

export function HelpWindow() {
  const [activeDocId, setActiveDocId] = useState('quick-start');
  const [showAI, setShowAI] = useState(true);
  const [dark, setDark] = useState(false);

  // 从主程序设置同步暗色模式
  useEffect(() => {
    (async () => {
      try {
        const raw = await invoke<unknown>('load_settings');
        if (raw) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const settings: any = typeof raw === 'string' ? JSON.parse(raw) : raw;
          const theme = settings?.state?.ui?.theme;
          if (theme === 'dark') {
            setDark(true);
            document.documentElement.classList.add('dark');
          }
        }
      } catch { /* ignore */ }
    })();
  }, []);

  const toggleDark = () => {
    setDark(prev => {
      const next = !prev;
      if (next) document.documentElement.classList.add('dark');
      else document.documentElement.classList.remove('dark');
      return next;
    });
  };

  const currentDoc = activeDocId ? getDocById(activeDocId) ?? null : null;

  const handleSelectDoc = useCallback((docId: string) => {
    setActiveDocId(docId);
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-background text-foreground">
      {/* 顶部标题栏 */}
      <div className="help-titlebar flex items-center justify-between h-10 px-4 border-b bg-card shrink-0">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">帮助中心</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowAI(v => !v)}
            className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            title={showAI ? '收起 AI 助手' : '展开 AI 助手'}
          >
            {showAI ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
          </button>
          <button
            onClick={toggleDark}
            className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            title={dark ? '切换到亮色模式' : '切换到暗色模式'}
          >
            {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* 主体三栏布局 */}
      <div className="flex flex-1 min-h-0">
        {/* 左侧：文档导航 */}
        <HelpSidebar
          activeDocId={activeDocId}
          onSelectDoc={handleSelectDoc}
        />

        {/* 中间：文档内容 */}
        <HelpContent doc={currentDoc} />

        {/* 右侧：AI 问答 */}
        {showAI && (
          <HelpAIChat currentDoc={currentDoc} />
        )}
      </div>
    </div>
  );
}
