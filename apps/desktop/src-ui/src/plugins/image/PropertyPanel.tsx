/**
 * 选中对象属性面板
 *
 * 当画布上有对象被选中时，在右侧浮动显示属性编辑器。
 * 支持编辑：位置/尺寸、填充色/描边色、透明度、文字属性等。
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { FabricCanvasEditorRef } from './FabricCanvasEditor';
import {
  X, RotateCw, Lock, Unlock, FlipHorizontal, FlipVertical,
  ArrowUp, ArrowDown, Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ObjectProps {
  type: string;
  left: number;
  top: number;
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
  angle: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
  // 文字属性
  fontSize?: number;
  fontWeight?: string;
  fontStyle?: string;
  textAlign?: string;
  text?: string;
  // 锁定
  lockMovementX?: boolean;
  lockMovementY?: boolean;
}

interface PropertyPanelProps {
  editorRef: React.RefObject<FabricCanvasEditorRef | null>;
  selectedCount: number;
  onClose: () => void;
}

function readObjectProps(editor: FabricCanvasEditorRef): ObjectProps | null {
  const fc = editor.getInstance();
  if (!fc) return null;
  const obj = fc.getActiveObject();
  if (!obj) return null;
  return {
    type: String(obj.type || 'object'),
    left: Math.round(Number(obj.left || 0)),
    top: Math.round(Number(obj.top || 0)),
    width: Math.round(Number(obj.width || 0)),
    height: Math.round(Number(obj.height || 0)),
    scaleX: Number(obj.scaleX ?? 1),
    scaleY: Number(obj.scaleY ?? 1),
    angle: Math.round(Number(obj.angle || 0)),
    fill: typeof obj.fill === 'string' ? obj.fill : '',
    stroke: typeof obj.stroke === 'string' ? obj.stroke : '',
    strokeWidth: Number(obj.strokeWidth ?? 1),
    opacity: Number(obj.opacity ?? 1),
    fontSize: (obj as any).fontSize,
    fontWeight: (obj as any).fontWeight,
    fontStyle: (obj as any).fontStyle,
    textAlign: (obj as any).textAlign,
    text: (obj as any).text,
    lockMovementX: (obj as any).lockMovementX,
    lockMovementY: (obj as any).lockMovementY,
  };
}

export function PropertyPanel({ editorRef, selectedCount, onClose }: PropertyPanelProps) {
  const [props, setProps] = useState<ObjectProps | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshProps = useCallback(() => {
    const editor = editorRef.current;
    if (!editor || selectedCount === 0) {
      setProps(null);
      return;
    }
    setProps(readObjectProps(editor));
  }, [editorRef, selectedCount]);

  useEffect(() => {
    refreshProps();
    // 定时刷新以跟踪拖拽等实时变化
    refreshTimerRef.current = setInterval(refreshProps, 300);
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [refreshProps]);

  const updateProp = useCallback((key: string, value: unknown) => {
    const editor = editorRef.current;
    if (!editor) return;
    const fc = editor.getInstance();
    if (!fc) return;
    const obj = fc.getActiveObject();
    if (!obj) return;
    obj.set({ [key]: value } as any);
    obj.setCoords();
    fc.requestRenderAll();
    // 触发 modified 以保存
    fc.fire('object:modified', { target: obj } as any);
    refreshProps();
  }, [editorRef, refreshProps]);

  if (selectedCount === 0 || !props) return null;

  const isText = props.type === 'textbox' || props.type === 'i-text' || props.type === 'text';
  const isMulti = selectedCount > 1;
  const isLocked = props.lockMovementX && props.lockMovementY;
  const actualW = Math.round(props.width * props.scaleX);
  const actualH = Math.round(props.height * props.scaleY);

  return (
    <div className="absolute right-2 top-2 w-52 bg-background border rounded-lg shadow-lg z-30 overflow-hidden text-xs">
      {/* 标题 */}
      <div className="flex items-center justify-between px-2 py-1.5 bg-muted/50 border-b">
        <span className="font-medium truncate">
          {isMulti ? `${selectedCount} 个对象` : props.type}
        </span>
        <button onClick={onClose} className="p-0.5 rounded hover:bg-accent" title="关闭属性面板">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="p-2 space-y-2 max-h-[420px] overflow-y-auto">
        {/* ── 位置/尺寸 ── */}
        {!isMulti && (
          <Section title="位置与尺寸">
            <div className="grid grid-cols-2 gap-1">
              <PropField label="X" value={props.left} onChange={v => updateProp('left', Number(v))} />
              <PropField label="Y" value={props.top} onChange={v => updateProp('top', Number(v))} />
              <PropField label="W" value={actualW} onChange={v => {
                if (props.width > 0) updateProp('scaleX', Number(v) / props.width);
              }} />
              <PropField label="H" value={actualH} onChange={v => {
                if (props.height > 0) updateProp('scaleY', Number(v) / props.height);
              }} />
            </div>
            <div className="flex items-center gap-1 mt-1">
              <PropField label="角度" value={props.angle} onChange={v => updateProp('angle', Number(v))} />
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" title="重置角度"
                onClick={() => updateProp('angle', 0)}>
                <RotateCw className="h-3 w-3" />
              </Button>
            </div>
          </Section>
        )}

        {/* ── 外观 ── */}
        <Section title="外观">
          <div className="space-y-1">
            <ColorField label="填充" value={props.fill} onChange={v => updateProp('fill', v)} />
            <ColorField label="描边" value={props.stroke} onChange={v => updateProp('stroke', v)} />
            <div className="flex items-center gap-1">
              <PropField label="描边粗" value={props.strokeWidth} onChange={v => updateProp('strokeWidth', Number(v))} />
              <PropField label="透明度" value={Math.round(props.opacity * 100)}
                onChange={v => updateProp('opacity', Math.max(0, Math.min(100, Number(v))) / 100)} />
            </div>
          </div>
        </Section>

        {/* ── 文字属性 ── */}
        {isText && (
          <Section title="文字">
            <div className="space-y-1">
              <PropField label="字号" value={props.fontSize || 20}
                onChange={v => updateProp('fontSize', Number(v))} />
              <div className="flex items-center gap-1">
                <Button variant={props.fontWeight === 'bold' ? 'default' : 'outline'} size="sm"
                  className="h-6 px-2 text-[10px] font-bold"
                  onClick={() => updateProp('fontWeight', props.fontWeight === 'bold' ? 'normal' : 'bold')}
                  title="粗体">
                  B
                </Button>
                <Button variant={props.fontStyle === 'italic' ? 'default' : 'outline'} size="sm"
                  className="h-6 px-2 text-[10px] italic"
                  onClick={() => updateProp('fontStyle', props.fontStyle === 'italic' ? 'normal' : 'italic')}
                  title="斜体">
                  I
                </Button>
                <select value={props.textAlign || 'left'} title="文字对齐"
                  onChange={e => updateProp('textAlign', e.target.value)}
                  className="h-6 text-[10px] border rounded px-1 bg-background">
                  <option value="left">左对齐</option>
                  <option value="center">居中</option>
                  <option value="right">右对齐</option>
                </select>
              </div>
            </div>
          </Section>
        )}

        {/* ── 操作按钮 ── */}
        <Section title="操作">
          <div className="flex flex-wrap gap-1">
            <Button variant="outline" size="sm" className="h-6 px-1.5 text-[10px] gap-0.5"
              title="水平翻转"
              onClick={() => {
                const editor = editorRef.current;
                if (!editor) return;
                const fc = editor.getInstance();
                const obj = fc?.getActiveObject();
                if (obj) { obj.set({ flipX: !obj.flipX }); fc?.requestRenderAll(); }
              }}>
              <FlipHorizontal className="h-3 w-3" />翻转H
            </Button>
            <Button variant="outline" size="sm" className="h-6 px-1.5 text-[10px] gap-0.5"
              title="垂直翻转"
              onClick={() => {
                const editor = editorRef.current;
                if (!editor) return;
                const fc = editor.getInstance();
                const obj = fc?.getActiveObject();
                if (obj) { obj.set({ flipY: !obj.flipY }); fc?.requestRenderAll(); }
              }}>
              <FlipVertical className="h-3 w-3" />翻转V
            </Button>
            <Button variant="outline" size="sm" className="h-6 px-1.5 text-[10px] gap-0.5"
              title={isLocked ? '解锁' : '锁定'}
              onClick={() => {
                const lock = !isLocked;
                updateProp('lockMovementX', lock);
                updateProp('lockMovementY', lock);
                updateProp('lockRotation', lock);
                updateProp('lockScalingX', lock);
                updateProp('lockScalingY', lock);
              }}>
              {isLocked ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
              {isLocked ? '解锁' : '锁定'}
            </Button>
            <Button variant="outline" size="sm" className="h-6 px-1.5 text-[10px] gap-0.5"
              title="上移一层"
              onClick={() => editorRef.current?.bringForward()}>
              <ArrowUp className="h-3 w-3" />上移
            </Button>
            <Button variant="outline" size="sm" className="h-6 px-1.5 text-[10px] gap-0.5"
              title="下移一层"
              onClick={() => editorRef.current?.sendBackward()}>
              <ArrowDown className="h-3 w-3" />下移
            </Button>
            {isMulti && (
              <>
                <Button variant="outline" size="sm" className="h-6 px-1.5 text-[10px] gap-0.5"
                  title="编组"
                  onClick={() => editorRef.current?.groupSelected()}>
                  <Layers className="h-3 w-3" />编组
                </Button>
              </>
            )}
          </div>
        </Section>
      </div>
    </div>
  );
}

// ── 子组件 ──

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] text-muted-foreground font-medium mb-0.5">{title}</div>
      {children}
    </div>
  );
}

function PropField({ label, value, onChange }: { label: string; value: string | number; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-0.5">
      <span className="text-[10px] text-muted-foreground w-5 flex-shrink-0">{label}</span>
      <Input
        className="h-5 px-1 text-[10px] font-mono"
        value={value}
        title={label}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
      />
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[10px] text-muted-foreground w-5 flex-shrink-0">{label}</span>
      <input type="color" value={value || '#000000'} title={`${label}颜色`}
        onChange={e => onChange(e.target.value)}
        className="h-5 w-5 rounded border cursor-pointer p-0" />
      <Input
        className="h-5 px-1 text-[10px] font-mono flex-1"
        value={value}
        title={`${label}颜色值`}
        onChange={e => onChange(e.target.value)}
        placeholder="#000000"
      />
    </div>
  );
}
