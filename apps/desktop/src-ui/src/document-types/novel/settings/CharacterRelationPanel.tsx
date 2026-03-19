/**
 * CharacterRelationPanel — 人物关系管理
 * 左侧：关系列表编辑
 * 右侧：Mermaid 关系图可视化 + 代码编辑
 */
import { useState, useMemo, useCallback, useEffect } from 'react';
import { Plus, Trash2, Network } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MarkdownPreview } from '@/components/editor/MarkdownPreview';
import type { NovelDocumentContent, NovelCharacterRelation } from '../types';
import { addCharacterRelation, updateCharacterRelation, deleteCharacterRelation } from '../types';
import { relationsToMermaid } from './relationMermaid';

interface CharacterRelationPanelProps {
  novel: NovelDocumentContent;
  onNovelChange: (novel: NovelDocumentContent) => void;
}

const RELATION_TYPES = [
  '亲属', '朋友', '敌人', '恋人', '师生', '同事', '主仆', '竞争', '同盟', '暗恋', '仇敌',
];

const LABEL = 'text-xs text-muted-foreground font-medium';

export default function CharacterRelationPanel({ novel, onNovelChange }: CharacterRelationPanelProps) {
  const characters = novel.settings.characters;
  const relations = novel.settings.characterRelations;

  const [showCode, setShowCode] = useState(false);
  const [mermaidCode, setMermaidCode] = useState('');

  // 自动生成 Mermaid 代码
  const autoCode = useMemo(() => relationsToMermaid(characters, relations), [characters, relations]);

  useEffect(() => {
    setMermaidCode(autoCode);
  }, [autoCode]);

  const handleAdd = useCallback(() => {
    if (characters.length < 2) return;
    const from = characters[0];
    const to = characters[1];
    onNovelChange(addCharacterRelation(novel, from.id, to.id, '朋友'));
  }, [novel, characters, onNovelChange]);

  const handleUpdateRel = useCallback((relId: string, patch: Partial<NovelCharacterRelation>) => {
    onNovelChange(updateCharacterRelation(novel, relId, patch));
  }, [novel, onNovelChange]);

  const handleDeleteRel = useCallback((relId: string) => {
    onNovelChange(deleteCharacterRelation(novel, relId));
  }, [novel, onNovelChange]);

  // Mermaid 内容包裹为 markdown 代码块
  const mermaidMarkdown = useMemo(() => {
    if (!mermaidCode.trim()) return '';
    return '```mermaid\n' + mermaidCode + '\n```';
  }, [mermaidCode]);

  return (
    <div className="flex h-full min-h-0 gap-0">
      {/* ── 左侧：关系列表编辑 ── */}
      <div className="w-[380px] flex-shrink-0 border-r flex flex-col min-h-0">
        <div className="flex items-center justify-between px-3 py-1.5 border-b flex-shrink-0">
          <span className="text-xs text-muted-foreground">{relations.length} 条关系</span>
          <Button variant="outline" size="sm" className="h-6 text-xs gap-1" onClick={handleAdd}
            disabled={characters.length < 2} title={characters.length < 2 ? '至少需要 2 个角色' : '添加关系'}>
            <Plus className="h-3 w-3" />添加关系
          </Button>
        </div>

        <div className="flex-1 overflow-auto p-2 space-y-1.5">
          {relations.length === 0 && (
            <div className="text-center text-xs text-muted-foreground py-8">
              <Network className="h-8 w-8 mx-auto opacity-20 mb-2" />
              <p>暂无人物关系</p>
              <p className="mt-1">至少添加 2 个角色后，可创建关系</p>
            </div>
          )}
          {relations.map(rel => (
            <div key={rel.id} className="rounded border p-2 space-y-1.5 bg-background">
              <div className="flex items-center gap-1.5">
                {/* 角色 A */}
                <select className="text-xs border rounded px-1.5 py-1 bg-background flex-1 min-w-0" title="角色A"
                  value={rel.fromId} onChange={e => handleUpdateRel(rel.id, { fromId: e.target.value })}>
                  {characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {/* 方向 */}
                <button className="text-xs px-1.5 py-0.5 rounded border hover:bg-accent flex-shrink-0"
                  onClick={() => handleUpdateRel(rel.id, { bidirectional: !rel.bidirectional })}
                  title={rel.bidirectional !== false ? '双向关系（点击切换为单向）' : '单向关系（点击切换为双向）'}>
                  {rel.bidirectional !== false ? '⟷' : '→'}
                </button>
                {/* 角色 B */}
                <select className="text-xs border rounded px-1.5 py-1 bg-background flex-1 min-w-0" title="角色B"
                  value={rel.toId} onChange={e => handleUpdateRel(rel.id, { toId: e.target.value })}>
                  {characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {/* 删除 */}
                <button className="p-1 rounded hover:bg-destructive/10 text-destructive flex-shrink-0" title="删除"
                  onClick={() => handleDeleteRel(rel.id)}>
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                <label className={LABEL}>类型</label>
                <select className="text-xs border rounded px-1.5 py-0.5 bg-background" title="关系类型"
                  value={rel.type} onChange={e => handleUpdateRel(rel.id, { type: e.target.value })}>
                  {RELATION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <label className={LABEL}>标签</label>
                <input className="flex-1 text-xs border rounded px-1.5 py-0.5 bg-background"
                  value={rel.label || ''} onChange={e => handleUpdateRel(rel.id, { label: e.target.value })} placeholder="如：义兄、师傅" />
              </div>
              <input className="w-full text-xs border rounded px-1.5 py-0.5 bg-background"
                value={rel.description || ''} onChange={e => handleUpdateRel(rel.id, { description: e.target.value })}
                placeholder="关系描述..." />
            </div>
          ))}
        </div>
      </div>

      {/* ── 右侧：Mermaid 可视化 ── */}
      <div className="flex-1 min-w-0 flex flex-col min-h-0">
        {/* 切换栏 */}
        <div className="flex items-center gap-2 px-3 py-1.5 border-b flex-shrink-0">
          <button className={`text-xs px-2 py-0.5 rounded ${!showCode ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => setShowCode(false)}>关系图</button>
          <button className={`text-xs px-2 py-0.5 rounded ${showCode ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => setShowCode(true)}>Mermaid 代码</button>
        </div>

        {showCode ? (
          <div className="flex-1 p-2 min-h-0">
            <textarea
              className="w-full h-full text-xs font-mono border rounded p-2 bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              value={mermaidCode}
              onChange={e => setMermaidCode(e.target.value)}
              placeholder="graph LR&#10;  A[&quot;角色A&quot;] <-->|&quot;朋友&quot;|B[&quot;角色B&quot;]"
            />
          </div>
        ) : (
          <div className="flex-1 overflow-auto p-3 min-h-0">
            {mermaidMarkdown ? (
              <MarkdownPreview content={mermaidMarkdown} className="text-sm" />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                <div className="text-center space-y-2">
                  <Network className="h-10 w-10 mx-auto opacity-20" />
                  <p>添加人物关系后，将自动生成关系图</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
