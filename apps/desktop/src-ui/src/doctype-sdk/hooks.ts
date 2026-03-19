/**
 * DocType SDK React Hooks
 */
import { useMemo, useRef, useEffect } from 'react';
import type { Document } from '@aidocplus/shared-types';
import type { DocTypeHostAPI } from './types';
import { createDocTypeHost } from './host';
import { useAppStore } from '@/stores/useAppStore';

/**
 * 为文档类型编辑器创建 DocTypeHostAPI 实例。
 * 使用 ref 持有最新文档引用，避免频繁重建 API。
 */
export function useDocTypeHost(
  docTypeId: string,
  documentId: string,
  tabId: string,
): DocTypeHostAPI {
  // 同步初始化 + effect 持续更新，确保 getDocument() 不会在首次渲染时 throw
  const currentDoc = useAppStore(s => s.documents.find(d => d.id === documentId) || null);
  const docRef = useRef<Document | null>(currentDoc);
  useEffect(() => {
    docRef.current = currentDoc;
  }, [currentDoc]);

  return useMemo(() => {
    return createDocTypeHost({
      docTypeId,
      documentId,
      tabId,
      getDocument: () => {
        const doc = docRef.current;
        if (!doc) throw new Error(`Document ${documentId} not found`);
        return doc;
      },
    });
  // 只在 ID 变化时重建
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docTypeId, documentId, tabId]);
}
