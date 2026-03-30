/**
 * ColorLabelPicker — 颜色标签选择器（下拉菜单模式）
 *
 * 用于日记条目的颜色分类标记，采用 DropdownMenu 下拉选择
 */
import { Check, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTranslation } from '@/i18n';
import { COLOR_LABELS } from './types';

interface ColorLabelPickerProps {
  selectedColor?: string;
  onSelect: (color: string | undefined) => void;
  showClear?: boolean;
}

export default function ColorLabelPicker({
  selectedColor,
  onSelect,
  showClear = true,
}: ColorLabelPickerProps) {
  const { t } = useTranslation();

  const selectedLabel = COLOR_LABELS.find(l => l.color === selectedColor);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="h-5 px-1.5 text-xs gap-0.5">
          {selectedLabel ? (
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: selectedLabel.color }} />
              <span>{t(selectedLabel.labelKey)}</span>
            </span>
          ) : (
            <>
              <Palette className="h-3 w-3" />
              <span className="text-muted-foreground">{t('diary.color', { defaultValue: '颜色' })}</span>
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="bg-card">
        {COLOR_LABELS.map(label => (
          <DropdownMenuItem key={label.key} className="text-xs gap-1.5" onClick={() => onSelect(selectedColor === label.color ? undefined : label.color)}>
            <span className="inline-block h-3.5 w-3.5 rounded-sm flex-shrink-0" style={{ backgroundColor: label.color }} />
            <span>{t(label.labelKey)}</span>
            {selectedColor === label.color && <Check className="h-3 w-3 ml-auto text-primary" />}
          </DropdownMenuItem>
        ))}
        {showClear && selectedColor && (
          <>
            <div className="h-px bg-border -mx-1 my-0.5" />
            <DropdownMenuItem className="text-xs text-muted-foreground" onClick={() => onSelect(undefined)}>
              {t('diary.clearColor', { defaultValue: '清除颜色' })}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
