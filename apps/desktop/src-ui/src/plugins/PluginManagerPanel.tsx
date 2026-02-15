import { useState, useMemo } from 'react';
import { getAllPlugins } from './registry';
import { DEFAULT_DOC_PLUGINS, PLUGIN_MAJOR_CATEGORIES, PLUGIN_SUB_CATEGORIES } from './constants';
import { useAppStore } from '@/stores/useAppStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useTranslation } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Search, Plus, X, RotateCcw, Check, ChevronDown, ChevronRight } from 'lucide-react';
import type { Document, PluginManifest } from '@aidocplus/shared-types';
import type { DocumentPlugin } from './types';

interface PluginManagerPanelProps {
  document: Document;
  enabledPluginIds?: string[];
  onEnabledPluginsChange: (pluginIds: string[]) => void;
  onClose: () => void;
}

/**
 * 插件管理面板：树状分类 + 搜索 + 为当前文档增删插件
 */
export function PluginManagerPanel({
  document,
  enabledPluginIds,
  onEnabledPluginsChange,
  onClose,
}: PluginManagerPanelProps) {
  const { t } = useTranslation('plugin-framework');
  const { pluginManifests } = useAppStore();
  const { plugins: pluginsSettings } = useSettingsStore();

  const allPlugins = useMemo(() => getAllPlugins(), []);
  const currentEnabled = enabledPluginIds ?? DEFAULT_DOC_PLUGINS;

  const [searchQuery, setSearchQuery] = useState('');
  // 选中的节点：'all' | majorCategory key | 'major:sub' 格式
  const [selectedNode, setSelectedNode] = useState<string>('all');
  // 展开的大类节点
  const [expandedMajors, setExpandedMajors] = useState<Set<string>>(
    new Set(PLUGIN_MAJOR_CATEGORIES.map(c => c.key))
  );

  const pluginUsageCount: Record<string, number> = (pluginsSettings as any)?.usageCount || {};

  // 获取插件的 manifest
  const getManifest = (pluginId: string): PluginManifest | undefined =>
    pluginManifests.find(m => m.id === pluginId);

  // 构建树结构数据：统计每个大类和子类的插件数量
  const treeData = useMemo(() => {
    const majorCounts: Record<string, number> = {};
    const subCounts: Record<string, Record<string, number>> = {};

    for (const m of pluginManifests) {
      if (!m.enabled) continue;
      const major = m.majorCategory || 'content-generation';
      const sub = m.subCategory || m.category || '';
      majorCounts[major] = (majorCounts[major] || 0) + 1;
      if (!subCounts[major]) subCounts[major] = {};
      if (sub) subCounts[major][sub] = (subCounts[major][sub] || 0) + 1;
    }

    return { majorCounts, subCounts, total: allPlugins.length };
  }, [pluginManifests, allPlugins]);

  // 过滤插件：按树节点选择 + 搜索
  const filteredPlugins = useMemo(() => {
    let plugins = allPlugins;

    // 按树节点过滤
    if (selectedNode !== 'all') {
      if (selectedNode.includes(':')) {
        // 子类节点：'major:sub'
        const [major, sub] = selectedNode.split(':');
        plugins = plugins.filter(p => {
          const m = getManifest(p.id);
          const pMajor = m?.majorCategory || p.majorCategory || 'content-generation';
          const pSub = m?.subCategory || p.subCategory || m?.category || '';
          return pMajor === major && pSub === sub;
        });
      } else {
        // 大类节点
        plugins = plugins.filter(p => {
          const m = getManifest(p.id);
          const pMajor = m?.majorCategory || p.majorCategory || 'content-generation';
          return pMajor === selectedNode;
        });
      }
    }

    // 搜索过滤
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      plugins = plugins.filter(p => {
        const m = getManifest(p.id);
        return (
          p.name.toLowerCase().includes(q) ||
          (p.description || '').toLowerCase().includes(q) ||
          (m?.tags || []).some(tag => tag.toLowerCase().includes(q))
        );
      });
    }

    return plugins;
  }, [allPlugins, selectedNode, searchQuery, pluginManifests]);

  // 分为已启用和可添加
  const enabledPlugins = filteredPlugins.filter(p => currentEnabled.includes(p.id));
  const availablePlugins = filteredPlugins.filter(p => !currentEnabled.includes(p.id));
  const sortedAvailable = useMemo(() => {
    return [...availablePlugins].sort((a, b) => {
      return (pluginUsageCount[b.id] || 0) - (pluginUsageCount[a.id] || 0);
    });
  }, [availablePlugins, pluginUsageCount]);

  const handleAdd = (pluginId: string) => {
    onEnabledPluginsChange([...currentEnabled, pluginId]);
  };

  const handleRemove = (pluginId: string) => {
    onEnabledPluginsChange(currentEnabled.filter(id => id !== pluginId));
  };

  const handleResetDefault = () => {
    onEnabledPluginsChange([...DEFAULT_DOC_PLUGINS]);
  };

  const toggleMajor = (majorKey: string) => {
    setExpandedMajors(prev => {
      const next = new Set(prev);
      if (next.has(majorKey)) next.delete(majorKey);
      else next.add(majorKey);
      return next;
    });
  };

  // 获取子类显示名
  const getSubLabel = (majorKey: string, subKey: string): string => {
    const subs = PLUGIN_SUB_CATEGORIES[majorKey];
    const found = subs?.find(s => s.key === subKey);
    return found?.label || t(`categories.${subKey}`, { defaultValue: subKey });
  };

  // 获取大类显示名
  const getMajorLabel = (majorKey: string): string => {
    const found = PLUGIN_MAJOR_CATEGORIES.find(c => c.key === majorKey);
    return found?.label || t(`majorCategories.${majorKey}`, { defaultValue: majorKey });
  };

  // 渲染插件卡片
  const renderPluginCard = (plugin: DocumentPlugin, isEnabled: boolean) => {
    const Icon = plugin.icon;
    const hasData = plugin.hasData(document);
    return (
      <div
        key={plugin.id}
        className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors ${
          isEnabled
            ? 'bg-card hover:bg-accent/50'
            : 'border-dashed hover:border-primary/50 hover:bg-accent/30'
        }`}
      >
        <Icon className={`h-5 w-5 flex-shrink-0 ${isEnabled ? 'text-primary' : 'text-muted-foreground'}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">{plugin.name}</span>
            {hasData && <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />}
            {(pluginUsageCount[plugin.id] || 0) > 0 && !isEnabled && (
              <span className="text-xs text-muted-foreground">
                {t('usedCount', { count: pluginUsageCount[plugin.id] })}
              </span>
            )}
          </div>
          {plugin.description && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">{plugin.description}</p>
          )}
        </div>
        {isEnabled ? (
          <button
            onClick={() => handleRemove(plugin.id)}
            className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors flex-shrink-0"
            title={t('remove')}
          >
            <X className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={() => handleAdd(plugin.id)}
            className="p-1 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors flex-shrink-0"
            title={t('add')}
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* 顶部搜索栏 */}
      <div className="flex items-center gap-2 px-4 py-2 border-b bg-background flex-shrink-0">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={handleResetDefault} className="gap-1 flex-shrink-0">
          <RotateCcw className="h-3.5 w-3.5" />
          {t('resetDefault')}
        </Button>
        <Button variant="default" size="sm" onClick={onClose} className="gap-1 flex-shrink-0">
          <Check className="h-3.5 w-3.5" />
          {t('done')}
        </Button>
      </div>

      {/* 主体：左侧树 + 右侧列表 */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* 左侧树状分类 */}
        <div className="w-40 flex-shrink-0 border-r bg-muted/20 overflow-y-auto py-2">
          {/* 全部 */}
          <button
            onClick={() => setSelectedNode('all')}
            className={`
              w-full text-left px-3 py-2 text-sm transition-colors
              ${selectedNode === 'all'
                ? 'bg-red-500/10 text-red-600 dark:text-red-400 font-medium border-r-2 border-red-500'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }
            `}
          >
            <span>{t('categories.all', { defaultValue: '全部' })}</span>
            <span className="ml-1 text-xs opacity-60">({treeData.total})</span>
          </button>

          {/* 大类 → 子类 树 */}
          {PLUGIN_MAJOR_CATEGORIES.map(major => {
            const majorCount = treeData.majorCounts[major.key] || 0;
            const isExpanded = expandedMajors.has(major.key);
            const isMajorSelected = selectedNode === major.key;
            const subCategories = PLUGIN_SUB_CATEGORIES[major.key] || [];

            return (
              <div key={major.key}>
                {/* 大类节点 */}
                <div className="flex items-center">
                  <button
                    onClick={() => toggleMajor(major.key)}
                    className="flex-shrink-0 p-1 ml-1 text-muted-foreground hover:text-foreground"
                  >
                    {isExpanded
                      ? <ChevronDown className="h-3 w-3" />
                      : <ChevronRight className="h-3 w-3" />
                    }
                  </button>
                  <button
                    onClick={() => setSelectedNode(major.key)}
                    className={`
                      flex-1 text-left px-1 py-2 text-sm transition-colors truncate
                      ${isMajorSelected
                        ? 'text-red-600 dark:text-red-400 font-medium'
                        : majorCount === 0
                          ? 'text-muted-foreground/50'
                          : 'text-muted-foreground hover:text-foreground'
                      }
                    `}
                  >
                    <span>{getMajorLabel(major.key)}</span>
                    <span className="ml-1 text-xs opacity-60">({majorCount})</span>
                  </button>
                </div>

                {/* 子类节点 */}
                {isExpanded && subCategories.map(sub => {
                  const subCount = treeData.subCounts[major.key]?.[sub.key] || 0;
                  const nodeKey = `${major.key}:${sub.key}`;
                  const isSubSelected = selectedNode === nodeKey;
                  return (
                    <button
                      key={nodeKey}
                      onClick={() => setSelectedNode(nodeKey)}
                      className={`
                        w-full text-left pl-8 pr-3 py-1.5 text-sm transition-colors
                        ${isSubSelected
                          ? 'bg-red-500/10 text-red-600 dark:text-red-400 font-medium border-r-2 border-red-500'
                          : subCount === 0
                            ? 'text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/30'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                        }
                      `}
                    >
                      <span>{getSubLabel(major.key, sub.key)}</span>
                      {subCount === 0
                        ? <span className="ml-1 text-xs opacity-40">{t('none')}</span>
                        : <span className="ml-1 text-xs opacity-60">({subCount})</span>
                      }
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* 右侧插件列表 */}
        <div className="flex-1 min-w-0 overflow-y-auto p-3 space-y-4">
          {/* 已启用 */}
          {enabledPlugins.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {t('enabled')} ({enabledPlugins.length})
              </div>
              <div className="space-y-1">
                {enabledPlugins.map(p => renderPluginCard(p, true))}
              </div>
            </div>
          )}

          {/* 可添加 */}
          {sortedAvailable.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {t('available')} ({sortedAvailable.length})
              </div>
              <div className="space-y-1">
                {sortedAvailable.map(p => renderPluginCard(p, false))}
              </div>
            </div>
          )}

          {filteredPlugins.length === 0 && (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              {searchQuery ? t('noMatch', { query: searchQuery }) : t('noPluginsAvailable')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
