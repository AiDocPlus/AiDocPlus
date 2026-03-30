import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
  },
  // Env prefix for Tauri
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    // Tauri uses Chromium on Windows and WebKit on macOS
    target: process.env.TAURI_PLATFORM == 'windows' ? 'chrome105' : 'safari13',
    // Don't minify for debug builds
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    // Produce sourcemaps for debug builds
    sourcemap: !!process.env.TAURI_DEBUG,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        manager: path.resolve(__dirname, 'manager.html'),
        help: path.resolve(__dirname, 'help.html'),
        scratchpad: path.resolve(__dirname, 'scratchpad.html'),
        reader: path.resolve(__dirname, 'reader.html'),
      },
      output: {
        manualChunks(id) {
          // CodeMirror 编辑器核心 + 语法高亮（约 2-3 MB）
          if (id.includes('@codemirror/') || id.includes('@lezer/')) {
            return 'vendor-codemirror';
          }
          // Markdown 渲染管线（react-markdown + remark + rehype + unified）
          if (
            id.includes('react-markdown') ||
            id.includes('remark-') ||
            id.includes('rehype-') ||
            id.includes('unified') ||
            id.includes('mdast-') ||
            id.includes('hast-') ||
            id.includes('micromark') ||
            id.includes('unist-')
          ) {
            return 'vendor-markdown';
          }
          // Mermaid 图表引擎（约 2-3 MB）
          if (id.includes('mermaid') || id.includes('dagre-') || id.includes('d3') || id.includes('elkjs') || id.includes('@mermaid-js/')) {
            return 'vendor-mermaid';
          }
          // TipTap 编辑器核心 + 扩展
          if (id.includes('@tiptap/') || id.includes('prosemirror-') || id.includes('tippy.js')) {
            return 'vendor-tiptap';
          }
          // Radix UI 组件库
          if (id.includes('@radix-ui/')) {
            return 'vendor-radix';
          }
          // 图标库
          if (id.includes('lucide-react')) {
            return 'vendor-icons';
          }
          // PDF.js
          if (id.includes('pdfjs-dist')) {
            return 'vendor-pdfjs';
          }
          // i18next
          if (id.includes('i18next') || id.includes('react-i18next')) {
            return 'vendor-i18n';
          }
          // React 核心
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/scheduler/')
          ) {
            return 'vendor-react';
          }
        },
      },
    },
  },
})
