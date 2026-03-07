/**
 * 性能诊断日志工具
 * 用于追踪组件渲染次数，帮助定位性能瓶颈
 * 诊断完成后删除此文件及相关调用
 */

const renderCounts: Record<string, number> = {};

/**
 * 在组件函数体顶部调用，每次渲染自增计数并打印
 * 使用 throttle 避免日志刷屏：每个组件最多每 2 秒打印一次
 */
const lastLogTime: Record<string, number> = {};

export function logRender(componentName: string): void {
  renderCounts[componentName] = (renderCounts[componentName] || 0) + 1;
  const now = Date.now();
  if (!lastLogTime[componentName] || now - lastLogTime[componentName] > 2000) {
    lastLogTime[componentName] = now;
    console.log(`[Render] ${componentName}: #${renderCounts[componentName]}`);
  }
}

/**
 * 在控制台调用 window.__perfReport() 查看所有组件渲染次数汇总
 */
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__perfReport = () => {
    console.table(
      Object.entries(renderCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => ({ 组件: name, 渲染次数: count }))
    );
  };
}
