/**
 * Mermaid 代码生成/反向解析工具
 * characterRelations[] ↔ Mermaid graph 双向转换
 */

import type { NovelCharacter, NovelCharacterRelation } from '../types';

/**
 * 从人物关系数据生成 Mermaid graph LR 代码
 */
export function relationsToMermaid(
  characters: NovelCharacter[],
  relations: NovelCharacterRelation[],
): string {
  if (relations.length === 0 && characters.length === 0) return '';
  if (relations.length === 0) {
    // 只有角色没有关系时，显示独立节点
    const lines = ['graph LR'];
    for (const c of characters) {
      const nodeId = safeNodeId(c.id);
      const style = c.color ? `\n  style ${nodeId} fill:${c.color},color:#fff` : '';
      lines.push(`  ${nodeId}["${escapeMermaid(c.name)}"]${style}`);
    }
    return lines.join('\n');
  }

  const charMap = new Map(characters.map(c => [c.id, c]));
  const lines = ['graph LR'];
  const mentionedIds = new Set<string>();

  for (const rel of relations) {
    const fromChar = charMap.get(rel.fromId);
    const toChar = charMap.get(rel.toId);
    if (!fromChar || !toChar) continue;

    const fromNode = safeNodeId(rel.fromId);
    const toNode = safeNodeId(rel.toId);
    const label = rel.label || rel.type || '关联';
    const arrow = rel.bidirectional !== false ? '<-->' : '-->';

    if (!mentionedIds.has(rel.fromId)) {
      lines.push(`  ${fromNode}["${escapeMermaid(fromChar.name)}"]`);
      mentionedIds.add(rel.fromId);
    }
    if (!mentionedIds.has(rel.toId)) {
      lines.push(`  ${toNode}["${escapeMermaid(toChar.name)}"]`);
      mentionedIds.add(rel.toId);
    }

    lines.push(`  ${fromNode} ${arrow}|"${escapeMermaid(label)}"|${toNode}`);
  }

  // 添加颜色样式
  for (const c of characters) {
    if (c.color && mentionedIds.has(c.id)) {
      lines.push(`  style ${safeNodeId(c.id)} fill:${c.color},color:#fff`);
    }
  }

  return lines.join('\n');
}

/**
 * 尝试从 Mermaid 代码反向解析出关系
 * 返回 null 表示无法解析（用户可能手动编辑了复杂语法）
 */
export function parseMermaidToRelations(
  mermaidCode: string,
  characters: NovelCharacter[],
): NovelCharacterRelation[] | null {
  try {
    const lines = mermaidCode.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return [];
    // 跳过 graph 声明行
    const dataLines = lines.filter(l => !l.startsWith('graph ') && !l.startsWith('style '));

    const charByName = new Map(characters.map(c => [c.name, c]));
    const relations: NovelCharacterRelation[] = [];

    // 匹配: NodeA <-->|"label"|NodeB 或 NodeA -->|"label"|NodeB
    const arrowRe = /^(\w+)\s*(<?-->?)\|"?([^"|]*)"?\|(\w+)$/;

    for (const line of dataLines) {
      const match = line.match(arrowRe);
      if (!match) continue;

      const [, , arrow, label, ] = match;
      // 需要从节点定义中找到对应角色
      const bidirectional = arrow.includes('<');

      // 从所有行中查找节点名
      const fromName = findNodeName(lines, match[1]);
      const toName = findNodeName(lines, match[4]);
      if (!fromName || !toName) continue;

      const fromChar = charByName.get(fromName);
      const toChar = charByName.get(toName);
      if (!fromChar || !toChar) continue;

      relations.push({
        id: `rel_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        fromId: fromChar.id,
        toId: toChar.id,
        type: label || '关联',
        label: label || undefined,
        bidirectional,
      });
    }

    return relations;
  } catch {
    return null;
  }
}

function findNodeName(lines: string[], nodeId: string): string | null {
  // 匹配: nodeId["name"] 或 nodeId("name")
  const re = new RegExp(`^${nodeId}\\s*\\[?"?([^"\\]]+)"?\\]?`);
  for (const line of lines) {
    const m = line.trim().match(re);
    if (m) return m[1];
  }
  return null;
}

function safeNodeId(id: string): string {
  // Mermaid 节点 ID 只能用字母数字下划线
  return 'n_' + id.replace(/[^a-zA-Z0-9_]/g, '_');
}

function escapeMermaid(text: string): string {
  return text.replace(/"/g, "'").replace(/\n/g, ' ');
}
