import { useMemo } from 'react';
import { Puzzle, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getPlugins, getPluginsForDocument } from './registry';
import { useAppStore } from '@/stores/useAppStore';
import { useTranslation } from '@/i18n';
import type { Document } from '@aidocplus/shared-types';

interface PluginMenuProps {
  pluginAreaOpen: boolean;
  onToggle: () => void;
  document?: Document;
}

/**
 * 工具栏内容插件区 toggle 按钮（content-generation 类插件）
 */
export function PluginMenu({ pluginAreaOpen, onToggle, document }: PluginMenuProps) {
  const { t } = useTranslation('plugin-framework');
  const { pluginManifests } = useAppStore();
  const allPlugins = getPlugins();
  const contentPlugins = useMemo(() => {
    return allPlugins.filter(p => {
      const m = pluginManifests.find(m => m.id === p.id);
      const cat = m?.majorCategory || p.majorCategory || 'content-generation';
      return cat === 'content-generation';
    });
  }, [allPlugins, pluginManifests]);
  const hasPlugins = contentPlugins.length > 0;

  const docPlugins = useMemo(() => document ? getPluginsForDocument(document) : [], [document]);
  const hasPluginData = !!document?.pluginData &&
    docPlugins.some(p => {
      const m = pluginManifests.find(m => m.id === p.id);
      const cat = m?.majorCategory || p.majorCategory || 'content-generation';
      return cat === 'content-generation' && document.pluginData?.[p.id] != null;
    });
  void hasPluginData;

  const className = pluginAreaOpen
    ? 'bg-blue-600 hover:bg-blue-700 text-white'
    : 'border-blue-500 text-blue-500 hover:bg-blue-500/10 animate-plugin-breathe';

  return (
    <Button
      variant={pluginAreaOpen ? 'default' : 'outline'}
      size="sm"
      disabled={!hasPlugins}
      onClick={onToggle}
      title={hasPlugins
        ? t('toggle', { defaultValue: '展开/收起内容插件区' })
        : t('allDisabled')}
      className={`gap-1 h-7 text-xs ${className}`}
    >
      <Puzzle className="h-3.5 w-3.5" />
      {t('area', { defaultValue: '插件区' })}
    </Button>
  );
}

interface FunctionalPluginMenuProps {
  functionalAreaOpen: boolean;
  onToggle: () => void;
  document?: Document;
}

/**
 * 工具栏功能插件区 toggle 按钮（functional 类插件）
 */
export function FunctionalPluginMenu({ functionalAreaOpen, onToggle, document }: FunctionalPluginMenuProps) {
  const { t } = useTranslation('plugin-framework');
  const { pluginManifests } = useAppStore();
  const allPlugins = getPlugins();
  const functionalPlugins = useMemo(() => {
    return allPlugins.filter(p => {
      const m = pluginManifests.find(m => m.id === p.id);
      const cat = m?.majorCategory || p.majorCategory || 'content-generation';
      return cat === 'functional';
    });
  }, [allPlugins, pluginManifests]);
  const hasPlugins = functionalPlugins.length > 0;

  void document;

  const className = functionalAreaOpen
    ? 'bg-purple-600 hover:bg-purple-700 text-white'
    : 'border-purple-500 text-purple-500 hover:bg-purple-500/10 animate-functional-breathe';

  return (
    <Button
      variant={functionalAreaOpen ? 'default' : 'outline'}
      size="sm"
      disabled={!hasPlugins}
      onClick={onToggle}
      title={hasPlugins
        ? t('functionalToggle', { defaultValue: '展开/收起功能插件区' })
        : t('allDisabled')}
      className={`gap-1 h-7 text-xs ${className}`}
    >
      <Wrench className="h-3.5 w-3.5" />
      {t('functionalArea', { defaultValue: '功能区' })}
    </Button>
  );
}
