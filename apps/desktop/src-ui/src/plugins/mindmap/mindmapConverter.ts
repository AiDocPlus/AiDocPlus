/**
 * Markdown ↔ simple-mind-map JSON 双向转换器
 *
 * - markdownToMindMapData: 将 Markdown 标题层级结构转换为 simple-mind-map 的 JSON 树
 * - mindMapDataToMarkdown: 将 simple-mind-map 的 JSON 树转换回 Markdown
 */

// ── simple-mind-map 节点数据结构 ──

export interface SMNodeData {
  text: string;
  expand?: boolean;
  richText?: boolean;
  // simple-mind-map 还支持 image, icon, hyperlink, note, tag 等，后续按需扩展
  [key: string]: unknown;
}

export interface SMNode {
  data: SMNodeData;
  children: SMNode[];
}

// ── Markdown → JSON ──

/**
 * 将 Markdown 标题层级结构转换为 simple-mind-map 的 JSON 树
 *
 * 支持的格式：
 * - # 根节点
 * - ## 一级分支
 * - ### 二级分支
 * - 缩进列表（- 或 * 开头）作为叶子节点
 */
export function markdownToMindMapData(markdown: string): SMNode {
  if (!markdown?.trim()) {
    return { data: { text: '思维导图' }, children: [] };
  }

  const lines = markdown.split('\n');
  const root: SMNode = { data: { text: '思维导图' }, children: [] };

  // 用栈维护父子关系: [node, depth]
  const stack: Array<{ node: SMNode; depth: number }> = [{ node: root, depth: 0 }];
  // 记录最后一个标题的深度，用于列表项深度计算的固定锚点
  let lastHeadingDepth = 0;

  for (const line of lines) {
    const trimmed = line.trimEnd();
    if (!trimmed) continue;

    // 匹配 Markdown 标题: # ## ### ####
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      const depth = headingMatch[1].length;
      const text = headingMatch[2].trim();
      const node: SMNode = { data: { text }, children: [] };

      if (depth === 1) {
        // 根节点，更新 root 的 text
        root.data.text = text;
        // 重置栈
        stack.length = 1;
        stack[0] = { node: root, depth: 1 };
      } else {
        // 找到合适的父节点
        while (stack.length > 1 && stack[stack.length - 1].depth >= depth) {
          stack.pop();
        }
        const parent = stack[stack.length - 1].node;
        parent.children.push(node);
        stack.push({ node, depth });
      }
      lastHeadingDepth = depth;
      continue;
    }

    // 匹配缩进列表: - item 或 * item 或 数字. item
    const listMatch = trimmed.match(/^(\s*)([-*+]|\d+\.)\s+(.+)/);
    if (listMatch) {
      const indent = listMatch[1].length;
      const text = listMatch[3].trim();
      const node: SMNode = { data: { text }, children: [] };

      // 列表项的深度基于最后一个标题的深度（固定锚点），而非栈顶
      // 这样同缩进的列表项始终获得相同深度，成为兄弟节点
      const listDepth = lastHeadingDepth + 1 + Math.floor(indent / 2);

      while (stack.length > 1 && stack[stack.length - 1].depth >= listDepth) {
        stack.pop();
      }
      const parent = stack[stack.length - 1].node;
      parent.children.push(node);
      stack.push({ node, depth: listDepth });
      continue;
    }

    // 纯文本行：作为当前最后节点的子节点或忽略
    // 保守策略：忽略非标题非列表行
  }

  return root;
}

// ── JSON → Markdown ──

/**
 * 将 simple-mind-map 的 JSON 树转换回 Markdown 标题层级结构
 */
export function mindMapDataToMarkdown(node: SMNode, depth = 1): string {
  if (!node) return '';

  const lines: string[] = [];
  const prefix = '#'.repeat(Math.min(depth, 6));
  const text = node.data?.text?.trim() || '';

  if (text) {
    if (depth <= 6) {
      lines.push(`${prefix} ${text}`);
    } else {
      // 超过 6 级用列表表示
      const indent = '  '.repeat(depth - 7);
      lines.push(`${indent}- ${text}`);
    }
  }

  if (node.children?.length) {
    for (const child of node.children) {
      lines.push(mindMapDataToMarkdown(child, depth + 1));
    }
  }

  return lines.join('\n');
}

// ── 辅助函数 ──

/**
 * 检查数据是否为有效的 simple-mind-map JSON 节点
 */
export function isValidSMNode(data: unknown): data is SMNode {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  if (!d.data || typeof d.data !== 'object') return false;
  const nodeData = d.data as Record<string, unknown>;
  if (typeof nodeData.text !== 'string') return false;
  return true;
}

/**
 * 统计节点总数
 */
export function countNodes(node: SMNode): number {
  if (!node) return 0;
  let count = 1;
  if (node.children?.length) {
    for (const child of node.children) {
      count += countNodes(child);
    }
  }
  return count;
}

/**
 * 获取最大深度
 */
export function getMaxDepth(node: SMNode, current = 1): number {
  if (!node?.children?.length) return current;
  let max = current;
  for (const child of node.children) {
    max = Math.max(max, getMaxDepth(child, current + 1));
  }
  return max;
}

/**
 * 将子树导出为独立 Markdown（根节点作为 #）
 */
export function extractBranchAsMarkdown(node: SMNode): string {
  return mindMapDataToMarkdown(node, 1);
}

/**
 * 将 AI 返回的 Markdown 解析为子节点数组（跳过根节点，只取其 children）
 *
 * 如果 Markdown 只有一个 # 根节点，返回其 children；
 * 如果没有 # 根节点（全是 ## 开头），将所有顶层节点作为数组返回。
 */
export function markdownToBranch(md: string): SMNode[] {
  if (!md?.trim()) return [];
  const tree = markdownToMindMapData(md);
  // 如果 AI 返回了完整的根节点结构，取其子节点
  if (tree.children.length > 0) return tree.children;
  // 否则返回根节点本身作为单个分支
  return [tree];
}

/**
 * 合并新分支到父节点（追加模式）
 */
export function mergeBranchToNode(parent: SMNode, newChildren: SMNode[]): SMNode {
  return {
    ...parent,
    children: [...(parent.children || []), ...newChildren],
  };
}
