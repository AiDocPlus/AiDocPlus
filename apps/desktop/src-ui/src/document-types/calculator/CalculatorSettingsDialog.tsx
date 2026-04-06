/**
 * CalculatorSettingsDialog — 计算文档设置对话框
 * 配置小数位数、日期格式、货币符号、实时计算等（由父组件控制 open）
 */
import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Settings, Hash, Calendar, DollarSign, Zap, Check, Divide,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { CalculatorSettings } from './types';
import { DEFAULT_CALCULATOR_SETTINGS } from './types';

interface CalculatorSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: CalculatorSettings;
  onSettingsChange: (settings: CalculatorSettings) => void;
}

const DECIMAL_OPTIONS = [
  { value: 0, label: '0' },
  { value: 1, label: '1' },
  { value: 2, label: '2' },
  { value: 3, label: '3' },
  { value: 4, label: '4' },
  { value: 5, label: '5' },
  { value: 6, label: '6' },
];

const DATE_FORMAT_OPTIONS = [
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (2024-01-15)' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (01/15/2024)' },
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (15/01/2024)' },
  { value: 'YYYY/MM/DD', label: 'YYYY/MM/DD (2024/01/15)' },
];

function getNumberFormatOptions(t: (key: string, options?: Record<string, unknown>) => string) {
  return [
    { value: 'western', label: t('calculator.numberFormatWestern', { defaultValue: 'Western (1,000.00)' }) },
    { value: 'chinese', label: t('calculator.numberFormatChinese', { defaultValue: 'Chinese (1,000.00)' }) },
  ];
}

function getCurrencyOptions(t: (key: string, options?: Record<string, unknown>) => string) {
  return [
    { value: 'CNY', label: t('calculator.currencyCNY', { defaultValue: '¥ CNY (Chinese Yuan)' }) },
    { value: 'USD', label: t('calculator.currencyUSD', { defaultValue: '$ USD (US Dollar)' }) },
    { value: 'EUR', label: t('calculator.currencyEUR', { defaultValue: '€ EUR (Euro)' }) },
    { value: 'JPY', label: t('calculator.currencyJPY', { defaultValue: '¥ JPY (Japanese Yen)' }) },
    { value: 'GBP', label: t('calculator.currencyGBP', { defaultValue: '£ GBP (British Pound)' }) },
    { value: 'KRW', label: t('calculator.currencyKRW', { defaultValue: '₩ KRW (Korean Won)' }) },
  ];
}

const DEFAULT_SETTINGS: CalculatorSettings = { ...DEFAULT_CALCULATOR_SETTINGS };

