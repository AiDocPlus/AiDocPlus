/**
 * 图片导出工具集
 *
 * 提供 PNG / SVG / JPEG / 剪贴板 等导出能力。
 * 缩略图生成用于标签页预览。
 */

import type { Canvas as FabricCanvas } from 'fabric';

/** 导出 PNG data URL */
export function canvasToPNG(canvas: FabricCanvas, multiplier = 2): string {
  return canvas.toDataURL({ format: 'png', multiplier });
}

/** 导出 JPEG data URL */
export function canvasToJPEG(canvas: FabricCanvas, quality = 0.92, multiplier = 2): string {
  return canvas.toDataURL({ format: 'jpeg', quality, multiplier });
}

/** 导出 SVG 字符串 */
export function canvasToSVG(canvas: FabricCanvas): string {
  return canvas.toSVG();
}

/** 生成缩略图（JPEG，max 200px，quality 0.3） */
export function generateThumbnail(canvas: FabricCanvas): string {
  const w = canvas.getWidth();
  const h = canvas.getHeight();
  const maxSize = 200;
  const scale = Math.min(maxSize / w, maxSize / h, 1);
  return canvas.toDataURL({ format: 'jpeg', quality: 0.3, multiplier: scale });
}

/** data URL → Blob */
export function dataURLtoBlob(dataURL: string): Blob {
  const parts = dataURL.split(',');
  const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/png';
  const raw = atob(parts[1]);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    arr[i] = raw.charCodeAt(i);
  }
  return new Blob([arr], { type: mime });
}

/** data URL → Uint8Array */
export function dataURLtoUint8Array(dataURL: string): Uint8Array {
  const raw = atob(dataURL.split(',')[1]);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    arr[i] = raw.charCodeAt(i);
  }
  return arr;
}

/** 复制 PNG 到剪贴板 */
export async function copyCanvasToClipboard(canvas: FabricCanvas): Promise<void> {
  const dataURL = canvasToPNG(canvas, 1);
  const blob = dataURLtoBlob(dataURL);
  await navigator.clipboard.write([
    new ClipboardItem({ 'image/png': blob }),
  ]);
}

/** 生成唯一 ID */
export function genCanvasId(): string {
  return `img_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}
