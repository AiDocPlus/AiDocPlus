import { useState } from 'react';

interface WechatPreviewProps {
  html: string;
  title?: string;
  t: (key: string) => string;
}

/**
 * 微信公众号手机模拟预览组件
 * 模拟 iPhone 屏幕宽度 375px 的阅读体验
 */
export function WechatPreview({ html, title, t }: WechatPreviewProps) {
  const [mode, setMode] = useState<'preview' | 'source'>('preview');

  return (
    <div className="flex flex-col h-full">
      {/* 模式切换标签 */}
      <div className="flex items-center gap-0.5 px-3 py-1 border-b bg-muted/20 flex-shrink-0">
        <button
          className={`px-3 py-1 text-xs rounded-md transition-colors ${
            mode === 'preview'
              ? 'bg-[#07C160] text-white'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
          onClick={() => setMode('preview')}
        >
          {t('wxPreview')}
        </button>
        <button
          className={`px-3 py-1 text-xs rounded-md transition-colors ${
            mode === 'source'
              ? 'bg-[#07C160] text-white'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
          onClick={() => setMode('source')}
        >
          {t('wxSource')}
        </button>
        {title && (
          <span className="ml-2 text-xs text-muted-foreground truncate">{title}</span>
        )}
      </div>

      {/* 内容区 */}
      <div className="flex-1 min-h-0 overflow-auto bg-muted/10 flex justify-center py-4">
        {mode === 'preview' ? (
          /* 手机模拟框 */
          <div className="flex-shrink-0" style={{ width: 375 }}>
            {/* 模拟手机顶部状态栏 */}
            <div className="rounded-t-2xl bg-white dark:bg-zinc-900 border border-b-0 px-4 py-2 flex items-center justify-between"
              style={{ borderColor: '#e5e5e5' }}>
              <span className="text-xs text-muted-foreground">9:41</span>
              <div className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5 text-muted-foreground" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3a4.237 4.237 0 00-6 0zm-4-4l2 2a7.074 7.074 0 0110 0l2-2C15.14 9.14 8.87 9.14 5 13z"/>
                </svg>
                <svg className="w-4 h-4 text-muted-foreground" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33v15.33C7 21.4 7.6 22 8.33 22h7.33c.74 0 1.34-.6 1.34-1.33V5.33C17 4.6 16.4 4 15.67 4z"/>
                </svg>
              </div>
            </div>

            {/* 文章标题区 */}
            {title && (
              <div className="bg-white dark:bg-zinc-900 border-x px-4 pt-4 pb-2" style={{ borderColor: '#e5e5e5' }}>
                <h1 style={{ fontSize: 22, fontWeight: 'bold', lineHeight: 1.4, color: '#1a1a1a', margin: 0 }}>
                  {title}
                </h1>
              </div>
            )}

            {/* 文章内容 */}
            <div
              className="bg-white dark:bg-zinc-900 border-x px-4 py-3"
              style={{ borderColor: '#e5e5e5', minHeight: 200 }}
              dangerouslySetInnerHTML={{ __html: html }}
            />

            {/* 模拟底部 */}
            <div className="rounded-b-2xl bg-white dark:bg-zinc-900 border border-t-0 px-4 py-3 text-center"
              style={{ borderColor: '#e5e5e5' }}>
              <div className="w-32 h-1 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto" />
            </div>
          </div>
        ) : (
          /* 源码视图 */
          <div className="w-full px-3">
            <pre className="text-xs font-mono bg-zinc-900 text-green-400 p-4 rounded-lg overflow-auto max-h-full whitespace-pre-wrap break-all">
              {html}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
