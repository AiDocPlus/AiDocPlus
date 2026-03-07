/**
 * SimpleMindMap 渲染器 — React 组件封装
 *
 * 封装 simple-mind-map 库，提供：
 * - JSON 数据 → 交互式思维导图（支持编辑、拖拽、缩放/平移）
 * - 多布局：逻辑结构图、思维导图、组织结构图、目录组织图、时间线、鱼骨图
 * - 节点双击编辑、拖拽重排
 * - 撤销/重做
 * - 适应窗口 / 导出 SVG
 */

import { useEffect, useRef, useCallback, useState, forwardRef, useImperativeHandle } from 'react';
import type { SMNode } from './mindmapConverter';
import { mindMapDataToMarkdown } from './mindmapConverter';

// ── 布局类型 ──
export type MindMapLayout =
  | 'logicalStructure'
  | 'logicalStructureLeft'
  | 'mindMap'
  | 'organizationStructure'
  | 'catalogOrganization'
  | 'timeline'
  | 'timeline2'
  | 'fishbone';

// ── 主题映射（simple-mind-map 内置主题） ──
export const SM_THEMES = [
  { key: 'default',      label: '默认' },
  { key: 'classic',      label: '经典' },
  { key: 'classic2',     label: '经典2' },
  { key: 'classic3',     label: '经典3' },
  { key: 'classic4',     label: '经典4' },
  { key: 'dark',         label: '暗色' },
  { key: 'dark2',        label: '暗色2' },
  { key: 'skyGreen',     label: '天青绿' },
  { key: 'classic5',     label: '经典5' },
  { key: 'classic6',     label: '经典6' },
  { key: 'minions',      label: '小黄人' },
  { key: 'pinkGrape',    label: '粉葡萄' },
  { key: 'mint',         label: '薄荷' },
  { key: 'gold',         label: '金色' },
  { key: 'vitalityOrange', label: '活力橙' },
  { key: 'greenLeaf',    label: '绿叶' },
  { key: 'avocado',      label: '牛油果' },
  { key: 'autumn',       label: '秋天' },
  { key: 'orangeJuice',  label: '橙汁' },
] as const;

// ── 布局选项 ──
export const SM_LAYOUTS: { key: MindMapLayout; label: string }[] = [
  { key: 'logicalStructure',      label: '逻辑结构图' },
  { key: 'logicalStructureLeft',  label: '向左逻辑结构图' },
  { key: 'mindMap',               label: '思维导图' },
  { key: 'organizationStructure', label: '组织结构图' },
  { key: 'catalogOrganization',   label: '目录组织图' },
  { key: 'timeline',              label: '时间线' },
  { key: 'timeline2',             label: '竖向时间线' },
  { key: 'fishbone',              label: '鱼骨图' },
];

// ── Ref 接口 ──
export interface SimpleMindMapRendererRef {
  /** 适应窗口 */
  fitContent: () => void;
  /** 获取当前 JSON 数据 */
  getData: () => SMNode | null;
  /** 设置数据 */
  setData: (data: SMNode) => void;
  /** 获取 MindMap 实例（高级用法） */
  getInstance: () => any;
  /** 撤销 */
  undo: () => void;
  /** 重做 */
  redo: () => void;
  /** 切换布局 */
  setLayout: (layout: MindMapLayout) => void;
  /** 切换主题 */
  setTheme: (theme: string) => void;
  /** 添加子节点 */
  addChildNode: () => void;
  /** 添加同级节点 */
  addSiblingNode: () => void;
  /** 删除当前节点 */
  deleteNode: () => void;
  /** 展开全部 */
  expandAll: () => void;
  /** 收起到指定层级 */
  collapseToLevel: (level: number) => void;
  /** 导出为 SVG 字符串 */
  exportSvg: () => Promise<string | null>;
  /** 导出为 PNG data URL */
  exportPng: () => Promise<string | null>;
  /** 搜索节点 */
  search: (keyword: string) => void;
  /** 替换节点文字 */
  replace: (replaceText: string) => void;
  /** 替换全部 */
  replaceAll: (searchText: string, replaceText: string) => void;
  /** 关闭搜索 */
  closeSearch: () => void;
  /** 切换小地图显示 */
  toggleMiniMap: (show: boolean) => void;
  /** 切换彩虹线条 */
  toggleRainbowLines: (enable: boolean) => void;
  /** 获取选中节点信息 */
  getActiveNodeInfo: () => { text: string; isRoot: boolean; childCount: number; depth: number; path: string[] } | null;
  /** 获取选中分支的 Markdown */
  getActiveBranchMarkdown: () => string | null;
  /** 替换选中节点的子节点 */
  updateActiveNodeChildren: (children: SMNode[]) => void;
  /** 追加子节点到选中节点 */
  insertChildrenToActive: (children: SMNode[]) => void;
  /** 修改选中节点文字 */
  updateActiveNodeText: (text: string) => void;
  /** 设置节点备注 */
  setActiveNodeNote: (note: string) => void;
  /** 放大 */
  zoomIn: () => void;
  /** 缩小 */
  zoomOut: () => void;
  /** 获取当前缩放比例（百分比） */
  getScale: () => number;
  /** 重置缩放到100% */
  resetScale: () => void;
  /** 设置精确缩放比例（百分比，如 150 = 150%） */
  setScaleTo: (percent: number) => void;
  /** 将根节点移到画布中心（保持当前缩放） */
  moveToCenter: () => void;
}

