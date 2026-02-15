import { useState } from 'react';
import type { Slide, SlideLayout } from '@aidocplus/shared-types';
import { Button, Label, Input } from '../_framework/ui';
import { usePluginHost } from '../_framework/PluginHostAPI';
import { Plus, X } from 'lucide-react';

interface SlideEditorProps {
  slide: Slide;
  onSlideChange: (slide: Slide) => void;
}

const LAYOUT_OPTIONS: { value: SlideLayout; label: string }[] = [
  { value: 'title', label: '封面' },
  { value: 'section', label: '章节页' },
  { value: 'content', label: '内容页' },
  { value: 'two-column', label: '双栏' },
  { value: 'blank', label: '空白' },
];

export function SlideEditor({ slide, onSlideChange }: SlideEditorProps) {
  const host = usePluginHost();
  const t = host.platform.t;
  const [newBullet, setNewBullet] = useState('');

  const updateField = <K extends keyof Slide>(key: K, value: Slide[K]) => {
    onSlideChange({ ...slide, [key]: value });
  };

  const handleAddBullet = () => {
    if (!newBullet.trim()) return;
    updateField('content', [...slide.content, newBullet.trim()]);
    setNewBullet('');
  };

  const handleRemoveBullet = (index: number) => {
    updateField('content', slide.content.filter((_, i) => i !== index));
  };

  const handleUpdateBullet = (index: number, value: string) => {
    const newContent = [...slide.content];
    newContent[index] = value;
    updateField('content', newContent);
  };

  return (
    <div className="w-full max-w-[640px] space-y-4">
      <div className="text-sm font-medium">{t('slides.editSlide', { defaultValue: '编辑幻灯片' })}</div>

      {/* 版式选择 */}
      <div className="space-y-1">
        <Label className="text-xs">{t('slides.layout', { defaultValue: '版式' })}</Label>
        <div className="flex gap-1 flex-wrap">
          {LAYOUT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => updateField('layout', opt.value)}
              className={`px-3 py-1 rounded-md text-xs border transition-all ${
                slide.layout === opt.value
                  ? 'border-primary bg-primary/10 font-medium'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 标题 */}
      <div className="space-y-1">
        <Label className="text-xs">{t('slides.title', { defaultValue: '标题' })}</Label>
        <Input
          value={slide.title}
          onChange={(e) => updateField('title', e.target.value)}
          placeholder={t('slides.titlePlaceholder', { defaultValue: '幻灯片标题' })}
        />
      </div>

      {/* 副标题 */}
      {(slide.layout === 'title' || slide.layout === 'section') && (
        <div className="space-y-1">
          <Label className="text-xs">{t('slides.subtitle', { defaultValue: '副标题' })}</Label>
          <Input
            value={slide.subtitle || ''}
            onChange={(e) => updateField('subtitle', e.target.value || undefined)}
            placeholder={t('slides.subtitlePlaceholder', { defaultValue: '副标题（可选）' })}
          />
        </div>
      )}

      {/* 内容要点 */}
      {slide.layout !== 'blank' && (
        <div className="space-y-1">
          <Label className="text-xs">{t('slides.contentBullets', { defaultValue: '内容要点' })}</Label>
          <div className="space-y-1">
            {slide.content.map((item, i) => (
              <div key={i} className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground w-5 text-right flex-shrink-0">{i + 1}.</span>
                <Input
                  value={item}
                  onChange={(e) => handleUpdateBullet(i, e.target.value)}
                  className="h-8 text-sm"
                />
                <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={() => handleRemoveBullet(i)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-1 mt-1">
            <Input
              value={newBullet}
              onChange={(e) => setNewBullet(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddBullet()}
              placeholder={t('slides.addBulletPlaceholder', { defaultValue: '添加要点...' })}
              className="h-8 text-sm"
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
            />
            <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={handleAddBullet} disabled={!newBullet.trim()}>
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      {/* 演讲者备注 */}
      <div className="space-y-1">
        <Label className="text-xs">{t('slides.speakerNotes', { defaultValue: '演讲者备注' })}</Label>
        <textarea
          value={slide.notes || ''}
          onChange={(e) => updateField('notes', e.target.value || undefined)}
          placeholder={t('slides.notesPlaceholder', { defaultValue: '演讲者备注（可选）' })}
          className="w-full min-h-[60px] px-3 py-2 text-sm border rounded-md bg-background resize-y focus:outline-none focus:ring-1 focus:ring-ring"
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
        />
      </div>
    </div>
  );
}
