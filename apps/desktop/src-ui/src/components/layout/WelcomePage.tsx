/**
 * 欢迎页 — 无文档打开时显示
 */
import { useTranslation } from '@/i18n';
import { FileText, BookOpen, Plus, Keyboard } from 'lucide-react';

interface WelcomePageProps {
  onCreateProject: () => void;
}

export function WelcomePage({ onCreateProject }: WelcomePageProps) {
  const { t } = useTranslation();
  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const mod = isMac ? '⌘' : 'Ctrl';

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center space-y-8 max-w-md px-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">AiDocPlus</h1>
          <p className="text-sm text-muted-foreground">
            {t('welcome.subtitle', { defaultValue: 'AI 驱动的智能写作平台' })}
          </p>
        </div>

        {/* 快捷入口 */}
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => onCreateProject()}
            className="flex flex-col items-center gap-3 p-5 rounded-lg border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer group"
          >
            <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center group-hover:scale-110 transition-transform">
              <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div className="text-sm font-medium">{t('welcome.newGeneral', { defaultValue: '通用写作' })}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {t('welcome.generalHint', { defaultValue: '文档、AI 对话、插件' })}
              </div>
            </div>
          </button>

          <button
            onClick={() => onCreateProject()}
            className="flex flex-col items-center gap-3 p-5 rounded-lg border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer group"
          >
            <div className="h-12 w-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center group-hover:scale-110 transition-transform">
              <BookOpen className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <div className="text-sm font-medium">{t('welcome.newNovel', { defaultValue: '长篇小说' })}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {t('welcome.novelHint', { defaultValue: '设定集、卷/章、AI 续写' })}
              </div>
            </div>
          </button>
        </div>

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
