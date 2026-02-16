/**
 * 插件项目环境类型声明
 * 解决第三方库类型版本差异问题
 */

// pptx-preview 模块声明（库类型定义不完整）
declare module 'pptx-preview' {
  export function init(container: HTMLElement, options?: { width?: number; height?: number }): PptxViewer;
  export interface PptxViewer {
    preview(data: ArrayBuffer): Promise<void>;
  }
}

// Vite 特性声明
declare module '*.json' {
  const value: Record<string, unknown>;
  export default value;
}
