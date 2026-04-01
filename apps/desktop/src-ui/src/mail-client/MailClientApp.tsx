// ── 邮件客户端根组件（导航 + 主视图 + AI 面板） ──

import React, { useCallback } from 'react';
import {
  PenSquare,
  Inbox,
  Send,
  FileText,
  Users,
  BookTemplate,
  Mails,
  Settings,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react';
import { useMailStore } from './store/useMailStore';
import type { MailView } from './types/email';
import { ComposeView } from './views/ComposeView';
import { ContactsView } from './views/ContactsView';
import { TemplatesView } from './views/TemplatesView';
import { BulkSendView } from './views/BulkSendView';
import { SettingsView } from './views/SettingsView';
import { AiPanel } from './views/AiPanel';
import { InboxView } from './views/InboxView';
import { SentView } from './views/SentView';
import { DraftsView } from './views/DraftsView';
import { useMailInit } from './lib/useMailInit';

// 导航项定义
const NAV_ITEMS: { view: MailView; icon: React.ElementType; label: string }[] = [
  { view: 'compose', icon: PenSquare, label: '写邮件' },
  { view: 'inbox', icon: Inbox, label: '收件箱' },
  { view: 'sent', icon: Send, label: '已发送' },
  { view: 'drafts', icon: FileText, label: '草稿箱' },
  { view: 'contacts', icon: Users, label: '联系人' },
  { view: 'templates', icon: BookTemplate, label: '模板' },
  { view: 'bulk-send', icon: Mails, label: '群发' },
  { view: 'settings', icon: Settings, label: '设置' },
];


export function MailClientApp() {
  useMailInit();

  const currentView = useMailStore((s) => s.currentView);
  const setCurrentView = useMailStore((s) => s.setCurrentView);
  const aiPanelVisible = useMailStore((s) => s.aiPanelVisible);
  const toggleAiPanel = useMailStore((s) => s.toggleAiPanel);
  const accounts = useMailStore((s) => s.accounts);
  const activeAccountId = useMailStore((s) => s.activeAccountId);
  const activeAccount = accounts.find(a => a.id === activeAccountId);

  const renderMainView = useCallback(() => {
    switch (currentView) {
      case 'compose':   return <ComposeView />;
      case 'inbox':     return <InboxView />;
      case 'sent':      return <SentView />;
      case 'drafts':    return <DraftsView />;
      case 'contacts':  return <ContactsView />;
      case 'templates': return <TemplatesView />;
      case 'bulk-send': return <BulkSendView />;
      case 'settings':  return <SettingsView />;
      default:          return <ComposeView />;
    }
  }, [currentView]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      height: '100vh',
      overflow: 'hidden',
      fontFamily: '宋体, SimSun, serif',
      fontSize: 16,
      backgroundColor: '#f8f9fa',
    }}>
      {/* 主区域：导航栏 + 内容 + AI 面板 */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* 左侧导航栏 */}
        <nav style={{
          width: 60,
          minWidth: 60,
          backgroundColor: '#1e293b',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: 8,
          gap: 2,
        }}>
          {NAV_ITEMS.map(({ view, icon: Icon, label }) => {
            const active = currentView === view;
            return (
              <button
                key={view}
                onClick={() => setCurrentView(view)}
                title={label}
                style={{
                  width: 48,
                  height: 48,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 2,
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                  backgroundColor: active ? '#334155' : 'transparent',
                  color: active ? '#60a5fa' : '#94a3b8',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => {
                  if (!active) e.currentTarget.style.backgroundColor = '#2a3a50';
                }}
                onMouseLeave={(e) => {
                  if (!active) e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <Icon size={20} />
                <span style={{ fontSize: 9, lineHeight: 1 }}>{label}</span>
              </button>
            );
          })}

          {/* 底部 AI 面板切换 */}
          <div style={{ flex: 1 }} />
          <button
            onClick={toggleAiPanel}
            title={aiPanelVisible ? '隐藏 AI 面板' : '显示 AI 面板'}
            style={{
              width: 48,
              height: 48,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              backgroundColor: 'transparent',
              color: aiPanelVisible ? '#60a5fa' : '#94a3b8',
              marginBottom: 8,
            }}
          >
            {aiPanelVisible ? <PanelRightClose size={20} /> : <PanelRightOpen size={20} />}
          </button>
        </nav>

        {/* 主内容区 */}
        <main style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          backgroundColor: '#ffffff',
        }}>
          {renderMainView()}
        </main>

        {/* 右侧 AI 面板 */}
        {aiPanelVisible && (
          <aside style={{
            width: 340,
            minWidth: 340,
            borderLeft: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}>
            <div style={{
              height: 44,
              display: 'flex',
              alignItems: 'center',
              padding: '0 16px',
              borderBottom: '1px solid #e2e8f0',
              fontWeight: 600,
              fontSize: 14,
              color: '#334155',
            }}>
              AI 邮件助手
            </div>
            <AiPanel />
          </aside>
        )}
      </div>

      {/* 底部状态栏 */}
      <footer style={{
        height: 28,
        minHeight: 28,
        display: 'flex',
        alignItems: 'center',
        padding: '0 12px',
        backgroundColor: '#1e293b',
        color: '#94a3b8',
        fontSize: 12,
        gap: 16,
      }}>
        <span>{activeAccount ? `${activeAccount.displayName || activeAccount.email}` : '未配置账户'}</span>
        <span>|</span>
        <span>共 {accounts.length} 个账户</span>
        <span>|</span>
        <span>AI 助手已就绪</span>
      </footer>
    </div>
  );
}
