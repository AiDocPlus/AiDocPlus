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
    port: 5173,
    strictPort: true,
  },
  // Env prefix for Tauri
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    // Tauri uses Chromium on Windows and WebKit on macOS and Linux
    target: process.env.TAURI_PLATFORM == 'windows' ? 'chrome105' : 'safari13',
    // Don't minify for debug builds
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    // Produce sourcemaps for debug builds
    sourcemap: !!process.env.TAURI_DEBUG,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        manager: path.resolve(__dirname, 'manager.html'),
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
          // 图标库
          if (id.includes('lucide-react')) {
            return 'vendor-icons';
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
