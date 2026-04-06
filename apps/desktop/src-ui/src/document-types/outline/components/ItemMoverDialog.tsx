/**
 * ItemMoverDialog — 搜索定位移动节点
 *
 * 搜索节点 → 选中目标 → 移动到目标位置（目标内部 / 之后 / 之前）
 */

import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, GitBranch } from 'lucide-react';
import type { OutlineNode } from '../types';
import { findNode } from '../types';

interface ItemMoverDialogProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: OutlineNode[];
  /** 要移动的节点 ID */
  sourceNodeId: string | null;
  onMove: (
    sourceId: string,
    targetId: string,
    position: 'inside' | 'before' | 'after',
  ) => void;
}

/** 扁平化节点，带缩进路径 */
interface FlatEntry {
  node: OutlineNode;
  depth: number;
  pathLabel: string;
}

function flattenNodes(nodes: OutlineNode[], depth = 0, parentPath = ''): FlatEntry[] {
  const result: FlatEntry[] = [];
  for (const node of nodes) {
    const pathLabel = parentPath
      ? `${parentPath} → ${node.plainText || '(空)'}`
      : node.plainText || '(空)';
    result.push({ node, depth, pathLabel });
    if (node.children.length > 0) {
      result.push(...flattenNodes(node.children, depth + 1, pathLabel));
    }
  }
  return result;
}

export function ItemMoverDialog({
  isOpen,
  onClose,
  nodes,
  sourceNodeId,
  onMove,
}: ItemMoverDialogProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [position, setPosition] = useState<'inside' | 'before' | 'after'>('inside');

  const sourceNode = sourceNodeId ? findNode(nodes, sourceNodeId) : null;

  const allFlat = useMemo(() => flattenNodes(nodes), [nodes]);

  const filtered = useMemo(() => {
    if (!search.trim()) return allFlat;
    const q = search.toLowerCase();
    return allFlat.filter(
      e => e.node.plainText.toLowerCase().includes(q) ||
        e.pathLabel.toLowerCase().includes(q),
    );
  }, [allFlat, search]);

  // 过滤掉自身及其后代
  const validTargets = useMemo(() => {
    let result = filtered;
    if (sourceNodeId) {
      const descendantIds = new Set<string>();
      function collectDescendants(node: OutlineNode) {
        descendantIds.add(node.id);
        for (const child of node.children) collectDescendants(child);
      }
      const src = findNode(nodes, sourceNodeId);
      if (src) collectDescendants(src);
      result = filtered.filter(e => !descendantIds.has(e.node.id));
    }
    return result;
  }, [filtered, nodes, sourceNodeId]);

  // 过滤变化时，若选中目标不再有效则清除（推导值，不用 effect）
  const effectiveTargetId = useMemo(() => {
    if (!selectedTargetId) return null;
    const validIds = new Set(validTargets.map(e => e.node.id));
    return validIds.has(selectedTargetId) ? selectedTargetId : null;
  }, [validTargets, selectedTargetId]);

  const handleMove = useCallback(() => {
    if (!sourceNodeId || !effectiveTargetId) return;
    onMove(sourceNodeId, effectiveTargetId, position);
    onClose();
  }, [sourceNodeId, effectiveTargetId, position, onMove, onClose]);

  // 重置状态
  const handleClose = useCallback(() => {
    setSearch('');
    setSelectedTargetId(null);
    setPosition('inside');
    onClose();
  }, [onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="h-4 w-4" />
            {t('outline.itemMover.title', { defaultValue: '移动节点' })}
          </DialogTitle>
        </DialogHeader>

        {sourceNode ? (
          <div className="text-xs text-muted-foreground border rounded px-3 py-2 bg-muted/30">
            {t('outline.itemMover.source', { defaultValue: '移动节点' })}:
            <span className="font-medium text-foreground ml-1">{sourceNode.plainText}</span>
          </div>
        ) : (
          <div className="py-6 text-center text-sm text-muted-foreground">
            <GitBranch className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
            <p>{t('outline.itemMover.noSource', { defaultValue: '请先在大纲中选中一个节点，再打开移动功能。' })}</p>
          </div>
        )}

        {sourceNode && (
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('outline.itemMover.searchPlaceholder', { defaultValue: '搜索目标节点…' })}
              className="pl-8 h-8 text-sm"
            />
          </div>

          <ScrollArea className="h-48 border rounded">
            {validTargets.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                {t('outline.itemMover.noResults', { defaultValue: '没有可用的目标节点' })}
              </div>
            ) : (
              validTargets.map(entry => (
                <button
                  key={entry.node.id}
                  type="button"
                  className={`w-full text-left px-3 py-1.5 text-sm hover:bg-accent/50 transition-colors flex items-center gap-2 ${
                    effectiveTargetId === entry.node.id ? 'bg-accent font-medium' : ''
                  }`}
                  style={{ paddingLeft: `${entry.depth * 16 + 12}px` }}
                  onClick={() => setSelectedTargetId(entry.node.id)}
                  title={entry.pathLabel}
                >
                  <span className="truncate">{entry.node.plainText || '(空)'}</span>
                </button>
              ))
            )}
          </ScrollArea>

          {/* 位置选择 */}
          {effectiveTargetId && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">
                {t('outline.itemMover.position', { defaultValue: '放置位置' })}:
              </span>
              {(['inside', 'before', 'after'] as const).map(pos => (
                <Button
                  key={pos}
                  variant={position === pos ? 'default' : 'outline'}
                  size="sm"
                  className="h-6 text-xs px-2"
                  onClick={() => setPosition(pos)}
                >
                  {pos === 'inside'
                    ? t('outline.itemMover.inside', { defaultValue: '内部' })
                    : pos === 'before'
                      ? t('outline.itemMover.before', { defaultValue: '之前' })
                      : t('outline.itemMover.after', { defaultValue: '之后' })}
                </Button>
              ))}
            </div>
          )}
        </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {t('common.cancel', { defaultValue: '取消' })}
          </Button>
          <Button onClick={handleMove} disabled={!sourceNode || !selectedTargetId}>
            {t('outline.itemMover.confirmMove', { defaultValue: '移动' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ItemMoverDialog;
