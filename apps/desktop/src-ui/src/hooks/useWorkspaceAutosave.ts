import { useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { isTauri } from '@/lib/isTauri';

export function useWorkspaceAutosave() {
  const saveWorkspaceRef = useRef<(() => Promise<void>) | null>(null);
  const isRestoringRef = useRef(false);

  // 更新 ref 引用
  useEffect(() => {
    saveWorkspaceRef.current = useAppStore.getState().saveWorkspaceState;
  });

  // 监听窗口关闭事件
  useEffect(() => {
    // 检查是否在 Tauri 环境中
    if (!isTauri()) {
      return;
    }

    const unlistenPromise = getCurrentWindow().onCloseRequested(async (event) => {
      // 防止在恢复过程中触发保存
      if (isRestoringRef.current) {
        return;
      }

      event.preventDefault(); // 阻止默认关闭行为

      try {
        // 保存工作区状态
        if (saveWorkspaceRef.current) {
          await saveWorkspaceRef.current();
        }

        // 延迟关闭以确保保存完成
        setTimeout(() => {
          getCurrentWindow().close();
        }, 100);
      } catch (error) {
        console.error('[Workspace] Failed to save on close:', error);
        // 即使保存失败也允许关闭
        getCurrentWindow().close();
      }
    });

    return () => {
      unlistenPromise.then(unlisten => unlisten());
    };
  }, []);

  // 使用 useCallback 确保函数引用稳定
  const setRestoring = useCallback((restoring: boolean) => {
    isRestoringRef.current = restoring;
  }, []);

  return { setRestoring };
}
