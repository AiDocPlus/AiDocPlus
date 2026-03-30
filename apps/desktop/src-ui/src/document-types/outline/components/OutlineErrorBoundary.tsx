import React from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import i18n from '@/i18n';

/**
 * OutlineErrorBoundary
 * - 捕获渲染异常，避免大纲工作区白屏
 * - 支持一键重试（重置 hasError）
 */
export class OutlineErrorBoundary extends React.Component<
  { children: React.ReactNode; resetKey?: string | number },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidUpdate(prevProps: { resetKey?: string | number }) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      // 文档切换/重建时自动恢复
      // eslint-disable-next-line react/no-did-update-set-state
      this.setState({ hasError: false });
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground p-6">
        <AlertTriangle className="h-10 w-10 opacity-70" />
        <div className="text-center">
          <div className="text-sm font-medium text-foreground">
            {i18n.t('outline.errorBoundary.title', { defaultValue: '大纲渲染出错' })}
          </div>
          <div className="text-xs mt-1">
            {i18n.t('outline.errorBoundary.desc', { defaultValue: '你可以点击重试；如果问题持续，请刷新应用或反馈日志。' })}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => this.setState({ hasError: false })}
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          {i18n.t('common.retry', { defaultValue: '重试' })}
        </Button>
      </div>
    );
  }
}

export default OutlineErrorBoundary;
