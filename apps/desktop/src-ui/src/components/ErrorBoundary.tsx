import React from 'react';
import { useTranslation } from '@/i18n';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * 全局错误边界：捕获 React 组件树中的未处理异常，防止整个应用白屏崩溃。
 * 提供重试按钮让用户恢复操作。
 */
export class GlobalErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[GlobalErrorBoundary] 未捕获的渲染错误:', error, errorInfo.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  override render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} onRetry={this.handleRetry} />;
    }
    return this.props.children;
  }
}

function ErrorFallback({ error, onRetry }: { error: Error | null; onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-center h-screen bg-background text-foreground">
      <div className="text-center space-y-4 max-w-md px-6">
        <div className="text-4xl">⚠️</div>
        <h2 className="text-lg font-semibold">
          {t('common.renderError', { defaultValue: '页面渲染出错' })}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t('common.renderErrorDesc', { defaultValue: '应用遇到了意外错误，请尝试重试。如果问题持续存在，请重启应用。' })}
        </p>
        {error && (
          <details className="text-left text-xs bg-muted p-3 rounded-md max-h-40 overflow-auto">
            <summary className="cursor-pointer font-medium mb-1">
              {t('common.errorDetail', { defaultValue: '错误详情' })}
            </summary>
            <pre className="whitespace-pre-wrap break-all">{error.message}</pre>
          </details>
        )}
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:opacity-90 transition-opacity"
        >
          {t('common.retry', { defaultValue: '重试' })}
        </button>
      </div>
    </div>
  );
}
