/**
 * TaskListTemplateDialog — 模板选择对话框
 */
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FileCode2,
  Search,
  Calendar,
  CalendarDays,
  Briefcase,
  Users,
  BookOpen,
  Home,
  Wallet,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  TASKLIST_TEMPLATES,
  groupTemplatesByCategory,
  createListFromTemplate,
  type TaskListTemplate,
} from './taskListTemplates';
import type { TaskList } from './types';

interface TaskListTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTemplate: (list: TaskList) => void;
}

/** 分类图标映射 */
const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  daily: Calendar,
  weekly: CalendarDays,
  project: Briefcase,
  meeting: Users,
  personal: BookOpen,
  life: Home,
  finance: Wallet,
};

/** 分类颜色映射 */
const CATEGORY_COLORS: Record<string, string> = {
  daily: 'text-blue-600',
  weekly: 'text-purple-600',
  project: 'text-orange-600',
  meeting: 'text-green-600',
  personal: 'text-indigo-600',
  life: 'text-pink-600',
  finance: 'text-amber-600',
};

export function TaskListTemplateDialog({
  open,
  onOpenChange,
  onSelectTemplate,
}: TaskListTemplateDialogProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // 分组模板
  const groupedTemplates = useMemo(
    () => groupTemplatesByCategory(TASKLIST_TEMPLATES),
    [],
  );

  // 过滤模板
  const filteredTemplates = useMemo(() => {
    let templates = TASKLIST_TEMPLATES;

    // 按分类过滤
    if (selectedCategory) {
      templates = templates.filter((t) => t.category === selectedCategory);
    }

    // 按搜索词过滤
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      templates = templates.filter(
        (t) =>
          t.nameKey.toLowerCase().includes(query) ||
          t.tasks.some((task) => task.content.toLowerCase().includes(query)),
      );
    }

    return templates;
  }, [selectedCategory, searchQuery]);

  // 处理模板选择
  const handleSelectTemplate = (template: TaskListTemplate) => {
    const listName = t(template.nameKey);
    const newList = createListFromTemplate(template, listName);
    onSelectTemplate(newList);
    onOpenChange(false);
    setSearchQuery('');
    setSelectedCategory(null);
  };

  // 获取模板名称
  const getTemplateName = (template: TaskListTemplate) => {
    return t(`taskList.templates.${template.id}`, {
      defaultValue: t(template.nameKey),
    });
  };

  // 获取模板描述
  const getTemplateDescription = (template: TaskListTemplate) => {
    return t(`taskList.templates.${template.id}Desc`, {
      defaultValue: t(template.descriptionKey),
    });
  };

  // 获取分类名称
  const getCategoryName = (category: string) => {
    return t(`taskList.templateCategories.${category}`, {
      defaultValue: category,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCode2 className="h-5 w-5" />
            {t('taskList.selectTemplate', { defaultValue: '选择模板' })}
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-4 flex-1 min-h-0">
          {/* 分类侧栏 */}
          <div className="w-40 shrink-0 border-r pr-3">
            <Button
              variant={selectedCategory === null ? 'secondary' : 'ghost'}
              size="sm"
              className="w-full justify-start mb-1"
              onClick={() => setSelectedCategory(null)}
            >
              {t('taskList.filterAll', { defaultValue: '全部' })}
            </Button>
            {Object.keys(groupedTemplates).map((category) => {
              const Icon = CATEGORY_ICONS[category] || FileCode2;
              return (
                <Button
                  key={category}
                  variant={selectedCategory === category ? 'secondary' : 'ghost'}
                  size="sm"
                  className="w-full justify-start mb-1"
                  onClick={() => setSelectedCategory(category)}
                >
                  <Icon className="h-3.5 w-3.5 mr-2" />
                  {getCategoryName(category)}
                </Button>
              );
            })}
          </div>

          {/* 模板列表 */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* 搜索框 */}
            <div className="relative mb-3">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('common.search', { defaultValue: '搜索...' })}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>

            {/* 模板网格 */}
            <ScrollArea className="flex-1">
              <div className="grid grid-cols-2 gap-3 pr-2">
                {filteredTemplates.map((template) => {
                  const CategoryIcon = CATEGORY_ICONS[template.category] || FileCode2;
                  return (
                    <button
                      key={template.id}
                      className="group p-3 border rounded-lg text-left hover:bg-accent hover:border-primary/50 transition-colors"
                      onClick={() => handleSelectTemplate(template)}
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-lg leading-none mt-0.5">
                          {template.icon}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">
                            {getTemplateName(template)}
                          </div>
                          <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                            {getTemplateDescription(template)}
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <span
                              className={cn(
                                'text-xs flex items-center gap-1',
                                CATEGORY_COLORS[template.category],
                              )}
                            >
                              <CategoryIcon className="h-3 w-3" />
                              {getCategoryName(template.category)}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {template.tasks.length}{' '}
                              {t('taskList.statsTotal', { defaultValue: '任务' })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {filteredTemplates.length === 0 && (
                <div className="py-8 text-center text-muted-foreground text-sm">
                  {t('common.noResults', { defaultValue: '无匹配结果' })}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default TaskListTemplateDialog;
