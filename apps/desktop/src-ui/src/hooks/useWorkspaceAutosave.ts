import { useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { exit } from '@tauri-apps/plugin-process';
import { isTauri } from '@/lib/isTauri';

export function useWorkspaceAutosave() {
  const saveWorkspaceRef = useRef<(() => Promise<void>) | null>(null);
  const isRestoringRef = useRef(false);
  const isClosingRef = useRef(false);

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

      // 防止 close() 再次触发 onCloseRequested 导致死循环
      if (isClosingRef.current) {
        return;
      }

      event.preventDefault(); // 阻止默认关闭行为
      isClosingRef.current = true;

      try {
        // 保存工作区状态
        if (saveWorkspaceRef.current) {
          await saveWorkspaceRef.current();
        }
      } catch (error) {
        console.error('[Workspace] Failed to save on close:', error);
      }

      // 保存完成后退出进程（destroy 在 Windows 上可能只销毁窗口不终止进程）
      await exit(0);
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
