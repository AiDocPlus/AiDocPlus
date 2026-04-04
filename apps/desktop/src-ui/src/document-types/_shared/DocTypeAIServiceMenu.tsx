/**
 * 文档类型 AI 侧栏 — AI 服务选择（Radix DropdownMenu）
 */
import { Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import type { AIServiceConfig } from '@aidocplus/shared-types';

export interface DocTypeAIServiceMenuProps {
  enabledServices: AIServiceConfig[];
  /** 当前选中的 service id；空则回退为「全局默认」展示逻辑由父组件决定 */
  value: string;
  onChange: (serviceId: string) => void;
  disabled?: boolean;
  className?: string;
  /** 触发器按钮尺寸 */
  triggerClassName?: string;
}

export function DocTypeAIServiceMenu({
  enabledServices,
  value,
  onChange,
  disabled = false,
  className,
  triggerClassName,
}: DocTypeAIServiceMenuProps) {
  const { t } = useTranslation();
  const current = enabledServices.find(s => s.id === value) ?? enabledServices[0];
  const label = current?.name
    || t('docTypeChat.noAIService', { defaultValue: '未配置 AI 服务' });

  if (enabledServices.length === 0) {
    return (
      <span
        className={cn('text-[10px] text-muted-foreground truncate max-w-[140px] px-1', className)}
        title={t('docTypeChat.noAIService', { defaultValue: '未配置 AI 服务' })}
      >
        {t('docTypeChat.aiService', { defaultValue: 'AI 服务' })}: —
      </span>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          className={cn(
            'h-6 gap-0.5 text-[10px] px-1.5 max-w-[160px] justify-between font-normal',
            triggerClassName,
            className,
          )}
          title={t('docTypeChat.selectAiService', { defaultValue: '选择 AI 服务' })}
        >
          <span className="truncate">{label}</span>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {enabledServices.map(s => (
          <DropdownMenuItem
            key={s.id}
            className="text-xs gap-2"
            onClick={() => onChange(s.id)}
          >
            {value === s.id ? (
              <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
            ) : (
              <span className="w-3.5 shrink-0" />
            )}
            <span className="truncate">{s.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
