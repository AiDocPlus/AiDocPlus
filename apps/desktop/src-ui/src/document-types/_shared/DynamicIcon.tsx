/**
 * DynamicIcon — 按名称动态渲染 lucide-react 图标
 * 用于快捷操作分类/条目的图标动态加载
 */
import { Search } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import type { ComponentType } from 'react';

interface DynamicIconProps {
  name: string;
  className?: string;
  fallback?: ComponentType<{ className?: string }>;
}

export function DynamicIcon({
  name,
  className,
  fallback: Fallback = Search,
}: DynamicIconProps) {
  const IconComponent = (
    LucideIcons as unknown as Record<
      string,
      ComponentType<{ className?: string; iconNode?: unknown }>
    >
  )[name];
  if (!IconComponent) return <Fallback className={className} />;
  return <IconComponent className={className} />;
}
