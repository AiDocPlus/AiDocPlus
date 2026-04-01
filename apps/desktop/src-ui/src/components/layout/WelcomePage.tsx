/**
 * 欢迎页 — 无标签页打开时显示
 *
 * 提供：
 * 1. 新建项目入口
 * 2. 如果有项目，在第一个项目中快速新建常用类型文档（通用文档、日记、任务清单、大纲）
 */
import { useTranslation } from '@/i18n';
import { useCallback } from 'react';
import { FileText, BookHeart, CheckSquare, ListTree, Plus, FolderPlus, Keyboard } from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';
import { invoke } from '@tauri-apps/api/core';

interface WelcomePageProps {
  onCreateProject: () => void;
}

/** 快速新建的常用文档类型 */
const QUICK_DOC_TYPES = [
  { id: 'normal', icon: FileText, color: 'bg-blue-100 dark:bg-blue-900/30', iconColor: 'text-blue-600 dark:text-blue-400', labelKey: 'docType.normal', descKey: 'welcome.quickNormalHint' },
  { id: 'diary', icon: BookHeart, color: 'bg-rose-100 dark:bg-rose-900/30', iconColor: 'text-rose-600 dark:text-rose-400', labelKey: 'docType.diary', descKey: 'welcome.quickDiaryHint' },
  { id: 'task-list', icon: CheckSquare, color: 'bg-emerald-100 dark:bg-emerald-900/30', iconColor: 'text-emerald-600 dark:text-emerald-400', labelKey: 'docType.taskList', descKey: 'welcome.quickTaskHint' },
  { id: 'outline', icon: ListTree, color: 'bg-violet-100 dark:bg-violet-900/30', iconColor: 'text-violet-600 dark:text-violet-400', labelKey: 'docType.outline', descKey: 'welcome.quickOutlineHint' },
] as const;

export function WelcomePage({ onCreateProject }: WelcomePageProps) {
  const { t } = useTranslation();
  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const mod = isMac ? '⌘' : 'Ctrl';

  const projects = useAppStore(s => s.projects);
  const firstProject = projects[0] ?? null;

  // 在指定项目中快速创建指定类型文档并打开
  const handleQuickCreate = useCallback(async (projectId: string, docTypeId: string) => {
    try {
      const { getDocTypeOrDefault } = await import('@/doctype-sdk/registry');
      const typeDef = getDocTypeOrDefault(docTypeId);
      const docTypeName = t(typeDef.labelKey, { defaultValue: typeDef.id });
      const { createDocument, openTab, loadDocuments, openProject } = useAppStore.getState();

      // 确保项目已打开
      const cp = useAppStore.getState().currentProject;
      if (!cp || cp.id !== projectId) {
        await openProject(projectId);
      }

      const newDoc = await createDocument(projectId, docTypeName);
      if (newDoc && docTypeId !== 'normal') {
        await invoke('save_document', {
          payload: {
            documentId: newDoc.id,
            projectId,
            title: newDoc.title,
            content: typeDef.createEmptyContent(),
            authorNotes: '',
            aiGeneratedContent: '',
            documentType: docTypeId,
          },
        });
        await loadDocuments(projectId);
      }
      await openTab(newDoc.id);
    } catch (err) {
      console.error('[WelcomePage] 快速创建文档失败:', err);
    }
  }, [t]);

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center space-y-8 max-w-lg px-4">
        {/* 标题 */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">AiDocPlus</h1>
          <p className="text-sm text-muted-foreground">
            {t('welcome.subtitle', { defaultValue: 'AI 驱动的智能写作平台' })}
          </p>
        </div>

        {/* 新建项目 */}
        <button
          onClick={() => onCreateProject()}
          className="flex items-center justify-center gap-2.5 w-full max-w-xs mx-auto py-3 rounded-lg border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer group"
        >
          <FolderPlus className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
          <span className="text-sm font-medium">{t('welcome.createProject', { defaultValue: '新建项目' })}</span>
        </button>

        {/* 快速新建文档（有项目时显示） */}
        {firstProject && (
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground">
              {t('welcome.quickCreateIn', { defaultValue: '在' })} <span className="font-medium text-foreground">{firstProject.name}</span> {t('welcome.quickCreateSuffix', { defaultValue: '中新建' })}
            </div>
            <div className="grid grid-cols-4 gap-3">
              {QUICK_DOC_TYPES.map((dt) => {
                const Icon = dt.icon;
                return (
                  <button
                    key={dt.id}
                    onClick={() => handleQuickCreate(firstProject.id, dt.id)}
                    className="flex flex-col items-center gap-2.5 p-4 rounded-lg border hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer group"
                  >
                    <div className={`h-10 w-10 rounded-full ${dt.color} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                      <Icon className={`h-5 w-5 ${dt.iconColor}`} />
                    </div>
                    <div className="min-w-0 w-full">
                      <div className="text-xs font-medium truncate">{t(dt.labelKey)}</div>
                      <div className="text-[10px] text-muted-foreground truncate mt-0.5">
                        {t(dt.descKey, { defaultValue: '' })}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 提示 */}
        <div className="text-xs text-muted-foreground space-y-1.5 opacity-60">
          <div className="flex items-center justify-center gap-2">
            <Plus className="w-3.5 h-3.5" />
            <span>{t('welcome.clickSidebar', { defaultValue: '或在左侧文件树中新建项目' })}</span>
          </div>
          <div className="flex items-center justify-center gap-2">
            <Keyboard className="w-3.5 h-3.5" />
            <span>{t('welcome.shortcuts', { defaultValue: '{{mod}}+N 新建文档 · {{mod}}+S 保存', mod })}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
