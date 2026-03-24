/**
 * Tushare 实时数据 Hook（与 stockResearchContext 纯函数分离）
 */
import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { TushareCredential, TushareToolParams, DataFetchStatus } from './types';

export interface TushareToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export function useTushareLive() {
  const [status, setStatus] = useState<DataFetchStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const checkToken = useCallback(async (): Promise<TushareCredential | null> => {
    try {
      setStatus('loading');
      const result = await invoke<{ valid: boolean; token_prefix?: string; account?: Record<string, unknown> }>('tushare_token_check');
      if (result.valid) {
        setStatus('success');
        return {
          token: result.token_prefix || '',
          isValid: true,
          points: (result.account?.['points'] as number) || 0,
          userId: result.account?.['user_id'] as string,
          email: result.account?.['email'] as string,
          tokenPrefix: result.token_prefix,
        };
      }
      setStatus('error');
      setError('Token 无效');
      return null;
    } catch (e) {
      setStatus('error');
      setError(String(e));
      return null;
    }
  }, []);

  const invokeTool = useCallback(async (toolName: string, params: TushareToolParams = {}): Promise<TushareToolResult> => {
    try {
      setStatus('loading');
      setError(null);
      const result = await invoke<string>(toolName, params as Record<string, unknown>);
      const parsed = JSON.parse(result);
      if (parsed.error) {
        setStatus('error');
        setError(parsed.error);
        return { success: false, error: parsed.error };
      }
      setStatus('success');
      return { success: true, data: parsed };
    } catch (e) {
      const errMsg = String(e);
      setStatus('error');
      setError(errMsg);
      return { success: false, error: errMsg };
    }
  }, []);

  const fetchStockDaily = useCallback(async (tsCode: string, startDate?: string, endDate?: string) => {
    return invokeTool('stock_daily', { ts_code: tsCode, start_date: startDate, end_date: endDate });
  }, [invokeTool]);

  const fetchIncome = useCallback(async (tsCode: string, startDate?: string, endDate?: string) => {
    return invokeTool('stock_income', { ts_code: tsCode, start_date: startDate, end_date: endDate });
  }, [invokeTool]);

  const fetchIndicator = useCallback(async (tsCode: string, startDate?: string, endDate?: string) => {
    return invokeTool('stock_indicator', { ts_code: tsCode, start_date: startDate, end_date: endDate });
  }, [invokeTool]);

  const fetchMoneyflow = useCallback(async (tsCode: string, startDate?: string, endDate?: string) => {
    return invokeTool('stock_moneyflow', { ts_code: tsCode, start_date: startDate, end_date: endDate });
  }, [invokeTool]);

  const fetchBasicInfo = useCallback(async (tsCode: string) => {
    return invokeTool('stock_basic_info', { ts_code: tsCode });
  }, [invokeTool]);

  const searchStock = useCallback(async (keyword: string) => {
    return invokeTool('stock_search', { keyword });
  }, [invokeTool]);

  const fetchTopList = useCallback(async (tradeDate: string) => {
    return invokeTool('stock_top_list', { trade_date: tradeDate });
  }, [invokeTool]);

  const fetchHsgtTop = useCallback(async (search?: string, startDate?: string, endDate?: string) => {
    return invokeTool('stock_hsgt_top', { search, start_date: startDate, end_date: endDate });
  }, [invokeTool]);

  const fetchMarginDetail = useCallback(async (tsCode: string, startDate?: string, endDate?: string) => {
    return invokeTool('stock_margin_detail', { ts_code: tsCode, start_date: startDate, end_date: endDate });
  }, [invokeTool]);

  const fetchIndexDaily = useCallback(async (tsCode: string, startDate?: string, endDate?: string) => {
    return invokeTool('stock_index_daily', { ts_code: tsCode, start_date: startDate, end_date: endDate });
  }, [invokeTool]);

  const storeToken = useCallback(async (token: string): Promise<{ success: boolean; error?: string }> => {
    try {
      await invoke('store_tushare_credential', { token });
      return { success: true };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }, []);

  const deleteToken = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    try {
      await invoke('delete_tushare_credential');
      return { success: true };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }, []);

  return {
    status,
    error,
    checkToken,
    invokeTool,
    fetchStockDaily,
    fetchIncome,
    fetchIndicator,
    fetchMoneyflow,
    fetchBasicInfo,
    searchStock,
    fetchTopList,
    fetchHsgtTop,
    fetchMarginDetail,
    fetchIndexDaily,
    storeToken,
    deleteToken,
  };
}
