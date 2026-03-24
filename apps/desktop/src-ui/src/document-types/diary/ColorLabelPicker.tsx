/**
 * ColorLabelPicker — 颜色标签选择器
 *
 * 用于日记条目的颜色分类标记
 */
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n';
import { COLOR_LABELS, type ColorLabel } from './types';

interface ColorLabelPickerProps {
  selectedColor?: string;
  onSelect: (color: string | undefined) => void;
  showClear?: boolean;
  size?: 'sm' | 'md';
}

export default function ColorLabelPicker({
  selectedColor,
  onSelect,
  showClear = true,
  size = 'sm',
}: ColorLabelPickerProps) {
  const { t } = useTranslation();

  const sizeClasses = size === 'sm' ? 'h-5 w-5' : 'h-6 w-6';

  return (
    <div className="flex items-center gap-0.5">
      {COLOR_LABELS.map((label: ColorLabel) => (
        <button
          key={label.key}
          className={cn(
            sizeClasses,
            'rounded transition-all flex items-center justify-center',
            selectedColor === label.color
              ? 'ring-2 ring-offset-1 ring-primary scale-110'
              : 'hover:scale-105 opacity-70 hover:opacity-100',
          )}
          style={{ backgroundColor: label.color }}
          onClick={() => onSelect(selectedColor === label.color ? undefined : label.color)}
          title={t(label.labelKey)}
        >
          {selectedColor === label.color && (
            <Check className="h-3 w-3 text-white" />
          )}
        </button>
      ))}
      {showClear && selectedColor && (
        <button
          className={cn(sizeClasses, 'rounded border border-dashed border-muted-foreground/50 hover:bg-muted flex items-center justify-center')}
          onClick={() => onSelect(undefined)}
          title={t('diary.clearColor', { defaultValue: '清除颜色' })}
        >
          <span className="text-[10px] text-muted-foreground">✕</span>
        </button>
      )}
    </div>
  );
}
