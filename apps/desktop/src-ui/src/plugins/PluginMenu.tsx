import { useMemo } from 'react';
import { Puzzle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getPlugins, getPluginsForDocument } from './registry';
import { useTranslation } from '@/i18n';
import type { Document } from '@aidocplus/shared-types';

interface PluginMenuProps {
  pluginAreaOpen: boolean;
  onToggle: () => void;
  document?: Document;
}

/**
 * 工具栏插件 toggle 按钮
 * - 展开时：橙色高亮
 * - 未展开但文档含插件数据时：蓝色点亮
 */
export function PluginMenu({ pluginAreaOpen, onToggle, document }: PluginMenuProps) {
  const { t } = useTranslation('plugin-framework');
  const plugins = getPlugins();
  const hasPlugins = plugins.length > 0;

  // 仅检测文档已启用插件中是否包含插件生成的数据
  const docPlugins = useMemo(() => document ? getPluginsForDocument(document) : [], [document]);
  const hasPluginData = !!document?.pluginData &&
    docPlugins.some(p => document.pluginData?.[p.id] != null);
  void hasPluginData;

  // 样式：展开（蓝色） > 有数据（蓝色呼吸灯） > 未激活（蓝色边框+呼吸灯）
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
        ? t('toggle')
        : t('allDisabled')}
      className={`gap-1 h-7 text-xs ${className}`}
    >
      <Puzzle className="h-3.5 w-3.5" />
      {t('area')}
    </Button>
  );
}
