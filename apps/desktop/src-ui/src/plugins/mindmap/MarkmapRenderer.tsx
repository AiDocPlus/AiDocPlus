/**
 * Markmap 渲染器 — React 组件封装
 *
 * 封装 markmap-lib + markmap-view，提供：
 * - Markdown → 交互式 SVG 思维导图
 * - 缩放/平移/折叠节点（markmap 内置）
 * - 颜色方案配置
 * - 适应窗口/导出 SVG
 */

import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import type { MindmapColorScheme } from './types';
import { MINDMAP_COLOR_SCHEMES } from './types';

export interface MarkmapRendererRef {
  fitContent: () => void;
  getSvgElement: () => SVGSVGElement | null;
}

interface MarkmapRendererProps {
  markdown: string;
  colorScheme?: MindmapColorScheme;
  className?: string;
}

export const MarkmapRenderer = forwardRef<MarkmapRendererRef, MarkmapRendererProps>(
  function MarkmapRenderer({ markdown, colorScheme = 'colorful', className }, ref) {
    const svgRef = useRef<SVGSVGElement>(null);
    const mmRef = useRef<any>(null);

    // 获取颜色数组
    const colors = MINDMAP_COLOR_SCHEMES.find(s => s.key === colorScheme)?.colors
      || MINDMAP_COLOR_SCHEMES[0].colors;

    // 初始化 markmap
    useEffect(() => {
      let cancelled = false;

      const init = async () => {
        if (!svgRef.current) return;

        const { Transformer } = await import('markmap-lib');
        const { Markmap } = await import('markmap-view');

        if (cancelled) return;

        const transformer = new Transformer();
        const { root } = transformer.transform(markdown || '# 思维导图');

        // 清理旧实例
        if (mmRef.current) {
          try { mmRef.current.destroy(); } catch { /* ignore */ }
        }
        svgRef.current.innerHTML = '';

        const mm = Markmap.create(svgRef.current, {
          color: (node: any) => {
            const depth = node.state?.depth ?? node.depth ?? 0;
            return colors[depth % colors.length];
          },
          paddingX: 16,
          autoFit: true,
          duration: 300,
        }, root);

        mmRef.current = mm;
      };

      init();

      return () => { cancelled = true; };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // 仅初始化一次

    // 数据更新
    useEffect(() => {
      if (!mmRef.current || !markdown) return;

      const update = async () => {
        const { Transformer } = await import('markmap-lib');
        const transformer = new Transformer();
        const { root } = transformer.transform(markdown);
        mmRef.current.setData(root);
        mmRef.current.fit();
      };

      update();
    }, [markdown]);

    // 颜色方案更新
    useEffect(() => {
      if (!mmRef.current) return;
      mmRef.current.setOptions({
        color: (node: any) => {
          const depth = node.state?.depth ?? node.depth ?? 0;
          return colors[depth % colors.length];
        },
      });
      // 刷新渲染
      const update = async () => {
        if (!markdown) return;
        const { Transformer } = await import('markmap-lib');
        const transformer = new Transformer();
        const { root } = transformer.transform(markdown);
        mmRef.current.setData(root);
        mmRef.current.fit();
      };
      update();
    }, [colors, markdown]);

    // 暴露方法
    const fitContent = useCallback(() => {
      mmRef.current?.fit();
    }, []);

    const getSvgElement = useCallback(() => {
      return svgRef.current;
    }, []);

    useImperativeHandle(ref, () => ({
      fitContent,
      getSvgElement,
    }), [fitContent, getSvgElement]);

    return (
      <svg
        ref={svgRef}
        className={className}
        style={{ width: '100%', height: '100%', minHeight: '300px' }}
      />
    );
  },
);
