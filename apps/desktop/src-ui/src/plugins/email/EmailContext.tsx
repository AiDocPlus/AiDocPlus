import { createContext, useContext } from 'react';
import type { usePluginHost } from '../_framework/PluginHostAPI';
import type { EmailState, EmailAction } from './emailReducer';
import type { EmailStorageData } from './types';

export interface EmailContextValue {
  state: EmailState;
  dispatch: React.Dispatch<EmailAction>;
  /** 持久化部分数据到 host.storage */
  saveToStorage: (updates: Partial<EmailStorageData>) => void;
  /** 显示状态消息（同时追加日志） */
  showStatus: (msg: string, isError?: boolean) => void;
  /** 国际化翻译函数 */
  t: (key: string, params?: Record<string, string | number>) => string;
  /** 插件宿主 API */
  host: ReturnType<typeof usePluginHost>;
}

export const EmailContext = createContext<EmailContextValue | null>(null);

export function useEmailContext(): EmailContextValue {
  const ctx = useContext(EmailContext);
  if (!ctx) throw new Error('useEmailContext must be used within EmailContext.Provider');
  return ctx;
}
