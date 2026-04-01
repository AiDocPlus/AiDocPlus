// ── 邮件客户端数据初始化 Hook（Phase 8） ──

import { useEffect } from 'react';
import { useMailStore } from '../store/useMailStore';
import { loadMailClientData } from './storage';

/**
 * 在 MailClientApp 挂载时加载持久化数据到 store。
 * 每次 store 内数据变化后，视图层负责调用对应的 save* 函数持久化。
 */
export function useMailInit() {
  const {
    setAccounts,
    setActiveAccountId,
    setContacts,
    setContactGroups,
    setTemplates,
    setSignatures,
    setActiveSignatureId,
    setDrafts,
    setBulkJobs,
    setSendHistory,
    setInitialized,
    initialized,
  } = useMailStore();

  useEffect(() => {
    if (initialized) return;

    let cancelled = false;
    loadMailClientData().then((data) => {
      if (cancelled) return;
      if (data.accounts.length > 0) {
        setAccounts(data.accounts);
        setActiveAccountId(
          data.activeAccountId || data.accounts[0]?.id || '',
        );
      }
      if (data.contacts.length > 0) {
        setContacts(data.contacts);
      }
      if (data.contactGroups.length > 0) {
        setContactGroups(data.contactGroups);
      }
      if (data.templates.length > 0) {
        setTemplates(data.templates);
      }
      if (data.signatures.length > 0) {
        setSignatures(data.signatures);
        setActiveSignatureId(data.activeSignatureId || '');
      }
      if (data.drafts.length > 0) {
        setDrafts(data.drafts);
      }
      if (data.bulkJobs.length > 0) {
        setBulkJobs(data.bulkJobs);
      }
      if (data.sendHistory.length > 0) {
        setSendHistory(data.sendHistory);
      }
      setInitialized(true);
    }).catch((err) => {
      if (!cancelled) {
        console.error('[MailClient] 初始化数据加载失败:', err);
        setInitialized(true);
      }
    });

    return () => { cancelled = true; };
  }, [
    initialized,
    setAccounts, setActiveAccountId,
    setContacts, setContactGroups,
    setTemplates,
    setSignatures, setActiveSignatureId,
    setDrafts, setBulkJobs,
    setSendHistory,
    setInitialized,
  ]);
}