// ── Props ──
interface SimpleMindMapRendererProps {
  /** 初始数据 */
  data: SMNode;
  /** 布局 */
  layout?: MindMapLayout;
  /** 主题 */
  theme?: string;
  /** 只读模式 */
  readonly?: boolean;
  /** 数据变化回调 */
  onDataChange?: (data: SMNode) => void;
  /** CSS 类名 */
  className?: string;
  /** 是否显示小地图 */
  showMiniMap?: boolean;
  /** 是否启用彩虹线条 */
  rainbowLines?: boolean;
  /** 缩放变化回调 */
  onScaleChange?: (scale: number) => void;
}

export const SimpleMindMapRenderer = forwardRef<SimpleMindMapRendererRef, SimpleMindMapRendererProps>(
  function SimpleMindMapRenderer({ data, layout = 'logicalStructure', theme = 'default', readonly = false, onDataChange, className, showMiniMap = false, rainbowLines = false, onScaleChange }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const miniMapRef = useRef<HTMLDivElement>(null);
    const mindMapRef = useRef<any>(null);
    const [miniMapVisible, setMiniMapVisible] = useState(showMiniMap);
    const onDataChangeRef = useRef(onDataChange);
    onDataChangeRef.current = onDataChange;
    const onScaleChangeRef = useRef(onScaleChange);
    onScaleChangeRef.current = onScaleChange;
    // 防止 data_change 回调触发外部 setData 后又回流到本组件的循环
    const selfUpdatingRef = useRef(false);
    const pluginsRegistered = useRef(false);

    // ── 滚动条状态 ──
    const [scrollbarData, setScrollbarData] = useState<{
      vertical: { top: number; height: number };
      horizontal: { left: number; width: number };
    } | null>(null);
    const hScrollRef = useRef<HTMLDivElement>(null);
    const vScrollRef = useRef<HTMLDivElement>(null);

    // 初始化 simple-mind-map
    useEffect(() => {
      let destroyed = false;

      const init = async () => {
        if (!containerRef.current) return;

        // 动态导入核心和插件
        const MindMap = (await import('simple-mind-map')).default;
        const Drag = (await import('simple-mind-map/src/plugins/Drag.js')).default;
        const Select = (await import('simple-mind-map/src/plugins/Select.js')).default;
        const ExportPlugin = (await import('simple-mind-map/src/plugins/Export.js')).default;
        const MiniMap = (await import('simple-mind-map/src/plugins/MiniMap.js')).default;
        const KeyboardNavigation = (await import('simple-mind-map/src/plugins/KeyboardNavigation.js')).default;
        const Search = (await import('simple-mind-map/src/plugins/Search.js')).default;
        const Scrollbar = (await import('simple-mind-map/src/plugins/Scrollbar.js')).default;
        const RainbowLinesPlugin = (await import('simple-mind-map/src/plugins/RainbowLines.js')).default;

        if (destroyed) return;

        // 注册插件（只注册一次，避免重复注册导致异常）
        if (!pluginsRegistered.current) {
          MindMap.usePlugin(Drag);
          MindMap.usePlugin(Select);
          MindMap.usePlugin(ExportPlugin);
          MindMap.usePlugin(MiniMap);
          MindMap.usePlugin(KeyboardNavigation);
          MindMap.usePlugin(Search);
          MindMap.usePlugin(Scrollbar);
          MindMap.usePlugin(RainbowLinesPlugin);
          pluginsRegistered.current = true;
        }

        // 清理旧实例
        if (mindMapRef.current) {
          try { mindMapRef.current.destroy(); } catch { /* ignore */ }
          mindMapRef.current = null;
        }

        // 确保容器有尺寸
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) {
          containerRef.current.style.minWidth = '400px';
          containerRef.current.style.minHeight = '300px';
        }

        const mm = new MindMap({
          el: containerRef.current,
          data: data || { data: { text: '思维导图' }, children: [] },
          layout,
          theme,
          readonly,
          // 自动适应屏幕（首次渲染时 fit）
          fit: true,
          // 节点编辑配置
          enableAutoEnterTextEditWhenKeydown: true,
          isEndNodeTextEditOnClickOuter: true,
          nodeTextEditZIndex: 10000,
          // 历史记录
          maxHistoryCount: 100,
          addHistoryTime: 300,
          // 展开/收起按钮
          alwaysShowExpandBtn: false,
          expandBtnStyle: {
            color: '#808080',
            fill: '#ffffff',
            fontSize: 12,
            strokeColor: '#999999',
          },
          // 性能
          openPerformance: false,
          // 彩虹线条
          rainbowLinesOpen: rainbowLines,
          // 滚动条：启用插件事件（UI 由我们自定义渲染）
          isShowScrollbar: true,
          isLimitMindMapInCanvasWhenHasScrollbar: false,
          // 鼠标滚轮默认平移画布，Ctrl+滚轮缩放（专业工具标准行为）
          mousewheelAction: 'move',
          mousewheelMoveStep: 100,
          mousewheelZoomActionReverse: false,
          mouseScaleCenterUseMousePosition: true,
          // 适应画布边距
          fitPadding: 30,
          // 缩放范围
          minZoomRatio: 10,
          maxZoomRatio: 500,
          // 节点拖拽
          enableNodeDraggable: true,
          // 快捷键
          enableShortcutOnlyWhenMouseInSvg: true,
          // 默认文本
          defaultInsertSecondLevelNodeText: '分支',
          defaultInsertBelowSecondLevelNodeText: '子节点',
          // 错误处理
          errorHandler: (code: string, error: Error) => {
            // 剪贴板权限错误在 Tauri WebView 中是预期行为，静默处理
            if (code === 'read_clipboard_error') return;
            console.warn('[SimpleMindMap] 错误:', code, error);
          },
        });

        mindMapRef.current = mm;

        // 监听数据变化，通知父组件（跳过初始渲染触发的事件）
        let firstRender = true;
        mm.on('data_change', (newData: SMNode) => {
          if (firstRender) { firstRender = false; return; }
          selfUpdatingRef.current = true;
          onDataChangeRef.current?.(newData);
          // 双保险重置标志：microtask + setTimeout，确保 React 批量更新完成后再清除
          queueMicrotask(() => {
            setTimeout(() => { selfUpdatingRef.current = false; }, 0);
          });
        });

        // 监听缩放变化
        mm.on('scale', (scale: number) => {
          onScaleChangeRef.current?.(Math.round(scale * 100));
        });

        // 使用 Scrollbar 插件的 scrollbar_change 事件更新滚动条状态
        mm.on('scrollbar_change', (sbData: { vertical: { top: number; height: number }; horizontal: { left: number; width: number } }) => {
          setScrollbarData(sbData);
        });
        // 设置滚动条容器尺寸（供插件计算拖拽映射）
        const containerRect = containerRef.current.getBoundingClientRect();
        try { (mm as any).scrollbar?.setScrollBarWrapSize?.(containerRect.width, containerRect.height); } catch { /* ignore */ }

        // 初始化小地图
        if (miniMapRef.current) {
          try {
            mm.miniMap.init(miniMapRef.current);
          } catch { /* 小地图初始化失败不影响主功能 */ }
        }

        // 首次渲染完成后居中根节点（fit: true 已在构造函数中执行 fit）
        let firstRenderDone = false;
        mm.on('node_tree_render_end', () => {
          if (!firstRenderDone && !destroyed) {
            firstRenderDone = true;
            // 确保 fit 完成后再微调居中
            setTimeout(() => {
              if (!destroyed && mm.view) {
                try {
                  const rootGroup = mm.renderer?.root?.group;
                  if (rootGroup) {
                    const rootRect = rootGroup.rbox();
                    const elRect = (mm as any).elRect || mm.el.getBoundingClientRect();
                    const rootCX = rootRect.x + rootRect.width / 2 - elRect.left;
                    const rootCY = rootRect.y + rootRect.height / 2 - elRect.top;
                    const canvasCX = elRect.width / 2;
                    const canvasCY = elRect.height / 2;
                    const dx = canvasCX - rootCX;
                    const dy = canvasCY - rootCY;
                    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
                      mm.view.translateXY(dx, dy);
                    }
                  }
                } catch { /* ignore */ }
              }
            }, 200);
          }
        });
      };

      init();

      return () => {
        destroyed = true;
        if (mindMapRef.current) {
          try { mindMapRef.current.destroy(); } catch { /* ignore */ }
          mindMapRef.current = null;
        }
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // 仅初始化一次

    // 外部数据更新 → 同步到实例（不自动 fit，保持当前缩放和位置）
    const prevDataRef = useRef(data);
    useEffect(() => {
      if (!mindMapRef.current || !data) return;
      // 跳过自身 data_change 回调触发的更新（防止循环）
      if (selfUpdatingRef.current) return;
      if (data !== prevDataRef.current) {
        prevDataRef.current = data;
        mindMapRef.current.setData(data);
      }
    }, [data]);

    // 布局变更
    useEffect(() => {
      if (!mindMapRef.current) return;
      mindMapRef.current.setLayout(layout);
    }, [layout]);

    // 主题变更
    useEffect(() => {
      if (!mindMapRef.current) return;
      mindMapRef.current.setTheme(theme);
    }, [theme]);

    // 只读模式切换
    useEffect(() => {
      if (!mindMapRef.current) return;
      mindMapRef.current.setMode(readonly ? 'readonly' : 'edit');
    }, [readonly]);

    // 容器 resize 监听 + 同步滚动条容器尺寸
    useEffect(() => {
      if (!containerRef.current) return;
      const observer = new ResizeObserver(() => {
        const mm = mindMapRef.current;
        if (!mm) return;
        mm.resize();
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          try { (mm as any).scrollbar?.setScrollBarWrapSize?.(rect.width, rect.height); } catch { /* ignore */ }
        }
      });
      observer.observe(containerRef.current);
      return () => observer.disconnect();
    }, []);

    // ── 暴露方法 ──

    const fitContent = useCallback(() => {
      mindMapRef.current?.view?.fit();
    }, []);

    const getData = useCallback((): SMNode | null => {
      if (!mindMapRef.current) return null;
      return mindMapRef.current.getData(true);
    }, []);

    const setData = useCallback((newData: SMNode, autoFit = false) => {
      if (!mindMapRef.current) return;
      prevDataRef.current = newData;
      mindMapRef.current.setData(newData);
      if (autoFit) {
        mindMapRef.current.view?.fit();
      }
    }, []);

    const getInstance = useCallback(() => mindMapRef.current, []);

    const undo = useCallback(() => {
      mindMapRef.current?.execCommand('BACK');
    }, []);

    const redo = useCallback(() => {
      mindMapRef.current?.execCommand('FORWARD');
    }, []);

    const setLayoutFn = useCallback((l: MindMapLayout) => {
      mindMapRef.current?.setLayout(l);
    }, []);

    const setThemeFn = useCallback((t: string) => {
      mindMapRef.current?.setTheme(t);
    }, []);

    const addChildNode = useCallback(() => {
      mindMapRef.current?.execCommand('INSERT_CHILD_NODE');
    }, []);

    const addSiblingNode = useCallback(() => {
      mindMapRef.current?.execCommand('INSERT_NODE');
    }, []);

    const deleteNode = useCallback(() => {
      mindMapRef.current?.execCommand('REMOVE_NODE');
    }, []);

    const expandAll = useCallback(() => {
      mindMapRef.current?.execCommand('EXPAND_ALL');
    }, []);

    const collapseToLevel = useCallback((level: number) => {
      mindMapRef.current?.execCommand('UNEXPAND_TO_LEVEL', level);
    }, []);

    const exportSvg = useCallback(async (): Promise<string | null> => {
      if (!mindMapRef.current) return null;
      try {
        const svgData = await mindMapRef.current.export('svg');
        return svgData || null;
      } catch {
        return null;
      }
    }, []);

    const exportPng = useCallback(async (): Promise<string | null> => {
      if (!mindMapRef.current) return null;
      try {
        const pngData = await mindMapRef.current.export('png');
        return pngData || null;
      } catch {
        return null;
      }
    }, []);

    const search = useCallback((keyword: string) => {
      mindMapRef.current?.search?.search(keyword);
    }, []);

    const replace = useCallback((replaceText: string) => {
      mindMapRef.current?.search?.replace(replaceText);
    }, []);

    const replaceAllFn = useCallback((searchText: string, replaceText: string) => {
      mindMapRef.current?.search?.replaceAll(searchText, replaceText);
    }, []);

    const closeSearch = useCallback(() => {
      mindMapRef.current?.search?.endSearch();
    }, []);

    const toggleMiniMap = useCallback((show: boolean) => {
      setMiniMapVisible(show);
    }, []);

    const toggleRainbowLinesFn = useCallback((enable: boolean) => {
      if (!mindMapRef.current) return;
      mindMapRef.current.setRainbowLinesOpen?.(enable);
    }, []);

    // ── 节点级操作方法 ──

    const getActiveNodeInfo = useCallback(() => {
      const mm = mindMapRef.current;
      if (!mm) return null;
      const nodes = mm.renderer?.activeNodeList;
      if (!nodes?.length) return null;
      const node = nodes[0];
      const text = node.nodeData?.data?.text || '';
      const isRoot = !!node.isRoot;
      const childCount = node.nodeData?.children?.length || 0;
      // 计算深度和路径
      const path: string[] = [];
      let cur = node;
      while (cur) {
        path.unshift(cur.nodeData?.data?.text || '');
        cur = cur.parent;
      }
      const depth = path.length;
      return { text, isRoot, childCount, depth, path };
    }, []);

    const getActiveBranchMarkdown = useCallback((): string | null => {
      const mm = mindMapRef.current;
      if (!mm) return null;
      const nodes = mm.renderer?.activeNodeList;
      if (!nodes?.length) return null;
      const nodeData = nodes[0].nodeData;
      if (!nodeData) return null;
      return mindMapDataToMarkdown(nodeData);
    }, []);

    const updateActiveNodeChildren = useCallback((children: SMNode[]) => {
      const mm = mindMapRef.current;
      if (!mm) return;
      const nodes = mm.renderer?.activeNodeList;
      if (!nodes?.length) return;
      const node = nodes[0];
      // 先删除所有子节点，再插入新的
      mm.execCommand('SET_NODE_DATA', node, { children });
      mm.render();
    }, []);

    const insertChildrenToActive = useCallback((children: SMNode[]) => {
      const mm = mindMapRef.current;
      if (!mm) return;
      const nodes = mm.renderer?.activeNodeList;
      if (!nodes?.length) return;
      for (const child of children) {
        mm.execCommand('INSERT_CHILD_NODE', false, child);
      }
    }, []);

    const updateActiveNodeText = useCallback((text: string) => {
      const mm = mindMapRef.current;
      if (!mm) return;
      const nodes = mm.renderer?.activeNodeList;
      if (!nodes?.length) return;
      mm.execCommand('SET_NODE_TEXT', nodes[0], text);
    }, []);

    const setActiveNodeNote = useCallback((note: string) => {
      const mm = mindMapRef.current;
      if (!mm) return;
      const nodes = mm.renderer?.activeNodeList;
      if (!nodes?.length) return;
      mm.execCommand('SET_NODE_NOTE', nodes[0], note);
    }, []);

    // ── 缩放方法 ──

    const zoomIn = useCallback(() => {
      const mm = mindMapRef.current;
      if (!mm) return;
      const td = mm.view?.getTransformData?.();
      const currentScale = td?.state?.scale ?? 1;
      const newScale = Math.min(currentScale + 0.1, 3);
      mm.view?.setScale?.(newScale);
      onScaleChangeRef.current?.(Math.round(newScale * 100));
    }, []);

    const zoomOut = useCallback(() => {
      const mm = mindMapRef.current;
      if (!mm) return;
      const td = mm.view?.getTransformData?.();
      const currentScale = td?.state?.scale ?? 1;
      const newScale = Math.max(currentScale - 0.1, 0.1);
      mm.view?.setScale?.(newScale);
      onScaleChangeRef.current?.(Math.round(newScale * 100));
    }, []);

    const getScale = useCallback((): number => {
      const mm = mindMapRef.current;
      if (!mm) return 100;
      const td = mm.view?.getTransformData?.();
      return Math.round((td?.state?.scale ?? 1) * 100);
    }, []);

    const resetScale = useCallback(() => {
      const mm = mindMapRef.current;
      if (!mm) return;
      mm.view?.reset?.();
      onScaleChangeRef.current?.(100);
    }, []);

    const setScaleTo = useCallback((percent: number) => {
      const mm = mindMapRef.current;
      if (!mm) return;
      const clamped = Math.max(10, Math.min(500, percent));
      mm.view?.setScale?.(clamped / 100);
      onScaleChangeRef.current?.(clamped);
    }, []);

    const moveToCenter = useCallback(() => {
      const mm = mindMapRef.current;
      if (!mm) return;
      try {
        // 获取根节点的渲染坐标
        const rootGroup = mm.renderer?.root?.group;
        if (!rootGroup) return;
        const rootRect = rootGroup.rbox();
        const elRect = mm.elRect || mm.el.getBoundingClientRect();
        // 根节点中心相对于浏览器窗口的坐标
        const rootCX = rootRect.x + rootRect.width / 2 - elRect.left;
        const rootCY = rootRect.y + rootRect.height / 2 - elRect.top;
        // 画布中心
        const canvasCX = elRect.width / 2;
        const canvasCY = elRect.height / 2;
        // 需要的平移偏移量
        const dx = canvasCX - rootCX;
        const dy = canvasCY - rootCY;
        mm.view.translateXY(dx, dy);
      } catch { /* 容错 */ }
    }, []);

    useImperativeHandle(ref, () => ({
      fitContent,
      getData,
      setData,
      getInstance,
      undo,
      redo,
      setLayout: setLayoutFn,
      setTheme: setThemeFn,
      addChildNode,
      addSiblingNode,
      deleteNode,
      expandAll,
      collapseToLevel,
      exportSvg,
      exportPng,
      search,
      replace,
      replaceAll: replaceAllFn,
      closeSearch,
      toggleMiniMap,
      toggleRainbowLines: toggleRainbowLinesFn,
      getActiveNodeInfo,
      getActiveBranchMarkdown,
      updateActiveNodeChildren,
      insertChildrenToActive,
      updateActiveNodeText,
      setActiveNodeNote,
      zoomIn,
      zoomOut,
      getScale,
      resetScale,
      setScaleTo,
      moveToCenter,
    }), [fitContent, getData, setData, getInstance, undo, redo, setLayoutFn, setThemeFn, addChildNode, addSiblingNode, deleteNode, expandAll, collapseToLevel, exportSvg, exportPng, search, replace, replaceAllFn, closeSearch, toggleMiniMap, toggleRainbowLinesFn, getActiveNodeInfo, getActiveBranchMarkdown, updateActiveNodeChildren, insertChildrenToActive, updateActiveNodeText, setActiveNodeNote, zoomIn, zoomOut, getScale, resetScale, setScaleTo, moveToCenter]);

    // ── 滚动条拖拽处理（完全自实现，不依赖插件 onMousedown） ──
    const handleScrollbarMouseDown = useCallback((e: React.MouseEvent, type: 'vertical' | 'horizontal') => {
      e.preventDefault();
      e.stopPropagation();
      const mm = mindMapRef.current;
      if (!mm?.view) return;
      const startX = e.clientX;
      const startY = e.clientY;

      const onMouseMove = (ev: MouseEvent) => {
        ev.preventDefault();
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        if (type === 'horizontal') {
          // 滚动条向右 → 画布向左（反方向）
          // 将像素偏移量按比例放大
          const rect = containerRef.current?.getBoundingClientRect();
          if (!rect || !scrollbarData) return;
          const trackWidth = rect.width;
          const thumbWidthPx = (scrollbarData.horizontal.width / 100) * trackWidth;
          const ratio = trackWidth / Math.max(thumbWidthPx, 1);
          mm.view.translateX(-dx * ratio * 0.15);
        } else {
          const rect = containerRef.current?.getBoundingClientRect();
          if (!rect || !scrollbarData) return;
          const trackHeight = rect.height;
          const thumbHeightPx = (scrollbarData.vertical.height / 100) * trackHeight;
          const ratio = trackHeight / Math.max(thumbHeightPx, 1);
          mm.view.translateY(-dy * ratio * 0.15);
        }
      };

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    }, [scrollbarData]);

    // 滚动条轨道点击 → 视图大幅平移
    const handleScrollbarTrackClick = useCallback((e: React.MouseEvent, type: 'vertical' | 'horizontal') => {
      e.preventDefault();
      const mm = mindMapRef.current;
      if (!mm?.view || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      if (type === 'horizontal') {
        // 点击位置占轨道的百分比
        const clickPercent = (e.clientX - rect.left) / rect.width * 100;
        const currentCenter = scrollbarData ? scrollbarData.horizontal.left + scrollbarData.horizontal.width / 2 : 50;
        const delta = (clickPercent - currentCenter) / 100 * rect.width;
        mm.view.translateX(-delta);
      } else {
        const clickPercent = (e.clientY - rect.top) / rect.height * 100;
        const currentCenter = scrollbarData ? scrollbarData.vertical.top + scrollbarData.vertical.height / 2 : 50;
        const delta = (clickPercent - currentCenter) / 100 * rect.height;
        mm.view.translateY(-delta);
      }
    }, [scrollbarData]);

    // 滚动条是否需要显示：内容超出画布时显示，或始终显示（半透明）
    const showHScrollbar = !!scrollbarData && scrollbarData.horizontal.width < 99.5;
    const showVScrollbar = !!scrollbarData && scrollbarData.vertical.height < 99.5;

    return (
      <div className={className} style={{ width: '100%', height: '100%', minHeight: '300px', position: 'relative', overflow: 'hidden' }}>
        <div
          ref={containerRef}
          style={{ width: '100%', height: '100%' }}
        />

        {/* ── 自定义水平滚动条 ── */}
        {showHScrollbar && scrollbarData && (
          <div
            ref={hScrollRef}
            className="absolute left-0 bottom-0 h-[10px] hover:h-[14px] transition-all z-[90] group"
            style={{ width: showVScrollbar ? 'calc(100% - 10px)' : '100%' }}
            onClick={(e) => handleScrollbarTrackClick(e, 'horizontal')}
          >
            <div className="absolute inset-0 bg-black/5 dark:bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div
              className="absolute top-[2px] h-[6px] group-hover:h-[10px] group-hover:top-[2px] rounded-full bg-black/25 dark:bg-white/30 hover:bg-black/45 dark:hover:bg-white/45 active:bg-black/60 dark:active:bg-white/60 transition-all cursor-pointer"
              style={{
                left: `${scrollbarData.horizontal.left}%`,
                width: `${Math.max(scrollbarData.horizontal.width, 5)}%`,
              }}
              onMouseDown={(e) => handleScrollbarMouseDown(e, 'horizontal')}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}

        {/* ── 自定义垂直滚动条 ── */}
        {showVScrollbar && scrollbarData && (
          <div
            ref={vScrollRef}
            className="absolute top-0 right-0 w-[10px] hover:w-[14px] transition-all z-[90] group"
            style={{ height: showHScrollbar ? 'calc(100% - 10px)' : '100%' }}
            onClick={(e) => handleScrollbarTrackClick(e, 'vertical')}
          >
            <div className="absolute inset-0 bg-black/5 dark:bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div
              className="absolute left-[2px] w-[6px] group-hover:w-[10px] group-hover:left-[2px] rounded-full bg-black/25 dark:bg-white/30 hover:bg-black/45 dark:hover:bg-white/45 active:bg-black/60 dark:active:bg-white/60 transition-all cursor-pointer"
              style={{
                top: `${scrollbarData.vertical.top}%`,
                height: `${Math.max(scrollbarData.vertical.height, 5)}%`,
              }}
              onMouseDown={(e) => handleScrollbarMouseDown(e, 'vertical')}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}

        {/* 小地图容器 */}
        {miniMapVisible && (
          <div
            ref={miniMapRef}
            className="absolute bottom-2 right-2 border rounded shadow-md bg-background/90 overflow-hidden"
            style={{ width: '150px', height: '100px', zIndex: 100 }}
          />
        )}
      </div>
    );
  },
);