export function CalculatorSettingsDialog({
  open,
  onOpenChange,
  settings,
  onSettingsChange,
}: CalculatorSettingsDialogProps) {
  const { t } = useTranslation();
  const [localSettings, setLocalSettings] = useState<CalculatorSettings>(
    () => ({ ...DEFAULT_SETTINGS, ...settings })
  );

  const prevOpenRef = useRef(false);
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setLocalSettings({ ...DEFAULT_SETTINGS, ...settings });
    }
    prevOpenRef.current = open;
  }, [settings, open]);

  const handleSave = () => {
    onSettingsChange(localSettings);
    onOpenChange(false);
  };

  const handleReset = () => {
    setLocalSettings({ ...DEFAULT_SETTINGS });
  };

  const updateSetting = <K extends keyof CalculatorSettings>(
    key: K,
    value: CalculatorSettings[K]
  ) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  const numberFormatOptions = getNumberFormatOptions(t);
  const currencyOptions = getCurrencyOptions(t);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            {t('calculator.settingsTitle', { defaultValue: '计算器设置' })}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm">
              <Hash className="h-3.5 w-3.5 text-muted-foreground" />
              {t('calculator.decimalPlaces', { defaultValue: '小数位数' })}
            </Label>
            <Select
              value={String(localSettings.decimalPlaces)}
              onValueChange={(v) => updateSetting('decimalPlaces', parseInt(v, 10))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DECIMAL_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={String(opt.value)}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t('calculator.decimalPlacesHint', { defaultValue: '数值结果将保留指定的小数位数' })}
            </p>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm">
              <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
              {t('calculator.numberFormat', { defaultValue: '数字格式' })}
            </Label>
            <Select
              value={localSettings.numberFormat}
              onValueChange={(v) => updateSetting('numberFormat', v as 'western' | 'chinese')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {numberFormatOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              {t('calculator.dateFormat', { defaultValue: '日期格式' })}
            </Label>
            <Select
              value={localSettings.dateFormat}
              onValueChange={(v) => updateSetting('dateFormat', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_FORMAT_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm">
              <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
              {t('calculator.currency', { defaultValue: '默认货币' })}
            </Label>
            <Select
              value={localSettings.defaultCurrency}
              onValueChange={(v) => updateSetting('defaultCurrency', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {currencyOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm">
              <Divide className="h-3.5 w-3.5 text-muted-foreground" />
              {t('calculator.operatorSymbols', { defaultValue: '乘除符号显示' })}
            </Label>
            <Select
              value={localSettings.operatorSymbols}
              onValueChange={(v) => updateSetting('operatorSymbols', v as 'ascii' | 'cjk')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ascii">
                  {t('calculator.operatorSymbolsAscii', { defaultValue: '半角 * /（默认）' })}
                </SelectItem>
                <SelectItem value="cjk">
                  {t('calculator.operatorSymbolsCjk', { defaultValue: '中文 × ÷（导出与预览）' })}
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t('calculator.operatorSymbolsHint', {
                defaultValue: '输入仍可使用 ×÷ 或 * /；设为中文时，TXT/Markdown/CSV 中的表达式列将显示 × ÷',
              })}
            </p>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm">
              <Hash className="h-3.5 w-3.5 text-muted-foreground" />
              {t('calculator.hashBehavior', { defaultValue: '「#」行含义' })}
            </Label>
            <Select
              value={localSettings.hashBehavior}
              onValueChange={(v) => updateSetting('hashBehavior', v as 'legacy' | 'soulver')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="legacy">
                  {t('calculator.hashBehaviorLegacy', { defaultValue: '传统注释（与 // 相同，不参与分段）' })}
                </SelectItem>
                <SelectItem value="soulver">
                  {t('calculator.hashBehaviorSoulver', { defaultValue: 'Soulver 标题（分段边界，配合小计）' })}
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t('calculator.hashBehaviorHint', {
                defaultValue:
                  '设为 Soulver 时，单独一行的「小计」「subtotal」会对上一标题或上一小计之后的数值行求和；导入 .slvr 时默认启用该模式。',
              })}
            </p>
          </div>

          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2 text-sm">
              <Zap className="h-3.5 w-3.5 text-muted-foreground" />
              {t('calculator.liveUpdate', { defaultValue: '实时计算' })}
            </Label>
            <Switch
              checked={localSettings.liveUpdate}
              onCheckedChange={(checked) => updateSetting('liveUpdate', checked)}
            />
          </div>
          <p className="text-xs text-muted-foreground -mt-4">
            {t('calculator.liveUpdateHint', { defaultValue: '关闭后需要手动按 Enter 计算每行' })}
          </p>

          <div className="border-t pt-4 space-y-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm">
                {t('calculator.editorFontSize', { defaultValue: '编辑器字号' })}
              </Label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={12}
                  max={20}
                  step={1}
                  value={localSettings.editorFontSize}
                  onChange={(e) => updateSetting('editorFontSize', parseInt(e.target.value, 10))}
                  className="flex-1 h-1.5 accent-primary"
                />
                <span className="text-sm tabular-nums w-8 text-right">{localSettings.editorFontSize}px</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">
                {t('calculator.lineHeight', { defaultValue: '行高' })}
              </Label>
              <Select
                value={localSettings.lineHeight}
                onValueChange={(v) => updateSetting('lineHeight', v as 'compact' | 'standard' | 'relaxed')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="compact">{t('calculator.lineHeightCompact', { defaultValue: '紧凑' })}</SelectItem>
                  <SelectItem value="standard">{t('calculator.lineHeightStandard', { defaultValue: '标准' })}</SelectItem>
                  <SelectItem value="relaxed">{t('calculator.lineHeightRelaxed', { defaultValue: '宽松' })}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-sm">
                {t('calculator.stripedRows', { defaultValue: '奇偶行条纹' })}
              </Label>
              <Switch
                checked={localSettings.stripedRows}
                onCheckedChange={(checked) => updateSetting('stripedRows', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-sm">
                {t('calculator.showLineNumbers', { defaultValue: '显示行号' })}
              </Label>
              <Switch
                checked={localSettings.showLineNumbers}
                onCheckedChange={(checked) => updateSetting('showLineNumbers', checked)}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm">
                {t('calculator.resultFormat', { defaultValue: '数字显示格式' })}
              </Label>
              <Select
                value={localSettings.resultFormat || 'number'}
                onValueChange={(v) => updateSetting('resultFormat', v as 'number' | 'accounting' | 'scientific' | 'percent' | 'currency')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="number">{t('calculator.resultFormatNumber', { defaultValue: '普通数字' })}</SelectItem>
                  <SelectItem value="accounting">{t('calculator.resultFormatAccounting', { defaultValue: '会计格式（负数用括号）' })}</SelectItem>
                  <SelectItem value="scientific">{t('calculator.resultFormatScientific', { defaultValue: '科学计数法' })}</SelectItem>
                  <SelectItem value="percent">{t('calculator.resultFormatPercent', { defaultValue: '百分比（×100 + %）' })}</SelectItem>
                  <SelectItem value="currency">{t('calculator.resultFormatCurrency', { defaultValue: '货币格式' })}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="flex justify-between pt-4 border-t">
          <Button variant="ghost" size="sm" onClick={handleReset}>
            {t('common.reset', { defaultValue: '重置' })}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              {t('common.cancel', { defaultValue: '取消' })}
            </Button>
            <Button size="sm" onClick={handleSave}>
              <Check className="h-3 w-3 mr-1" />
              {t('common.save', { defaultValue: '保存' })}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default CalculatorSettingsDialog;
